import express from "express";

export function usersRoutes({ db }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const q = String(req.query.q || "").trim();
    let rows;
    if (q) {
      const like = `%${q}%`;
      rows = db
        .prepare(
          `
          SELECT id, username, first_name, last_name, rating, photo_url
          FROM users
          WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ?
          ORDER BY rating DESC
          LIMIT 30
          `
        )
        .all(like, like, like);
    } else {
      rows = db
        .prepare(
          `SELECT id, username, first_name, last_name, rating, photo_url FROM users ORDER BY rating DESC LIMIT 50`
        )
        .all();
    }
    return res.json({ users: rows });
  });

  return router;
}
