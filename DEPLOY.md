# Deployment Guide

## Architecture

- **Frontend** → [Vercel](https://vercel.com) (static Vite build)
- **Backend** → [Railway](https://railway.app) (Node.js + SQLite with persistent volume)

---

## 1. Backend → Railway

### Steps

1. Push this repo to GitHub (if not done yet):
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   gh repo create kazbek-bet --public --push
   ```

2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**

3. Select the repo, then set the **Root Directory** to `backend/app`

4. Add a **Volume** in Railway (for persistent SQLite + uploads):
   - Go to your service → **Volumes** → Add volume, mount at `/data`

5. Set these **Environment Variables** in Railway:
   | Variable      | Value                        |
   |---------------|------------------------------|
   | `JWT_SECRET`  | (generate a strong random string) |
   | `DB_PATH`     | `/data/app.db`               |
   | `UPLOAD_DIR`  | `/data/uploads`              |
   | `CORS_ORIGIN` | `https://your-app.vercel.app` (set after Vercel deploy) |

6. Deploy — Railway will auto-detect Node.js and run `node src/index.js`

7. Note your Railway URL (e.g. `https://kazbek-bet-backend.railway.app`)

---

## 2. Frontend → Vercel

### Steps

1. Go to [vercel.com](https://vercel.com) → **New Project** → Import from GitHub

2. Vercel will auto-detect `vercel.json` at the root. No extra config needed.

3. Add **Environment Variable**:
   | Variable        | Value                                      |
   |-----------------|--------------------------------------------|
   | `VITE_API_BASE` | `https://kazbek-bet-backend.railway.app`   |

4. Deploy → your frontend is live!

5. Copy the Vercel URL and go back to Railway to set `CORS_ORIGIN` to that URL.

---

## Local Development

```bash
# Backend
cd backend/app
npm install
npm run dev   # runs on http://localhost:3001

# Frontend (in a new terminal)
cd client
npm install
npm run dev   # runs on http://localhost:5173
```
