import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";

// ensure upload dir exists
fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, config.uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name = crypto.randomBytes(12).toString("hex") + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("only_images"));
    }
    cb(null, true);
  },
});

export function uploadRoutes({ db }) {
  const router = express.Router();

  router.post("/avatar", requireAuth, (req, res) => {
    upload.single("photo")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "upload_failed" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "no_file" });
      }

      const url = `/uploads/${req.file.filename}`;
      db.prepare("UPDATE users SET photo_url=? WHERE id=?").run(url, req.user.id);

      const user = db
        .prepare("SELECT id, username, first_name, last_name, rating, photo_url, created_at FROM users WHERE id=?")
        .get(req.user.id);
      return res.json({ url, user });
    });
  });

  return router;
}
