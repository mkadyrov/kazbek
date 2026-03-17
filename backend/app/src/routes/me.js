import express from "express";
import { requireAuth } from "../auth.js";

export function meRoutes({ db }) {
  const router = express.Router();

  router.get("/", requireAuth, (req, res) => {
    const user = db
      .prepare(
        "SELECT id, username, first_name, last_name, rating, photo_url, created_at FROM users WHERE id=?"
      )
      .get(req.user.id);
    return res.json({ user });
  });

  router.put("/", requireAuth, (req, res) => {
    const { first_name, last_name, rating, photo_url } = req.body || {};
    const nextRating =
      rating === undefined || rating === null ? undefined : Number(rating);
    if (nextRating !== undefined && (!Number.isFinite(nextRating) || nextRating < 0)) {
      return res.status(400).json({ error: "invalid_rating" });
    }

    db.prepare(
      `
      UPDATE users
      SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        rating = COALESCE(?, rating),
        photo_url = COALESCE(?, photo_url)
      WHERE id=?
      `
    ).run(
      first_name ?? null,
      last_name ?? null,
      nextRating ?? null,
      photo_url ?? null,
      req.user.id
    );

    const user = db
      .prepare(
        "SELECT id, username, first_name, last_name, rating, photo_url, created_at FROM users WHERE id=?"
      )
      .get(req.user.id);
    return res.json({ user });
  });

  return router;
}

