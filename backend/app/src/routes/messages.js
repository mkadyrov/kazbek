import express from "express";
import { requireAuth } from "../auth.js";

const MAX_TEXT = 500;

export function messagesRoutes({ db }) {
  const router = express.Router({ mergeParams: true });

  // GET /api/matches/:matchId/messages?since=<id>
  // Returns up to 100 messages. If `since` is provided, returns only messages
  // with id > since (for polling). Otherwise returns the last 100.
  router.get("/", (req, res) => {
    const matchId = Number(req.params.matchId);
    if (!Number.isFinite(matchId)) return res.status(400).json({ error: "invalid_id" });

    const since = Number(req.query.since) || 0;

    const rows = db
      .prepare(
        `
        SELECT
          mm.id, mm.match_id, mm.text, mm.created_at,
          u.id AS user_id, u.username, u.first_name, u.last_name, u.photo_url
        FROM match_messages mm
        JOIN users u ON u.id = mm.user_id
        WHERE mm.match_id = ? AND mm.id > ?
        ORDER BY mm.id ASC
        LIMIT 100
        `
      )
      .all(matchId, since);

    return res.json({ messages: rows });
  });

  // POST /api/matches/:matchId/messages
  // body: { text }
  router.post("/", requireAuth, (req, res) => {
    const matchId = Number(req.params.matchId);
    if (!Number.isFinite(matchId)) return res.status(400).json({ error: "invalid_id" });

    const match = db.prepare("SELECT id FROM matches WHERE id=?").get(matchId);
    if (!match) return res.status(404).json({ error: "match_not_found" });

    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "text_required" });
    if (text.length > MAX_TEXT) return res.status(400).json({ error: "text_too_long" });

    const info = db
      .prepare("INSERT INTO match_messages (match_id, user_id, text) VALUES (?, ?, ?)")
      .run(matchId, req.user.id, text);

    const message = db
      .prepare(
        `
        SELECT mm.id, mm.match_id, mm.text, mm.created_at,
               u.id AS user_id, u.username, u.first_name, u.last_name, u.photo_url
        FROM match_messages mm
        JOIN users u ON u.id = mm.user_id
        WHERE mm.id = ?
        `
      )
      .get(info.lastInsertRowid);

    return res.status(201).json({ message });
  });

  return router;
}
