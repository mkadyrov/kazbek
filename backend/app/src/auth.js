import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: "7d" }
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
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

