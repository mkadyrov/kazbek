import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function openDb() {
  ensureParentDir(config.dbPath);
  const db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      rating INTEGER NOT NULL DEFAULT 1000,
      photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by_user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      location TEXT,
      start_time TEXT NOT NULL,
      notes TEXT,
      odds_a REAL NOT NULL DEFAULT 2.0,
      odds_b REAL NOT NULL DEFAULT 2.0,
      winner TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS match_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      team TEXT NOT NULL,
      slot INTEGER NOT NULL,
      UNIQUE(match_id, team, slot),
      UNIQUE(match_id, user_id),
      FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // safe column additions for matches
  for (const sql of [
    "ALTER TABLE matches ADD COLUMN odds_a REAL NOT NULL DEFAULT 2.0",
    "ALTER TABLE matches ADD COLUMN odds_b REAL NOT NULL DEFAULT 2.0",
    "ALTER TABLE matches ADD COLUMN winner TEXT",
  ]) {
    try { db.exec(sql); } catch { /* already exists */ }
  }

  // migrate bets table: check if new schema exists, recreate if needed
  const betCols = db.prepare("PRAGMA table_info(bets)").all().map((c) => c.name);
  if (!betCols.includes("bet_status")) {
    // disable FK to allow drop
    db.pragma("foreign_keys = OFF");
    db.exec(`
      DROP TABLE IF EXISTS bets;
      CREATE TABLE bets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id    INTEGER NOT NULL,
        user_id     INTEGER NOT NULL,
        side        TEXT NOT NULL,
        amount_tenge INTEGER NOT NULL DEFAULT 0,
        bet_status  TEXT NOT NULL DEFAULT 'pending',
        matched_bet_id INTEGER,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id)  REFERENCES users(id)  ON DELETE CASCADE
      );
    `);
    db.pragma("foreign_keys = ON");
  }
}
