import express from "express";
import cors from "cors";
import { openDb, migrate } from "./db.js";
import { config } from "./config.js";
import { setAuthDb } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { matchesRoutes } from "./routes/matches.js";
import { betsRoutes } from "./routes/bets.js";
import { usersRoutes } from "./routes/users.js";
import { uploadRoutes } from "./routes/upload.js";

const app = express();
app.use(cors({
  origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(config.uploadDir));

const db = openDb();
migrate(db);
setAuthDb(db);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes({ db }));
app.use("/api/me", meRoutes({ db }));
app.use("/api/matches", matchesRoutes({ db }));
app.use("/api/bets", betsRoutes({ db }));
app.use("/api/users", usersRoutes({ db }));
app.use("/api/upload", uploadRoutes({ db }));

app.use((_req, res) => res.status(404).json({ error: "not_found" }));

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${config.port}`);
});

