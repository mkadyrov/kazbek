import express from "express";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import { searchVariants } from "../translit.js";

function requireAdmin(req, res, next) {
  const allowed = config.matchCreators
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(req.user.username.toLowerCase())) {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

export function usersRoutes({ db }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const q = String(req.query.q || "").trim();
    let rows;
    if (q) {
      // Match across Russian and English spellings (Казбек / Kazbek) by
      // searching every transliterated variant of the query against each field.
      const variants = searchVariants(q);
      const likes = variants.map((v) => `%${v}%`);
      const conds = variants
        .map(() => "(username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)")
        .join(" OR ");
      const params = likes.flatMap((l) => [l, l, l]);
      rows = db
        .prepare(
          `
          SELECT id, username, first_name, last_name, rating, photo_url, is_blocked, created_at
          FROM users
          WHERE ${conds}
          ORDER BY rating DESC
          LIMIT 30
          `
        )
        .all(...params);
    } else {
      rows = db
        .prepare(
          `SELECT id, username, first_name, last_name, rating, photo_url, is_blocked, created_at FROM users ORDER BY rating DESC LIMIT 50`
        )
        .all();
    }
    const withBlocked = rows.map((u) => ({ ...u, is_blocked: u.is_blocked ?? 0 }));
    return res.json({ users: withBlocked });
  });

  // PATCH /api/users/:id/block — admin only
  router.patch("/:id/block", requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

    const target = db.prepare("SELECT id, username FROM users WHERE id=?").get(id);
    if (!target) return res.status(404).json({ error: "not_found" });

    // Prevent admins from blocking themselves or other admins
    const admins = config.matchCreators
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(target.username.toLowerCase())) {
      return res.status(400).json({ error: "cannot_block_admin" });
    }

    const blocked = req.body?.blocked ? 1 : 0;
    db.prepare("UPDATE users SET is_blocked=? WHERE id=?").run(blocked, id);
    const updated = db.prepare(
      "SELECT id, username, first_name, last_name, rating, photo_url, is_blocked FROM users WHERE id=?"
    ).get(id);
    return res.json({ user: updated });
  });

  // DELETE /api/users/:id — admin only. Removes a player and their bets,
  // match participations and chat messages. Used to clean up duplicate
  // accounts (player forgot password and re-registered under the same name).
  router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });

    const target = db.prepare("SELECT id, username FROM users WHERE id=?").get(id);
    if (!target) return res.status(404).json({ error: "not_found" });

    // Never delete admins or yourself
    const admins = config.matchCreators
      .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(target.username.toLowerCase())) {
      return res.status(400).json({ error: "cannot_delete_admin" });
    }
    if (req.user.id === id) {
      return res.status(400).json({ error: "cannot_delete_self" });
    }

    // Block deletion if this player created matches — those need handling first
    const created = db
      .prepare("SELECT COUNT(1) AS n FROM matches WHERE created_by_user_id=?")
      .get(id).n;
    if (created > 0) {
      return res.status(409).json({ error: "user_has_matches" });
    }

    const doDelete = db.transaction(() => {
      db.prepare("DELETE FROM match_messages WHERE user_id=?").run(id);
      db.prepare("DELETE FROM bets WHERE user_id=?").run(id);
      db.prepare("DELETE FROM match_players WHERE user_id=?").run(id);
      db.prepare("DELETE FROM users WHERE id=?").run(id);
    });

    try {
      doDelete();
      return res.json({ ok: true, deleted_id: id });
    } catch (e) {
      return res.status(500).json({ error: "server_error", detail: e.message });
    }
  });

  return router;
}
