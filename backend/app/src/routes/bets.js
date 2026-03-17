import express from "express";
import { requireAuth } from "../auth.js";

export function betsRoutes({ db }) {
  const router = express.Router();

  // POST /api/bets
  // body: { match_id, side, amount_tenge, against_bet_id? }
  //   against_bet_id — match against a specific pending opposing bet
  router.post("/", requireAuth, (req, res) => {
    const { match_id, side, amount_tenge, against_bet_id } = req.body || {};
    const mid = Number(match_id);
    const amt = Math.floor(Number(amount_tenge));
    const s = String(side || "").toUpperCase();

    if (!Number.isFinite(mid) || !["A", "B"].includes(s)) {
      return res.status(400).json({ error: "invalid_input" });
    }
    // when matching an existing bet, amount is auto-calculated — skip amount check
    if (against_bet_id == null && (!Number.isFinite(amt) || amt <= 0)) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const match = db.prepare("SELECT * FROM matches WHERE id=?").get(mid);
    if (!match) return res.status(404).json({ error: "match_not_found" });
    if (match.status !== "open") return res.status(409).json({ error: "match_not_open" });

    // ── case 1: match against an existing pending bet ──────────────
    if (against_bet_id != null) {
      const aid = Number(against_bet_id);
      if (!Number.isFinite(aid)) return res.status(400).json({ error: "invalid_against_bet_id" });

      const opposing = db.prepare("SELECT * FROM bets WHERE id=?").get(aid);
      if (!opposing) return res.status(404).json({ error: "opposing_bet_not_found" });
      if (opposing.match_id !== mid) return res.status(400).json({ error: "bet_match_mismatch" });
      if (opposing.side === s) return res.status(400).json({ error: "same_side" });
      if (opposing.bet_status !== "pending") return res.status(409).json({ error: "bet_already_matched" });
      if (opposing.user_id === req.user.id) return res.status(400).json({ error: "cannot_bet_against_yourself" });

      // calculate the required counter-stake from odds
      // if opposing bet is on side A with odds_a:
      //   counter_stake = opposing.amount_tenge × (odds_a − 1)
      // Winner takes both: total pot = opposing.amount_tenge + counter_stake = opposing.amount_tenge × odds_a
      const opposingOdds = opposing.side === "A" ? match.odds_a : match.odds_b;
      const counterAmt = Math.max(1, Math.round(opposing.amount_tenge * (opposingOdds - 1)));

      const doMatch = db.transaction(() => {
        const info = db
          .prepare(
            `INSERT INTO bets (match_id, user_id, side, amount_tenge, bet_status, matched_bet_id)
             VALUES (?, ?, ?, ?, 'matched', ?)`
          )
          .run(mid, req.user.id, s, counterAmt, aid);

        const newBetId = info.lastInsertRowid;
        db.prepare(
          `UPDATE bets SET bet_status='matched', matched_bet_id=? WHERE id=?`
        ).run(newBetId, aid);

        return newBetId;
      });

      try {
        const newBetId = doMatch();
        const newBet = db.prepare("SELECT * FROM bets WHERE id=?").get(newBetId);
        const updatedOpposing = db.prepare("SELECT * FROM bets WHERE id=?").get(aid);
        return res.json({ bet: newBet, matched_with: updatedOpposing });
      } catch {
        return res.status(500).json({ error: "server_error" });
      }
    }

    // ── case 2: create a new pending open bet (challenge) ──────────
    try {
      const info = db
        .prepare(
          `INSERT INTO bets (match_id, user_id, side, amount_tenge, bet_status)
           VALUES (?, ?, ?, ?, 'pending')`
        )
        .run(mid, req.user.id, s, amt);

      const bet = db.prepare("SELECT * FROM bets WHERE id=?").get(info.lastInsertRowid);
      return res.json({ bet });
    } catch {
      return res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/bets/:id — soft-cancel own pending bet (never removes the row)
  router.delete("/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

    const bet = db.prepare("SELECT * FROM bets WHERE id=?").get(id);
    if (!bet) return res.status(404).json({ error: "not_found" });
    if (bet.user_id !== req.user.id) return res.status(403).json({ error: "forbidden" });
    if (bet.bet_status !== "pending") return res.status(409).json({ error: "bet_already_matched" });

    db.prepare("UPDATE bets SET bet_status='cancelled' WHERE id=?").run(id);
    return res.json({ ok: true });
  });

  return router;
}
