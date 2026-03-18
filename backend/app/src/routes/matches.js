import express from "express";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["open", "locked", "finished", "cancelled"].includes(v)) return v;
  return null;
}

function getPlayers(db, matchId) {
  return db
    .prepare(
      `
      SELECT mp.team, mp.slot, u.id, u.username, u.first_name, u.last_name, u.photo_url, u.rating
      FROM match_players mp
      JOIN users u ON u.id = mp.user_id
      WHERE mp.match_id = ?
      ORDER BY mp.team, mp.slot
      `
    )
    .all(matchId);
}

export function matchesRoutes({ db }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const rows = db
      .prepare(
        `
        SELECT
          m.*,
          u.username AS created_by_username,
          u.first_name AS created_by_first_name,
          u.last_name AS created_by_last_name,
          (SELECT COALESCE(SUM(amount_tenge - commission_tenge), 0) FROM bets b WHERE b.match_id = m.id AND b.bet_status = 'matched') AS total_pool_tenge,
          (SELECT COUNT(1) FROM bets b WHERE b.match_id = m.id AND b.bet_status = 'matched') / 2 AS matched_pairs_count,
          (SELECT COUNT(1) FROM bets b WHERE b.match_id = m.id AND b.bet_status = 'pending') AS pending_bets_count
        FROM matches m
        JOIN users u ON u.id = m.created_by_user_id
        ORDER BY datetime(m.start_time) DESC, m.id DESC
        `
      )
      .all();

    const matches = rows.map((m) => ({
      ...m,
      players: getPlayers(db, m.id),
    }));

    return res.json({ matches });
  });

  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

    const match = db
      .prepare(
        `
        SELECT
          m.*,
          u.username AS created_by_username,
          u.first_name AS created_by_first_name,
          u.last_name AS created_by_last_name
        FROM matches m
        JOIN users u ON u.id = m.created_by_user_id
        WHERE m.id=?
        `
      )
      .get(id);
    if (!match) return res.status(404).json({ error: "not_found" });

    // all active bets (exclude cancelled — they stay in DB but are hidden)
    const allBets = db
      .prepare(
        `
        SELECT
          b.id, b.match_id, b.user_id, b.side,
          b.amount_tenge, b.commission_tenge, b.bet_status, b.matched_bet_id, b.created_at,
          u.username, u.first_name, u.last_name, u.photo_url
        FROM bets b
        JOIN users u ON u.id = b.user_id
        WHERE b.match_id = ? AND b.bet_status != 'cancelled'
        ORDER BY b.id ASC
        `
      )
      .all(id);

    const betMap = Object.fromEntries(allBets.map((b) => [b.id, b]));

    // pending: unmatched open challenges (exclude cancelled)
    const pending_bets = allBets.filter((b) => b.bet_status === "pending");

    // matched pairs: deduplicated (only emit each pair once, by lower id)
    const seenPairs = new Set();
    const matched_pairs = [];
    for (const b of allBets) {
      if (b.bet_status !== "matched" || !b.matched_bet_id) continue;
      const pairKey = [Math.min(b.id, b.matched_bet_id), Math.max(b.id, b.matched_bet_id)].join("-");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const partner = betMap[b.matched_bet_id];
      if (!partner) continue;

      const betA = b.side === "A" ? b : partner;
      const betB = b.side === "B" ? b : partner;
      const pot = betA.amount_tenge + betB.amount_tenge;
      const commission = (betA.commission_tenge || 0) + (betB.commission_tenge || 0);
      matched_pairs.push({
        id: pairKey,
        bet_a: betA,
        bet_b: betB,
        pot_tenge: pot,
        commission_tenge: commission,
        net_payout: pot - commission,
      });
    }

    const players = getPlayers(db, id);

    return res.json({ match, players, pending_bets, matched_pairs });
  });

  router.post("/", requireAuth, (req, res) => {
    // check if user is allowed to create matches
    const allowed = config.matchCreators
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(req.user.username.toLowerCase())) {
      return res.status(403).json({ error: "not_allowed_to_create_matches" });
    }

    const { title, location, start_time, notes, team_a, team_b, odds_a, odds_b } = req.body || {};
    if (!title || !start_time) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const aIds = Array.isArray(team_a) ? team_a.map(Number).filter(Number.isFinite) : [];
    const bIds = Array.isArray(team_b) ? team_b.map(Number).filter(Number.isFinite) : [];

    // players are optional — but if provided, max 2 per team and no duplicates
    if (aIds.length > 2 || bIds.length > 2) {
      return res.status(400).json({ error: "max_2_per_team" });
    }

    const allIds = [...aIds, ...bIds];
    if (new Set(allIds).size !== allIds.length) {
      return res.status(400).json({ error: "duplicate_player" });
    }

    const oa = Math.max(1.01, Number(odds_a) || 2.0);
    const ob = Math.max(1.01, Number(odds_b) || 2.0);

    const insertMatch = db.prepare(
      `INSERT INTO matches (created_by_user_id, title, location, start_time, notes, odds_a, odds_b) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertPlayer = db.prepare(
      `INSERT INTO match_players (match_id, user_id, team, slot) VALUES (?, ?, ?, ?)`
    );

    const doCreate = db.transaction(() => {
      const info = insertMatch.run(
        req.user.id,
        String(title).trim(),
        location ? String(location).trim() : null,
        String(start_time),
        notes ? String(notes).trim() : null,
        oa,
        ob
      );
      const mid = info.lastInsertRowid;
      aIds.forEach((uid, i) => insertPlayer.run(mid, uid, "A", i + 1));
      bIds.forEach((uid, i) => insertPlayer.run(mid, uid, "B", i + 1));
      return mid;
    });

    try {
      const mid = doCreate();
      const match = db.prepare("SELECT * FROM matches WHERE id=?").get(mid);
      const players = getPlayers(db, mid);
      return res.json({ match, players });
    } catch (e) {
      return res.status(500).json({ error: "server_error", detail: e.message });
    }
  });

  // creator can lock/cancel the match (but NOT finish — use /winner for that)
  router.patch("/:id/status", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const status = normalizeStatus(req.body?.status);
    if (!Number.isFinite(id) || !status || status === "finished") {
      return res.status(400).json({ error: "invalid_input" });
    }

    const match = db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    if (!match) return res.status(404).json({ error: "not_found" });
    if (match.created_by_user_id !== req.user.id) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (match.status === "finished" || match.status === "cancelled") {
      return res.status(409).json({ error: "match_already_closed" });
    }

    db.prepare("UPDATE matches SET status=? WHERE id=?").run(status, id);
    const updated = db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    return res.json({ match: updated });
  });

  // creator updates odds (allowed while match is open or locked)
  router.patch("/:id/odds", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

    const match = db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    if (!match) return res.status(404).json({ error: "not_found" });
    if (match.created_by_user_id !== req.user.id) return res.status(403).json({ error: "forbidden" });
    if (match.status === "finished" || match.status === "cancelled") {
      return res.status(409).json({ error: "match_already_closed" });
    }

    const oa = parseFloat(String(req.body?.odds_a || "").replace(",", "."));
    const ob = parseFloat(String(req.body?.odds_b || "").replace(",", "."));
    if (!Number.isFinite(oa) || !Number.isFinite(ob) || oa < 1.01 || ob < 1.01) {
      return res.status(400).json({ error: "invalid_odds" });
    }

    db.prepare("UPDATE matches SET odds_a=?, odds_b=? WHERE id=?").run(oa, ob, id);
    const updated = db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    return res.json({ match: updated });
  });

  // creator declares winner → marks match finished
  router.patch("/:id/winner", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const w = String(req.body?.winner || "").toUpperCase();
    if (!Number.isFinite(id) || !["A", "B"].includes(w)) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const match = db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    if (!match) return res.status(404).json({ error: "not_found" });
    if (match.created_by_user_id !== req.user.id) {
      return res.status(403).json({ error: "forbidden" });
    }
    if (match.status === "finished" || match.status === "cancelled") {
      return res.status(409).json({ error: "match_already_closed" });
    }

    db.prepare("UPDATE matches SET status='finished', winner=? WHERE id=?").run(w, id);
    const updated = db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    return res.json({ match: updated });
  });

  return router;
}

