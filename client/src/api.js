const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

export function getToken() {
  return localStorage.getItem("token") || "";
}

export function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || "request_failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  register: (username, password) =>
    request("/api/auth/register", { method: "POST", body: { username, password } }),
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: { username, password } }),

  me: () => request("/api/me", { auth: true }),
  updateMe: (patch) => request("/api/me", { method: "PUT", auth: true, body: patch }),

  listMatches: () => request("/api/matches"),
  getMatch: (id) => request(`/api/matches/${id}`),
  createMatch: (payload) => request("/api/matches", { method: "POST", auth: true, body: payload }),
  updateMatch: (id, payload) =>
    request(`/api/matches/${id}`, { method: "PATCH", auth: true, body: payload }),
  setMatchStatus: (id, status) =>
    request(`/api/matches/${id}/status`, { method: "PATCH", auth: true, body: { status } }),
  setScore: (id, score) =>
    request(`/api/matches/${id}/score`, { method: "PATCH", auth: true, body: { score } }),

  setWinner: (id, winner) =>
    request(`/api/matches/${id}/winner`, { method: "PATCH", auth: true, body: { winner } }),
  updateOdds: (id, odds_a, odds_b) =>
    request(`/api/matches/${id}/odds`, { method: "PATCH", auth: true, body: { odds_a, odds_b } }),

  placeBet: (payload) => request("/api/bets", { method: "POST", auth: true, body: payload }),
  cancelBet: (id) => request(`/api/bets/${id}`, { method: "DELETE", auth: true }),

  getMessages: (matchId, since = 0) =>
    request(`/api/matches/${matchId}/messages${since ? `?since=${since}` : ""}`),
  sendMessage: (matchId, text) =>
    request(`/api/matches/${matchId}/messages`, { method: "POST", auth: true, body: { text } }),

  listUsers: (q) => request(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getPlayerStats: () => request("/api/stats/players"),
  getDailyStats: () => request("/api/stats/daily", { auth: true }),

  uploadAvatar: async (file) => {
    const t = getToken();
    const form = new FormData();
    form.append("photo", file);
    const res = await fetch(`${API_BASE}/api/upload/avatar`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: form,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(data?.error || "upload_failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
};

