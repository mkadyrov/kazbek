import express from "express";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";

export function statsRoutes({ db }) {
  const router = express.Router();

  // Only match creators can view stats
  function requireCreator(req, res, next) {
    const allowed = config.matchCreators
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(req.user.username.toLowerCase())) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  }

  // GET /api/stats/daily — commission & volume per day (last 60 days)
  router.get("/daily", requireAuth, requireCreator, (req, res) => {
    const days = db
      .prepare(
        `
        SELECT
          date(b.created_at)              AS day,
          COUNT(*)                        AS bets_total,
          SUM(CASE WHEN b.bet_status = 'matched'   THEN 1 ELSE 0 END) AS bets_matched,
          SUM(CASE WHEN b.bet_status = 'pending'   THEN 1 ELSE 0 END) AS bets_pending,
          SUM(CASE WHEN b.bet_status = 'cancelled' THEN 1 ELSE 0 END) AS bets_cancelled,
          COALESCE(SUM(b.amount_tenge),       0)  AS volume_tenge,
          COALESCE(SUM(b.commission_tenge),   0)  AS commission_tenge
        FROM bets b
        WHERE b.bet_status != 'cancelled'
        GROUP BY date(b.created_at)
        ORDER BY day DESC
        LIMIT 60
        `
      )
      .all();

    // overall totals
    const totals = db
      .prepare(
        `
        SELECT
          COUNT(*)                       AS bets_total,
          COALESCE(SUM(amount_tenge),    0) AS volume_tenge,
          COALESCE(SUM(commission_tenge),0) AS commission_tenge
        FROM bets
        WHERE bet_status != 'cancelled'
        `
      )
      .get();

    return res.json({ days, totals });
  });

  return router;
}
