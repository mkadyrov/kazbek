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
  // Create tables only if they don't exist — never drops or truncates
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      rating REAL NOT NULL DEFAULT 4.0,
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
      FOREIGN KEY(created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS match_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      team TEXT NOT NULL,
      slot INTEGER NOT NULL,
      UNIQUE(match_id, team, slot),
      UNIQUE(match_id, user_id),
      FOREIGN KEY(match_id) REFERENCES matches(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Safe additive-only column migrations — never drops anything
  for (const sql of [
    "ALTER TABLE matches ADD COLUMN odds_a REAL NOT NULL DEFAULT 2.0",
    "ALTER TABLE matches ADD COLUMN odds_b REAL NOT NULL DEFAULT 2.0",
    "ALTER TABLE matches ADD COLUMN winner TEXT",
    // SQLite stores 3.75 fine in an INTEGER column due to type affinity,
    // so no column type change needed — just ensure the column exists
  ]) {
    try { db.exec(sql); } catch { /* column already exists, safe to ignore */ }
  }

  // add commission column to bets — safe, additive only
  try { db.exec("ALTER TABLE bets ADD COLUMN commission_tenge INTEGER NOT NULL DEFAULT 0"); } catch { /* exists */ }

  // bets table: add new columns if missing (never drops rows or the table)
  const betCols = db.prepare("PRAGMA table_info(bets)").all().map((c) => c.name);

  if (!betCols.includes("bet_status")) {
    // First deploy after schema change: recreate only if table had no real data
    // (old table had amount_cents and UNIQUE constraint — not compatible)
    const rowCount = betCols.length > 0
      ? db.prepare("SELECT COUNT(*) AS n FROM bets").get().n
      : 0;

    if (rowCount === 0) {
      // Safe to recreate — no data to lose
      db.pragma("foreign_keys = OFF");
      db.exec(`
        DROP TABLE IF EXISTS bets;
        CREATE TABLE IF NOT EXISTS bets (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          match_id       INTEGER NOT NULL,
          user_id        INTEGER NOT NULL,
          side           TEXT NOT NULL,
          amount_tenge   INTEGER NOT NULL DEFAULT 0,
          bet_status     TEXT NOT NULL DEFAULT 'pending',
          matched_bet_id INTEGER,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(match_id) REFERENCES matches(id),
          FOREIGN KEY(user_id)  REFERENCES users(id)
        );
      `);
      db.pragma("foreign_keys = ON");
    } else {
      // Has live data — add columns safely instead of recreating
      for (const sql of [
        "ALTER TABLE bets ADD COLUMN amount_tenge INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE bets ADD COLUMN bet_status TEXT NOT NULL DEFAULT 'pending'",
        "ALTER TABLE bets ADD COLUMN matched_bet_id INTEGER",
      ]) {
        try { db.exec(sql); } catch { /* already exists */ }
      }
    }
  }
}
