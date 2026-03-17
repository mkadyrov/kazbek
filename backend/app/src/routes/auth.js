import express from "express";
import bcrypt from "bcryptjs";
import { signToken } from "../auth.js";

export function authRoutes({ db }) {
  const router = express.Router();

  router.post("/register", (req, res) => {
    const { username, password } = req.body || {};
    const cleanUsername = String(username || "").trim().toLowerCase();
    if (!cleanUsername || !password || String(password).length < 6) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const passwordHash = bcrypt.hashSync(String(password), 10);
    try {
      const stmt = db.prepare(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)"
      );
      const info = stmt.run(cleanUsername, passwordHash);
      const user = db
        .prepare(
          "SELECT id, username, first_name, last_name, rating, photo_url, created_at FROM users WHERE id=?"
        )
        .get(info.lastInsertRowid);
      const token = signToken(user);
      return res.json({ token, user });
    } catch (e) {
      if (String(e?.message || "").includes("UNIQUE")) {
        return res.status(409).json({ error: "username_taken" });
      }
      return res.status(500).json({ error: "server_error" });
    }
  });

  router.post("/login", (req, res) => {
    const { username, password } = req.body || {};
    const cleanUsername = String(username || "").trim().toLowerCase();
    if (!cleanUsername || !password) {
      return res.status(400).json({ error: "invalid_input" });
    }

    const row = db
      .prepare("SELECT * FROM users WHERE username=?")
      .get(cleanUsername);
    if (!row) return res.status(401).json({ error: "invalid_credentials" });

    const ok = bcrypt.compareSync(String(password), row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const user = {
      id: row.id,
      username: row.username,
      first_name: row.first_name,
      last_name: row.last_name,
      rating: row.rating,
      photo_url: row.photo_url,
      created_at: row.created_at,
    };
    const token = signToken(user);
    return res.json({ token, user });
  });

  return router;
}

