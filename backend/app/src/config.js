export const config = {
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  dbPath: process.env.DB_PATH || "./data/app.db",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  // comma-separated usernames allowed to create matches; empty = everyone
  matchCreators: process.env.MATCH_CREATORS || "kazbek,maxat,nur_asan1701",
};
