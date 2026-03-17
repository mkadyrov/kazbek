import jwt from "jsonwebtoken";
import { config } from "./config.js";

// set by index.js after DB is opened — used to verify tokens against live DB
let _db = null;
export function setAuthDb(db) { _db = db; }

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: "30d" }
  );
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const [kind, token] = h.split(" ");
  if (kind !== "Bearer" || !token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);

    // Always verify the user still exists in the DB with the same username.
    // This prevents:
    //   • Forged tokens (wrong sub/username)
    //   • Stale tokens reused after a DB reset (ID reuse attack)
    if (!_db) return res.status(500).json({ error: "server_error" });

    const dbUser = _db
      .prepare("SELECT id, username FROM users WHERE id=?")
      .get(payload.sub);

    if (!dbUser || dbUser.username !== payload.username) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.user = { id: dbUser.id, username: dbUser.username };
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}
