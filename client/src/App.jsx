import { NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { api } from "./api.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

function resolvePhoto(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

/* ─────────────────────────── helpers ─────────────────── */
function displayName(u) {
  if (!u) return "—";
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return full || u.username;
}

function teamLabel(players, team) {
  const pp = players.filter((p) => p.team === team);
  if (!pp.length) return team === "A" ? "Команда A" : "Команда B";
  return pp.map(displayName).join(" & ");
}

function fmt(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_COLOR = {
  open: "#22c55e",
  locked: "#f59e0b",
  finished: "#a78bfa",
  cancelled: "#ef4444",
};

const STATUS_RU = {
  open: "Открыт",
  locked: "Закрыт",
  finished: "Завершён",
  cancelled: "Отменён",
};

const STATUS_BTN_RU = {
  open: "Открыть ставки",
  locked: "Закрыть ставки",
  cancelled: "Отменить матч",
};

const MATCH_CREATORS = ["kazbek", "maxat", "nur_asan1701"];
function canCreate(user) {
  return user && MATCH_CREATORS.includes(user.username?.toLowerCase());
}

// iOS uses comma as decimal separator — normalise before parsing
function parseDecimal(val) {
  return parseFloat(String(val).replace(",", "."));
}

/* ──────────────────── PlayerPicker ───────────────────── */
function PlayerPicker({ label, selected, onChange, disabledIds = [] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const search = useCallback(async (q) => {
    try {
      const data = await api.listUsers(q);
      setResults(data.users || []);
    } catch { setResults([]); }
  }, []);

  useEffect(() => { search(query); }, [query, search]);

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="field" ref={ref} style={{ position: "relative" }}>
      <label>{label}</label>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minHeight: 34, marginBottom: 6 }}>
        {selected.map((u) => (
          <div key={u.id} className="chip">
            <Avatar user={u} size={20} />
            {displayName(u)}
            <span className="chip-x" onClick={() => onChange(selected.filter((s) => s.id !== u.id))}>✕</span>
          </div>
        ))}
      </div>

      {selected.length < 2 && (
        <input
          placeholder={selected.length === 0 ? "Поиск игрока (необязательно)…" : `Игрок ${selected.length + 1} из 2…`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      )}

      {open && selected.length < 2 && (
        <div className="dropdown">
          {results.filter((u) => !disabledIds.includes(u.id)).map((u) => (
            <div
              key={u.id}
              className="dropdown-item"
              onClick={() => { onChange([...selected, u]); setQuery(""); setOpen(false); }}
            >
              <Avatar user={u} size={28} />
              <div>
                <div style={{ fontSize: 14 }}>{displayName(u)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>@{u.username} · ур. {u.rating}</div>
              </div>
            </div>
          ))}
          {!results.filter((u) => !disabledIds.includes(u.id)).length && (
            <div className="dropdown-empty">Не найдено</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Avatar ─────────────────────── */
function Avatar({ user, size = 32 }) {
  if (!user) return null;
  const letter = (user.first_name || user.username || "?")[0].toUpperCase();
  const src = resolvePhoto(user.photo_url);
  if (src) {
    return <img src={src} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#2a2a3a", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.4, color: "var(--muted)"
    }}>{letter}</div>
  );
}

/* ──────────────────── PlayerSlot ─────────────────────── */
function PlayerSlot({ player, accent }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
      borderRadius: 10, background: player ? `${accent}12` : "#0b0c10",
      border: `1px solid ${player ? accent + "30" : "var(--border)"}`,
    }}>
      {player ? (
        <>
          <Avatar user={player} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayName(player)}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Уровень {player.rating}</div>
          </div>
        </>
      ) : (
        <span style={{ color: "var(--muted)", fontSize: 13 }}>— вакантно —</span>
      )}
    </div>
  );
}

/* ──────────────────────── Topbar ─────────────────────── */
function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <NavLink to="/" className="brand">
        <img src="/logo.png" alt="Paddle Bets" className="brand-logo" />
      </NavLink>
      <nav className="topnav">
        <NavLink to="/players" className={({ isActive }) => isActive ? "active" : ""}>Игроки</NavLink>
        {canCreate(user) && <NavLink to="/stats" className={({ isActive }) => isActive ? "active" : ""}>Статистика</NavLink>}
        {user ? (
          <>
            {canCreate(user) && <NavLink to="/create" className={({ isActive }) => isActive ? "active" : ""}>+ Создать</NavLink>}
            <NavLink to="/profile" className={({ isActive }) => isActive ? "active" : ""}><Avatar user={user} size={28} /></NavLink>
            <button className="secondary small" onClick={logout}>Выйти</button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={({ isActive }) => isActive ? "active" : ""}>Вход</NavLink>
            <NavLink to="/register" className={({ isActive }) => isActive ? "active" : ""}>Регистрация</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}

/* ──────────────────────── BottomNav (mobile) ─────────── */
function BottomNav() {
  const { user } = useAuth();
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? "bnav-item active" : "bnav-item"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        <span>Матчи</span>
      </NavLink>
      <NavLink to="/players" className={({ isActive }) => isActive ? "bnav-item active" : "bnav-item"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Игроки</span>
      </NavLink>
      {canCreate(user) && (
        <NavLink to="/create" className={({ isActive }) => isActive ? "bnav-item active" : "bnav-item"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <span>Создать</span>
        </NavLink>
      )}
      {canCreate(user) && (
        <NavLink to="/stats" className={({ isActive }) => isActive ? "bnav-item active" : "bnav-item"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <span>Статистика</span>
        </NavLink>
      )}
      {user ? (
        <NavLink to="/profile" className={({ isActive }) => isActive ? "bnav-item active" : "bnav-item"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Профиль</span>
        </NavLink>
      ) : (
        <NavLink to="/login" className={({ isActive }) => isActive ? "bnav-item active" : "bnav-item"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          <span>Войти</span>
        </NavLink>
      )}
    </nav>
  );
}

function Page({ title, children, back }) {
  const nav = useNavigate();
  return (
    <div className="page">
      {title && (
        <div className="page-header">
          {back && (
            <button className="back-btn" onClick={() => nav(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <h1 className="page-title">{title}</h1>
        </div>
      )}
      {children}
    </div>
  );
}

/* ──────────────────────── LoginPage ─────────────────── */
function LoginPage() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { const d = await api.login(username, password); setAuth(d.token, d.user); nav("/"); }
    catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  return (
    <Page title="Вход">
      <div className="form-card">
        <form onSubmit={onSubmit} className="vstack">
          <div className="field"><label>Логин</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></div>
          <div className="field"><label>Пароль</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" /></div>
          {error && <div className="error">{error}</div>}
          <button disabled={busy} type="submit" className="btn-primary">Войти</button>
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            Нет аккаунта? <NavLink to="/register" style={{ color: "var(--accent-light)" }}>Регистрация</NavLink>
          </div>
        </form>
      </div>
    </Page>
  );
}

/* ─────────────────────── RegisterPage ───────────────── */
function RegisterPage() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { const d = await api.register(username, password); setAuth(d.token, d.user); nav("/profile"); }
    catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  return (
    <Page title="Регистрация">
      <div className="form-card">
        <form onSubmit={onSubmit} className="vstack">
          <div className="field"><label>Логин</label><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></div>
          <div className="field"><label>Пароль (мин. 6)</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" /></div>
          {error && <div className="error">{error}</div>}
          <button disabled={busy} type="submit" className="btn-primary">Создать аккаунт</button>
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
            Уже есть аккаунт? <NavLink to="/login" style={{ color: "var(--accent-light)" }}>Войти</NavLink>
          </div>
        </form>
      </div>
    </Page>
  );
}

/* ─────────────────────── ProfilePage ────────────────── */
function ProfilePage() {
  const { user, refreshMe, logout } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", rating: 4.0 });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setForm({ first_name: user.first_name || "", last_name: user.last_name || "", rating: user.rating ?? 4.0 });
  }, [user]);

  async function onSave() {
    setError(""); setSaved(false); setBusy(true);
    try {
      await api.updateMe({ first_name: form.first_name || null, last_name: form.last_name || null, rating: parseDecimal(form.rating) });
      await refreshMe(); setSaved(true);
    } catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(""); setUploadBusy(true);
    try {
      await api.uploadAvatar(file);
      await refreshMe();
    } catch (e2) { setUploadError(e2?.data?.error || e2.message); }
    finally { setUploadBusy(false); e.target.value = ""; }
  }

  if (!user) return <Page title="Профиль"><div className="panel">Нужно войти.</div></Page>;

  return (
    <Page title="Профиль">
      <div className="form-card" style={{ marginBottom: 100 }}>
        {/* avatar upload */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div
            className="avatar-upload-wrap"
            onClick={() => fileRef.current?.click()}
            title="Нажмите чтобы загрузить фото"
          >
            <Avatar user={user} size={80} />
            <div className="avatar-upload-overlay">{uploadBusy ? "…" : "📷"}</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
          <div style={{ fontWeight: 650, fontSize: 16 }}>{displayName(user)}</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>@{user.username}</div>
          {uploadError && <div className="error">{uploadError}</div>}
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Нажмите на фото чтобы изменить</div>
        </div>

        <div className="vstack">
          <div className="hstack">
            <div className="field"><label>Имя</label><input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></div>
            <div className="field"><label>Фамилия</label><input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></div>
          </div>
          <div className="field">
            <label>Уровень (напр. 3.5, 3.75, 4.0)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.rating}
              onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              placeholder="4.0"
            />
          </div>
          {error && <div className="error">{error}</div>}
          {saved && <div style={{ color: "#22c55e", fontSize: 14, textAlign: "center" }}>Сохранено ✓</div>}
          <button disabled={busy} onClick={onSave} className="btn-primary">Сохранить</button>
          <button className="secondary" onClick={logout}>Выйти из аккаунта</button>
        </div>
      </div>
    </Page>
  );
}

/* ────────────────────── MatchesPage ─────────────────── */
const FILTER_TABS = [
  { id: "all",      label: "Все" },
  { id: "active",   label: "Активные" },
  { id: "finished", label: "Завершённые" },
];

const ACTIVE_STATUSES   = new Set(["open", "locked"]);
const FINISHED_STATUSES = new Set(["finished", "cancelled"]);

function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.listMatches().then((d) => setMatches(d.matches || [])).catch((e) => setError(e?.data?.error || e.message));
  }, []);

  const filtered = matches.filter((m) => {
    if (filter === "active")   return ACTIVE_STATUSES.has(m.status);
    if (filter === "finished") return FINISHED_STATUSES.has(m.status);
    return true;
  });

  return (
    <Page title="Матчи">
      {error && <div className="error">{error}</div>}
      <div className="filter-tabs">
        {FILTER_TABS.map((t) => (
          <button
            key={t.id}
            className={`filter-tab${filter === t.id ? " active" : ""}`}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="list">
        {filtered.map((m) => {
          const teamA = (m.players || []).filter((p) => p.team === "A");
          const teamB = (m.players || []).filter((p) => p.team === "B");
          const labelA = teamA.map(displayName).join(" & ") || "—";
          const labelB = teamB.map(displayName).join(" & ") || "—";
          const sc = STATUS_COLOR[m.status] || "var(--muted)";
          return (
            <NavLink key={m.id} to={`/match/${m.id}`} className="match-card">
              <div className="match-card-head">
                <span className="match-title">{m.title}</span>
                <span className="status-pill" style={{ color: sc, borderColor: sc + "40" }}>{STATUS_RU[m.status] || m.status}</span>
              </div>
              <div className="match-meta">{fmt(m.start_time)}{m.location ? ` · ${m.location}` : ""}</div>
              <div className="vs-row">
                <div className="vs-team left">
                  {teamA.slice(0, 2).map((p) => <Avatar key={p.id} user={p} size={22} />)}
                  <span>{labelA}</span>
                </div>
                <div className={`vs-badge${m.score ? " has-score" : ""}`}>
                  {m.score || "VS"}
                </div>
                <div className="vs-team right">
                  <span>{labelB}</span>
                  {teamB.slice(0, 2).map((p) => <Avatar key={p.id} user={p} size={22} />)}
                </div>
              </div>
              {m.winner && (
                <div className="winner-banner">
                  🏆 Победитель: {m.winner === "A" ? labelA : labelB}
                </div>
              )}
              <div className="match-footer">
                {m.prize_tenge > 0 && (
                  <span className="prize-badge">🏅 {m.prize_tenge.toLocaleString("ru-RU")} ₸</span>
                )}
                <span>Пул: {(m.total_pool_tenge || 0).toLocaleString("ru-RU")} ₸</span>
                <span>{m.matched_pairs_count || 0} пар</span>
                {m.pending_bets_count > 0 && <span style={{ color: "#f59e0b" }}>{m.pending_bets_count} ожидают</span>}
                <span>×{m.odds_a} / ×{m.odds_b}</span>
              </div>
            </NavLink>
          );
        })}
        {filtered.length === 0 && <div className="empty">Матчей пока нет</div>}
      </div>
    </Page>
  );
}

/* ────────────────────── CreateMatchPage ─────────────── */
function CreateMatchPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ title: "", location: "", start_time: "", notes: "", odds_a: "2.00", odds_b: "2.00", prize: "" });
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const allSelected = useMemo(() => [...teamA, ...teamB].map((u) => u.id), [teamA, teamB]);
  const labelA = teamA.map(displayName).join(" & ") || "Команда A";
  const labelB = teamB.map(displayName).join(" & ") || "Команда B";

  async function onSubmit(e) {
    e.preventDefault();
    const oa = parseDecimal(form.odds_a); const ob = parseDecimal(form.odds_b);
    if (!oa || !ob || oa < 1.01 || ob < 1.01) { setError("Коэффициенты должны быть ≥ 1.01"); return; }
    setError(""); setBusy(true);
    try {
      const data = await api.createMatch({
        title: form.title, location: form.location || null,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        notes: form.notes || null,
        team_a: teamA.map((u) => u.id), team_b: teamB.map((u) => u.id),
        odds_a: oa, odds_b: ob,
        prize_tenge: form.prize ? Math.floor(parseDecimal(form.prize)) || null : null,
      });
      nav(`/match/${data.match.id}`);
    } catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  if (!user) return <Page title="Создать матч"><div className="panel">Нужно войти.</div></Page>;
  if (!canCreate(user)) return <Page title="Создать матч"><div className="empty" style={{ marginTop: 40 }}>У вас нет прав для создания матчей.</div></Page>;

  return (
    <Page title="Создать матч">
      <form onSubmit={onSubmit} className="vstack" style={{ padding: "0 0 100px" }}>
        {/* basic info */}
        <div className="section-card">
          <div className="section-title">Основное</div>
          <div className="vstack tight">
            <div className="field"><label>Название</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Финал клубного турнира" /></div>
            <div className="field"><label>Локация</label><input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Клуб / корт" /></div>
            <div className="field"><label>Дата и время</label><input type="datetime-local" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
            <div className="field">
              <label>Призовой фонд, ₸ <span style={{ fontWeight: 400, color: "var(--muted)" }}>(сумма на которую играют)</span></label>
              <input type="text" inputMode="numeric" value={form.prize} onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} placeholder="50 000" />
            </div>
            <div className="field"><label>Заметки</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
        </div>

        {/* teams */}
        <div className="section-card">
          <div className="section-title">Команды</div>
          <div className="teams-grid">
            <div className="team-block team-a">
              <div className="team-header"><span className="team-dot a" />Команда A</div>
              <PlayerPicker label="" selected={teamA} onChange={setTeamA} disabledIds={allSelected.filter((id) => !teamA.map((u) => u.id).includes(id))} />
            </div>
            <div className="team-block team-b">
              <div className="team-header"><span className="team-dot b" />Команда B</div>
              <PlayerPicker label="" selected={teamB} onChange={setTeamB} disabledIds={allSelected.filter((id) => !teamB.map((u) => u.id).includes(id))} />
            </div>
          </div>
        </div>

        {/* odds */}
        <div className="section-card">
          <div className="section-title">Коэффициенты (коэф. × ставка = выигрыш)</div>
          <div className="hstack">
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span className="team-dot a" />{labelA}</label>
              <input type="text" inputMode="decimal" value={form.odds_a} onChange={(e) => setForm((f) => ({ ...f, odds_a: e.target.value }))} placeholder="2.00" />
            </div>
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span className="team-dot b" />{labelB}</label>
              <input type="text" inputMode="decimal" value={form.odds_b} onChange={(e) => setForm((f) => ({ ...f, odds_b: e.target.value }))} placeholder="2.00" />
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <button disabled={busy} type="submit" className="btn-primary">
          Создать матч
        </button>
      </form>
    </Page>
  );
}


/* ────────────────────── EditMatchPage ───────────────── */
function toDatetimeLocal(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditMatchPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const nav = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", location: "", start_time: "", notes: "", odds_a: "2.00", odds_b: "2.00", score: "", prize: "" });
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const allSelected = useMemo(() => [...teamA, ...teamB].map((u) => u.id), [teamA, teamB]);
  const labelA = teamA.map(displayName).join(" & ") || "Команда A";
  const labelB = teamB.map(displayName).join(" & ") || "Команда B";

  useEffect(() => {
    api.getMatch(matchId)
      .then((d) => {
        const m = d.match;
        setForm({
          title:      m.title || "",
          location:   m.location || "",
          start_time: toDatetimeLocal(m.start_time),
          notes:      m.notes || "",
          odds_a:     String(m.odds_a ?? "2.00"),
          odds_b:     String(m.odds_b ?? "2.00"),
          score:      m.score || "",
          prize:      m.prize_tenge ? String(m.prize_tenge) : "",
        });
        const players = d.players || [];
        setTeamA(players.filter((p) => p.team === "A"));
        setTeamB(players.filter((p) => p.team === "B"));
        setLoading(false);
      })
      .catch((e) => { setError(e?.data?.error || e.message); setLoading(false); });
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e) {
    e.preventDefault();
    const oa = parseDecimal(form.odds_a);
    const ob = parseDecimal(form.odds_b);
    if (!oa || !ob || oa < 1.01 || ob < 1.01) { setError("Коэффициенты должны быть ≥ 1.01"); return; }
    setError(""); setBusy(true);
    try {
      await api.updateMatch(matchId, {
        title:      form.title,
        location:   form.location || null,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        notes:      form.notes || null,
        team_a:     teamA.map((u) => u.id),
        team_b:     teamB.map((u) => u.id),
        odds_a:     oa,
        odds_b:     ob,
        score:      form.score || null,
        prize_tenge: form.prize ? Math.floor(parseDecimal(form.prize)) || null : null,
      });
      nav(`/match/${matchId}`);
    } catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  if (!user || !canCreate(user)) {
    return <Page title="Редактировать матч" back><div className="empty" style={{ marginTop: 40 }}>Нет доступа.</div></Page>;
  }

  if (loading) {
    return <Page title="Редактировать матч" back><div className="empty">Загрузка…</div></Page>;
  }

  return (
    <Page title="Редактировать матч" back>
      <form onSubmit={onSubmit} className="vstack" style={{ padding: "0 0 100px" }}>
        <div className="section-card">
          <div className="section-title">Основное</div>
          <div className="vstack tight">
            <div className="field"><label>Название</label><input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Финал клубного турнира" /></div>
            <div className="field"><label>Локация</label><input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Клуб / корт" /></div>
            <div className="field"><label>Дата и время</label><input required type="datetime-local" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
            <div className="field">
              <label>Призовой фонд, ₸ <span style={{ fontWeight: 400, color: "var(--muted)" }}>(сумма на которую играют)</span></label>
              <input type="text" inputMode="numeric" value={form.prize} onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} placeholder="50 000" />
            </div>
            <div className="field"><label>Счёт (необязательно, например: 6:4)</label><input value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} placeholder="6:4" maxLength={30} /></div>
            <div className="field"><label>Заметки</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">Команды</div>
          <div className="teams-grid">
            <div className="team-block team-a">
              <div className="team-header"><span className="team-dot a" />Команда A</div>
              <PlayerPicker label="" selected={teamA} onChange={setTeamA} disabledIds={allSelected.filter((id) => !teamA.map((u) => u.id).includes(id))} />
            </div>
            <div className="team-block team-b">
              <div className="team-header"><span className="team-dot b" />Команда B</div>
              <PlayerPicker label="" selected={teamB} onChange={setTeamB} disabledIds={allSelected.filter((id) => !teamB.map((u) => u.id).includes(id))} />
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-title">Коэффициенты</div>
          <div className="hstack">
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span className="team-dot a" />{labelA}</label>
              <input type="text" inputMode="decimal" value={form.odds_a} onChange={(e) => setForm((f) => ({ ...f, odds_a: e.target.value }))} placeholder="2.00" />
            </div>
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span className="team-dot b" />{labelB}</label>
              <input type="text" inputMode="decimal" value={form.odds_b} onChange={(e) => setForm((f) => ({ ...f, odds_b: e.target.value }))} placeholder="2.00" />
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="hstack">
          <button disabled={busy} type="submit" className="btn-primary" style={{ flex: 1 }}>
            Сохранить изменения
          </button>
          <button type="button" className="secondary" onClick={() => nav(`/match/${matchId}`)}>
            Отмена
          </button>
        </div>
      </form>
    </Page>
  );
}

/* ──────────────── PendingBetsSection ───────────────── */
function PendingBetsSection({ pendingBets, matchId, labelA, labelB, match, user, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [accepting, setAccepting] = useState(null);

  async function doAccept(opposing) {
    setErr(""); setBusy(true);
    try {
      await api.placeBet({ match_id: matchId, side: opposing.side === "A" ? "B" : "A", amount_tenge: 0, against_bet_id: opposing.id });
      setAccepting(null); onDone();
    } catch (e) { setErr(e?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  async function cancelBet(betId) {
    setErr(""); setBusy(true);
    try { await api.cancelBet(betId); onDone(); }
    catch (e) { setErr(e?.data?.error || e.message); }
    finally { setBusy(false); }
  }

  if (pendingBets.length === 0) {
    return <div className="empty" style={{ padding: "8px 0" }}>Открытых вызовов нет</div>;
  }

  return (
    <div className="vstack tight">
      {err && <div className="error">{err}</div>}
      {pendingBets.map((b) => {
        const isOwn = user && b.user_id === user.id;
        const myTeamLabel = b.side === "A" ? labelA : labelB;
        const oppoLabel  = b.side === "A" ? labelB : labelA;
        const odds = b.side === "A" ? match.odds_a : match.odds_b;
        const counterAmt = Math.max(1, Math.round(b.amount_tenge * (odds - 1)));
        const myCommission = Math.floor(counterAmt * 0.05);
        const theirCommission = b.commission_tenge || Math.floor(b.amount_tenge * 0.05);
        const pot = b.amount_tenge + counterAmt;
        const netPayout = pot - myCommission - theirCommission;
        const isConfirming = accepting?.id === b.id;

        return (
          <div key={b.id} className={`pending-bet-row${isOwn ? " own" : ""}`}>
            <div className="pending-bet-top">
              <Avatar user={b} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName(b)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  ставит на{" "}
                  <span style={{ color: b.side === "A" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                    {myTeamLabel}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{b.amount_tenge.toLocaleString("ru-RU")} ₸</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>коэф. ×{odds?.toFixed(2)}</div>
              </div>
            </div>

            {isOwn ? (
              <button className="danger small" disabled={busy} onClick={() => cancelBet(b.id)}>
                Отменить вызов
              </button>
            ) : !isConfirming ? (
              <div className="accept-hint">
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Ваша ставка на{" "}
                  <span style={{ color: b.side === "A" ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                    {oppoLabel}
                  </span>
                  : <strong>{counterAmt.toLocaleString("ru-RU")} ₸</strong>
                  {" · "}Выигрыш: <strong style={{ color: "#22c55e" }}>{netPayout.toLocaleString("ru-RU")} ₸</strong>
                  {" · "}<span style={{ color: "#f59e0b" }}>Ком.: −{(myCommission + theirCommission).toLocaleString("ru-RU")} ₸</span>
                </div>
                <button className="btn-accept" disabled={busy} onClick={() => setAccepting(b)}>
                  Принять вызов
                </button>
              </div>
            ) : (
              <div className="confirm-box">
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  Принять вызов? Ваша ставка: <strong>{counterAmt.toLocaleString("ru-RU")} ₸</strong> на {oppoLabel}.<br />
                  Победитель заберёт <strong style={{ color: "#22c55e" }}>{netPayout.toLocaleString("ru-RU")} ₸</strong>
                  {" "}(комиссия 5%: {(myCommission + theirCommission).toLocaleString("ru-RU")} ₸).
                </div>
                <div className="hstack">
                  <button className="btn-primary" disabled={busy} onClick={() => doAccept(b)} style={{ flex: 1 }}>
                    Да, принять
                  </button>
                  <button className="secondary" onClick={() => setAccepting(null)}>Нет</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── NewChallengeWidget ─────────────── */
function NewChallengeWidget({ match, matchId, labelA, labelB, user, onDone }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ side: "A", amount: "1000" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!user) return <div className="empty">Войдите, чтобы участвовать в ставках</div>;
  if (match.status !== "open") return <div className="empty">Приём ставок закрыт</div>;

  const odds = form.side === "A" ? match.odds_a : match.odds_b;
  const stakeAmt = parseDecimal(form.amount) || 0;
  const commission = Math.floor(stakeAmt * 0.05);
  const potWin = odds ? Math.round(stakeAmt * (odds - 1)) : null;

  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    const amt = Math.floor(parseDecimal(form.amount));
    if (!amt || amt < 1) { setErr("Введите сумму"); setBusy(false); return; }
    try {
      await api.placeBet({ match_id: matchId, side: form.side, amount_tenge: amt });
      setOpen(false); onDone();
    } catch (e2) { setErr(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Создать вызов
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="vstack tight">
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Ваш вызов будет виден другим игрокам — они смогут принять его
      </div>
      <div className="bet-side-toggle">
        {[{ side: "A", label: labelA }, { side: "B", label: labelB }].map(({ side, label }) => (
          <button key={side} type="button"
            className={`bet-side-btn${form.side === side ? " active" : ""}`}
            onClick={() => setForm((f) => ({ ...f, side }))}>
            {label}
          </button>
        ))}
      </div>
      <div className="field">
        <label>Сумма вызова, ₸</label>
        <input type="text" inputMode="numeric" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="1000" />
      </div>
      {potWin !== null && stakeAmt > 0 && (
        <div className="payout-preview">
          <div>Выигрыш если победят <strong>{form.side === "A" ? labelA : labelB}</strong>:{" "}
            <strong style={{ color: "#22c55e" }}>{(stakeAmt + potWin - commission).toLocaleString("ru-RU")} ₸</strong>
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: "var(--muted)", display: "flex", gap: 10 }}>
            <span>Ставка: {stakeAmt.toLocaleString("ru-RU")} ₸</span>
            <span>Прибыль: {potWin.toLocaleString("ru-RU")} ₸</span>
            <span style={{ color: "#f59e0b" }}>Комиссия 5%: −{commission.toLocaleString("ru-RU")} ₸</span>
          </div>
        </div>
      )}
      {err && <div className="error">{err}</div>}
      <div className="hstack">
        <button type="submit" disabled={busy} className="btn-primary" style={{ flex: 1 }}>Разместить вызов</button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </form>
  );
}

/* ─────────────── PayoutReport ──────────────────────── */
function PayoutReport({ match, matchedPairs, pendingBets, labelA, labelB }) {
  const winner = match.winner;
  const hasData = matchedPairs.length > 0 || pendingBets.length > 0;
  if (!hasData) return null;

  // Aggregate per user across all pairs/bets
  const userMap = {};
  function ensureUser(bet) {
    const uid = bet.user_id;
    if (!userMap[uid]) {
      userMap[uid] = {
        user: { id: uid, username: bet.username, first_name: bet.first_name, last_name: bet.last_name, photo_url: bet.photo_url },
        matchedStake: 0,
        payout: 0,
        pendingRefund: 0,
      };
    }
    return userMap[uid];
  }

  for (const pair of matchedPairs) {
    const ua = ensureUser(pair.bet_a);
    const ub = ensureUser(pair.bet_b);
    ua.matchedStake += pair.bet_a.amount_tenge;
    ub.matchedStake += pair.bet_b.amount_tenge;
    if (winner === "A") ua.payout += pair.net_payout;
    else if (winner === "B") ub.payout += pair.net_payout;
  }

  for (const bet of pendingBets) {
    ensureUser(bet).pendingRefund += bet.amount_tenge;
  }

  const rows = Object.values(userMap)
    .map((e) => ({
      ...e,
      toPay: e.payout + e.pendingRefund,
      profit: e.payout - e.matchedStake,
    }))
    .sort((a, b) => b.profit - a.profit);

  const totalToPay = rows.reduce((s, r) => s + r.toPay, 0);
  const totalCommission = matchedPairs.reduce((s, p) => s + (p.commission_tenge || 0), 0);

  return (
    <div className="section-card">
      <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Отчёт по выплатам
        {!winner && (
          <span style={{ fontWeight: 400, fontSize: 11, color: "var(--muted)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 6 }}>
            победитель не объявлен
          </span>
        )}
      </div>

      <div className="payout-report">
        {rows.map((r) => {
          const isWin  = !!winner && r.profit > 0;
          const isLose = !!winner && r.profit < 0;
          return (
            <div key={r.user.id} className={`payout-row${isWin ? " win" : isLose ? " lose" : ""}`}>
              <Avatar user={r.user} size={30} />
              <div className="payout-info">
                <div className="payout-name">{displayName(r.user)}</div>
                <div className="payout-sub">
                  ставка: {r.matchedStake.toLocaleString("ru-RU")} ₸
                  {r.pendingRefund > 0 && (
                    <span className="payout-refund-badge">
                      + возврат {r.pendingRefund.toLocaleString("ru-RU")} ₸
                    </span>
                  )}
                </div>
              </div>
              <div className="payout-right">
                {winner ? (
                  <>
                    {r.toPay > 0 && (
                      <div className="payout-receive">
                        {r.toPay.toLocaleString("ru-RU")} ₸
                      </div>
                    )}
                    <div className={`payout-delta${isWin ? " pos" : isLose ? " neg" : ""}`}>
                      {r.profit >= 0
                        ? `+${r.profit.toLocaleString("ru-RU")}`
                        : r.profit.toLocaleString("ru-RU")
                      } ₸
                    </div>
                  </>
                ) : (
                  <div className="payout-receive neutral">
                    {r.matchedStake.toLocaleString("ru-RU")} ₸
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {winner && (
        <div className="payout-total-row">
          <span>Итого к выплате:</span>
          <strong>{totalToPay.toLocaleString("ru-RU")} ₸</strong>
          {totalCommission > 0 && (
            <span style={{ color: "#f59e0b", fontSize: 12, marginLeft: 4 }}>
              (комиссия: {totalCommission.toLocaleString("ru-RU")} ₸)
            </span>
          )}
        </div>
      )}

      {match.prize_tenge > 0 && (
        <div className="payout-prize-row">
          <span>🏅 Призовой фонд матча:</span>
          <strong style={{ color: "#f59e0b" }}>{match.prize_tenge.toLocaleString("ru-RU")} ₸</strong>
          {winner ? (
            <span style={{ fontSize: 13 }}>
              → {winner === "A" ? labelA : labelB}
              {(() => {
                const cnt = winner === "A"
                  ? (matchedPairs[0]?.bet_a ? 1 : 0)
                  : (matchedPairs[0]?.bet_b ? 1 : 0);
                const perPlayer = cnt > 1 ? Math.floor(match.prize_tenge / cnt) : null;
                return perPlayer ? ` (по ${perPlayer.toLocaleString("ru-RU")} ₸)` : "";
              })()}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>ожидание результата</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── MatchChat ──────────────────── */
function fmtTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MatchChat({ matchId, user }) {
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState("");
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState("");
  const lastIdRef                 = useRef(0);
  const bottomRef                 = useRef(null);
  const atBottomRef               = useRef(true);
  const scrollRef                 = useRef(null);

  // track whether user is scrolled to bottom
  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  function scrollToBottom(force = false) {
    if (force || atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  // initial load
  useEffect(() => {
    api.getMessages(matchId, 0)
      .then((d) => {
        const msgs = d.messages || [];
        setMessages(msgs);
        if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
        // scroll to bottom on first load
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
      })
      .catch(() => {});
  }, [matchId]);

  // poll every 4 s
  useEffect(() => {
    const iv = setInterval(() => {
      api.getMessages(matchId, lastIdRef.current)
        .then((d) => {
          const msgs = d.messages || [];
          if (!msgs.length) return;
          lastIdRef.current = msgs[msgs.length - 1].id;
          setMessages((prev) => [...prev, ...msgs]);
          scrollToBottom();
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(iv);
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setError(""); setBusy(true);
    try {
      const d = await api.sendMessage(matchId, t);
      setText("");
      setMessages((prev) => [...prev, d.message]);
      lastIdRef.current = d.message.id;
      setTimeout(() => scrollToBottom(true), 30);
    } catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="section-card chat-card">
      <div className="section-title">Чат матча</div>

      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {messages.length === 0 && (
          <div className="chat-empty">Пока нет сообщений. Будьте первым!</div>
        )}
        {messages.map((m, i) => {
          const isMe = user && m.user_id === user.id;
          const prevSame = i > 0 && messages[i - 1].user_id === m.user_id;
          return (
            <div key={m.id} className={`chat-msg${isMe ? " me" : ""}${prevSame ? " compact" : ""}`}>
              {!isMe && !prevSame && (
                <Avatar user={m} size={28} />
              )}
              {!isMe && prevSame && <div className="chat-avatar-gap" />}
              <div className="chat-bubble-wrap">
                {!isMe && !prevSame && (
                  <div className="chat-author">{displayName(m)}</div>
                )}
                <div className="chat-bubble">
                  <span className="chat-text">{m.text}</span>
                  <span className="chat-time">{fmtTime(m.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error" style={{ fontSize: 12, padding: "4px 0" }}>{error}</div>}

      {user ? (
        <form className="chat-input-row" onSubmit={send}>
          <input
            className="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Написать сообщение…"
            maxLength={500}
            autoComplete="off"
          />
          <button type="submit" className="chat-send-btn" disabled={busy || !text.trim()}>
            ➤
          </button>
        </form>
      ) : (
        <div className="chat-login-hint">Войдите, чтобы писать в чат</div>
      )}
    </div>
  );
}

/* ──────────────────────── MatchPage ─────────────────── */
function MatchPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [oddsForm, setOddsForm]   = useState(null); // null = closed, {a,b} = editing
  const [scoreInput, setScoreInput] = useState(null); // null = closed, string = editing

  async function load() {
    setError("");
    try { setData(await api.getMatch(matchId)); }
    catch (e2) { setError(e2?.data?.error || e2.message); }
  }

  useEffect(() => { load(); }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const match = data?.match;
  const players = data?.players || [];
  const pendingBets = data?.pending_bets || [];
  const matchedPairs = data?.matched_pairs || [];

  const isOwner = useMemo(() => user && match && Number(match.created_by_user_id) === Number(user.id), [user, match]);

  const labelA = teamLabel(players, "A");
  const labelB = teamLabel(players, "B");

  const poolTotal = useMemo(() => {
    return pendingBets.reduce((s, b) => s + (b.amount_tenge || 0), 0)
      + matchedPairs.reduce((s, p) => s + (p.pot_tenge || 0), 0);
  }, [pendingBets, matchedPairs]);

  async function setStatus(status) {
    setBusy(true); setError("");
    try { await api.setMatchStatus(matchId, status); await load(); }
    catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  async function setWinner(winner) {
    setConfirming(null); setBusy(true); setError("");
    try { await api.setWinner(matchId, winner); await load(); }
    catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  async function saveOdds() {
    if (!oddsForm) return;
    setBusy(true); setError("");
    try {
      await api.updateOdds(matchId, oddsForm.a, oddsForm.b);
      setOddsForm(null); await load();
    }
    catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  async function saveScore() {
    setBusy(true); setError("");
    try {
      await api.setScore(matchId, scoreInput?.trim() || null);
      setScoreInput(null); await load();
    }
    catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  if (!match) {
    return (
      <Page title="Матч" back>
        {error ? <div className="error">{error}</div> : <div className="empty">Загрузка…</div>}
      </Page>
    );
  }

  const sc = STATUS_COLOR[match.status] || "var(--muted)";
  const teamAPlayers = players.filter((p) => p.team === "A");
  const teamBPlayers = players.filter((p) => p.team === "B");

  return (
    <Page back>
      {error && <div className="error" style={{ margin: "0 0 10px" }}>{error}</div>}
      <div className="vstack" style={{ paddingBottom: 100 }}>

        {/* ── info card ── */}
        <div className="section-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{match.title}</h2>
            <span className="status-pill" style={{ color: sc, borderColor: sc + "40", flexShrink: 0 }}>
              {STATUS_RU[match.status] || match.status}
            </span>
          </div>
          <div className="match-meta">{fmt(match.start_time)}{match.location ? ` · ${match.location}` : ""}</div>

          {match.prize_tenge > 0 && !match.winner && (
            <div className="prize-pool-banner">
              🏅 Играют на: <strong>{match.prize_tenge.toLocaleString("ru-RU")} ₸</strong>
            </div>
          )}

          {match.winner && (() => {
            const winnerLabel = match.winner === "A" ? labelA : labelB;
            const winnerPlayers = (match.winner === "A" ? teamAPlayers : teamBPlayers);
            const perPlayer = match.prize_tenge && winnerPlayers.length > 1
              ? Math.floor(match.prize_tenge / winnerPlayers.length)
              : null;
            return (
              <div className="winner-banner big">
                <div>🏆 Победитель: <strong>{winnerLabel}</strong></div>
                {match.prize_tenge > 0 && (
                  <div className="winner-prize-row">
                    <span>Выигрыш: <strong style={{ color: "#22c55e" }}>{match.prize_tenge.toLocaleString("ru-RU")} ₸</strong></span>
                    {perPlayer && (
                      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                        (по {perPlayer.toLocaleString("ru-RU")} ₸ каждому)
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="vs-detail">
            <div className="vs-detail-team">
              <div className="vs-detail-label a">Команда A</div>
              <div className="vstack tight">
                {teamAPlayers.map((p) => <PlayerSlot key={p.id} player={p} accent="#22c55e" />)}
              </div>
              <div className="odds-badge a">×{match.odds_a?.toFixed(2)}</div>
            </div>
            <div className={`vs-detail-mid${match.score ? " has-score" : ""}`}>
              {match.score || "VS"}
            </div>
            <div className="vs-detail-team">
              <div className="vs-detail-label b">Команда B</div>
              <div className="vstack tight">
                {teamBPlayers.map((p) => <PlayerSlot key={p.id} player={p} accent="#ef4444" />)}
              </div>
              <div className="odds-badge b">×{match.odds_b?.toFixed(2)}</div>
            </div>
          </div>
          {match.notes && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>{match.notes}</div>}
        </div>

        {/* ── owner controls ── */}
        {isOwner && match.status !== "finished" && match.status !== "cancelled" && (
          <div className="section-card">
            <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              Управление матчем
              <button
                className="secondary small"
                onClick={() => nav(`/match/${matchId}/edit`)}
                style={{ fontWeight: 600 }}
              >
                ✏️ Редактировать
              </button>
            </div>
            {!confirming ? (
              <div className="vstack tight">
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Объявить победителя:</div>
                <div className="hstack">
                  <button className="btn-team-a" onClick={() => setConfirming("A")} disabled={busy}>{labelA}</button>
                  <button className="btn-team-b" onClick={() => setConfirming("B")} disabled={busy}>{labelB}</button>
                </div>
              </div>
            ) : (
              <div className="confirm-box">
                <div style={{ fontSize: 14, marginBottom: 10 }}>
                  Подтвердить победу: {confirming === "A" ? labelA : labelB}?
                </div>
                <div className="hstack">
                  <button className="btn-primary" onClick={() => setWinner(confirming)} disabled={busy}>
                    Да, подтвердить
                  </button>
                  <button className="secondary" onClick={() => setConfirming(null)}>Отмена</button>
                </div>
              </div>
            )}
            {/* edit score */}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
              {scoreInput === null ? (
                <div className="hstack" style={{ alignItems: "center" }}>
                  <button className="secondary small" onClick={() => setScoreInput(match.score || "")}>
                    {match.score ? `Счёт: ${match.score} · Изменить` : "Установить счёт"}
                  </button>
                  {match.score && (
                    <button className="danger small" disabled={busy} onClick={() => { setScoreInput(null); api.setScore(matchId, null).then(load); }}>
                      ✕
                    </button>
                  )}
                </div>
              ) : (
                <div className="vstack tight">
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>Счёт (например: 6:4 или 3:1)</div>
                  <div className="hstack">
                    <input
                      style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 18, letterSpacing: 2 }}
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="6:4"
                      maxLength={30}
                      autoFocus
                    />
                  </div>
                  <div className="hstack">
                    <button className="btn-primary" disabled={busy} onClick={saveScore} style={{ flex: 1 }}>Сохранить</button>
                    <button className="secondary" onClick={() => setScoreInput(null)}>Отмена</button>
                  </div>
                </div>
              )}
            </div>

            {/* edit odds */}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
              {!oddsForm ? (
                <button className="secondary small" onClick={() => setOddsForm({ a: String(match.odds_a), b: String(match.odds_b) })}>
                  Изменить коэффициенты
                </button>
              ) : (
                <div className="vstack tight">
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>Новые коэффициенты:</div>
                  <div className="hstack">
                    <div className="field" style={{ flex: 1 }}>
                      <label style={{ fontSize: 12 }}>{labelA}</label>
                      <input type="text" inputMode="decimal" value={oddsForm.a}
                        onChange={(e) => setOddsForm((f) => ({ ...f, a: e.target.value }))}
                        placeholder="2.00" />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label style={{ fontSize: 12 }}>{labelB}</label>
                      <input type="text" inputMode="decimal" value={oddsForm.b}
                        onChange={(e) => setOddsForm((f) => ({ ...f, b: e.target.value }))}
                        placeholder="2.00" />
                    </div>
                  </div>
                  <div className="hstack">
                    <button className="btn-primary" disabled={busy} onClick={saveOdds} style={{ flex: 1 }}>Сохранить</button>
                    <button className="secondary" onClick={() => setOddsForm(null)}>Отмена</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
              <div className="hstack wrap">
                {["open", "locked", "cancelled"].map((s) => (
                  <button key={s} disabled={busy || match.status === s}
                    className={s === "cancelled" ? "danger small" : "secondary small"}
                    onClick={() => setStatus(s)}>
                    {STATUS_BTN_RU[s] || s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── stats ── */}
        <div className="section-card">
          <div className="section-title">Статистика</div>
          <div className="pool-row" style={{ gridTemplateColumns: `repeat(${match.prize_tenge > 0 ? 4 : 3},1fr)` }}>
            {match.prize_tenge > 0 && (
              <div className="pool-item">
                <span className="pool-label">Призовой фонд</span>
                <span className="pool-value" style={{ color: "#f59e0b" }}>{match.prize_tenge.toLocaleString("ru-RU")} ₸</span>
              </div>
            )}
            <div className="pool-item">
              <span className="pool-label">Ставки</span>
              <span className="pool-value">{poolTotal.toLocaleString("ru-RU")} ₸</span>
            </div>
            <div className="pool-item">
              <span className="pool-label">Принятых пар</span>
              <span className="pool-value">{matchedPairs.length}</span>
            </div>
            <div className="pool-item">
              <span className="pool-label">Ждут ответа</span>
              <span className="pool-value" style={{ color: pendingBets.length > 0 ? "#f59e0b" : "inherit" }}>
                {pendingBets.length}
              </span>
            </div>
          </div>
        </div>

        {/* ── open challenges ── */}
        <div className="section-card">
          <div className="section-title">Открытые вызовы ({pendingBets.length})</div>
          <PendingBetsSection
            pendingBets={pendingBets}
            matchId={matchId} match={match}
            labelA={labelA} labelB={labelB}
            user={user} onDone={load}
          />
        </div>

        {/* ── create new challenge ── */}
        <div className="section-card">
          <div className="section-title">Создать вызов</div>
          <NewChallengeWidget
            match={match} matchId={matchId}
            labelA={labelA} labelB={labelB}
            user={user} onDone={load}
          />
        </div>

        {/* ── payout report ── */}
        <PayoutReport
          match={match}
          matchedPairs={matchedPairs}
          pendingBets={pendingBets}
          labelA={labelA}
          labelB={labelB}
        />

        {/* ── matched pairs ── */}
        {matchedPairs.length > 0 && (
          <div className="section-card">
            <div className="section-title">Принятые пары ({matchedPairs.length})</div>
            <div className="list tight">
              {matchedPairs.map((pair) => {
                const pairWinner = match.winner === "A" ? pair.bet_a : match.winner === "B" ? pair.bet_b : null;
                return (
                  <div key={pair.id} className="matched-pair">
                    <div className="matched-pair-side a">
                      <Avatar user={pair.bet_a} size={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName(pair.bet_a)}</div>
                        <div style={{ fontSize: 11, color: "#22c55e" }}>{labelA}</div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        {pair.bet_a.amount_tenge.toLocaleString("ru-RU")} ₸
                      </span>
                    </div>
                    <div className="matched-pair-vs">против</div>
                    <div className="matched-pair-side b">
                      <Avatar user={pair.bet_b} size={24} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName(pair.bet_b)}</div>
                        <div style={{ fontSize: 11, color: "#ef4444" }}>{labelB}</div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        {pair.bet_b.amount_tenge.toLocaleString("ru-RU")} ₸
                      </span>
                    </div>
                    <div className="matched-pair-pot">
                      {pairWinner ? (
                        <span style={{ color: "#22c55e" }}>
                          🏆 {displayName(pairWinner)} получает{" "}
                          <strong>{(pair.net_payout ?? pair.pot_tenge).toLocaleString("ru-RU")} ₸</strong>
                        </span>
                      ) : (
                        <span>
                          Банк: <strong>{(pair.net_payout ?? pair.pot_tenge).toLocaleString("ru-RU")} ₸</strong>
                          {pair.commission_tenge > 0 && (
                            <span style={{ color: "#f59e0b", fontSize: 11, marginLeft: 6 }}>
                              (−{pair.commission_tenge.toLocaleString("ru-RU")} ₸ ком.)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── chat ── */}
        <MatchChat matchId={matchId} user={user} />

      </div>
    </Page>
  );
}

/* ──────────────────────── PlayersPage ───────────────── */
function PlayersPage() {
  const [tab, setTab] = useState("list"); // "list" | "pnl"

  // list tab state
  const [players, setPlayers] = useState([]);
  const [query, setQuery] = useState("");
  const [listErr, setListErr] = useState("");

  // pnl tab state
  const [pnlRows, setPnlRows] = useState(null); // null = not loaded yet
  const [pnlErr, setPnlErr] = useState("");

  useEffect(() => {
    api.listUsers(query)
      .then((d) => setPlayers(d.users || []))
      .catch((e) => setListErr(e?.data?.error || e.message));
  }, [query]);

  useEffect(() => {
    if (tab !== "pnl" || pnlRows !== null) return;
    api.getPlayerStats()
      .then((d) => setPnlRows(d.players || []))
      .catch((e) => setPnlErr(e?.data?.error || e.message));
  }, [tab, pnlRows]);

  function levelColor(r) {
    if (r >= 5) return "#22c55e";
    if (r >= 3.5) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <Page title="Игроки">
      <div className="vstack" style={{ paddingBottom: 80 }}>
        <div className="filter-tabs">
          <button className={`filter-tab${tab === "list" ? " active" : ""}`} onClick={() => setTab("list")}>Список</button>
          <button className={`filter-tab${tab === "pnl"  ? " active" : ""}`} onClick={() => setTab("pnl")}>P&amp;L</button>
        </div>

        {/* ── list tab ── */}
        {tab === "list" && (
          <>
            <div className="field" style={{ margin: 0 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени или логину…"
              />
            </div>
            {listErr && <div className="error">{listErr}</div>}
            <div className="list">
              {players.map((p, i) => (
                <div key={p.id} className="player-row">
                  <div className="player-rank">{i + 1}</div>
                  <Avatar user={p} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{displayName(p)}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>@{p.username}</div>
                  </div>
                  <div className="level-badge" style={{ background: levelColor(p.rating) + "22", color: levelColor(p.rating), borderColor: levelColor(p.rating) + "55" }}>
                    {Number(p.rating) % 1 === 0 ? p.rating + ".0" : p.rating}
                  </div>
                </div>
              ))}
              {players.length === 0 && !listErr && <div className="empty">Игроков не найдено</div>}
            </div>
          </>
        )}

        {/* ── pnl tab ── */}
        {tab === "pnl" && (
          <>
            {pnlErr && <div className="error">{pnlErr}</div>}
            {pnlRows === null && !pnlErr && <div className="empty">Загрузка…</div>}
            {pnlRows !== null && pnlRows.length === 0 && (
              <div className="empty">Нет завершённых матчей со ставками</div>
            )}
            {pnlRows !== null && pnlRows.length > 0 && (
              <div className="pnl-table">
                {/* header */}
                <div className="pnl-header">
                  <span className="pnl-col-rank">#</span>
                  <span className="pnl-col-name">Игрок</span>
                  <span className="pnl-col-num">В/П</span>
                  <span className="pnl-col-num">Ставки</span>
                  <span className="pnl-col-profit">Итог</span>
                </div>
                {pnlRows.map((p, i) => {
                  const isPos = p.profit > 0;
                  const isNeg = p.profit < 0;
                  return (
                    <div key={p.id} className={`pnl-row${isPos ? " pos" : isNeg ? " neg" : ""}`}>
                      <span className="pnl-col-rank">{i + 1}</span>
                      <div className="pnl-col-name">
                        <Avatar user={p} size={32} />
                        <div className="pnl-name-block">
                          <span className="pnl-name">{displayName(p)}</span>
                          <span className="pnl-sub">{p.wins}П / {p.losses}П · {p.bets_count} ставок</span>
                        </div>
                      </div>
                      <span className="pnl-col-num pnl-wl">
                        <span className="pnl-wins">{p.wins}W</span>
                        <span className="pnl-losses">{p.losses}L</span>
                      </span>
                      <span className="pnl-col-num pnl-staked">
                        {(p.total_staked || 0).toLocaleString("ru-RU")} ₸
                      </span>
                      <span className={`pnl-col-profit pnl-delta${isPos ? " pos" : isNeg ? " neg" : ""}`}>
                        {isPos ? "+" : ""}{(p.profit || 0).toLocaleString("ru-RU")} ₸
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
}

/* ──────────────────────── StatsPage ─────────────────── */
function StatsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDailyStats()
      .then(setData)
      .catch((e) => setError(e?.data?.error || e.message));
  }, []);

  if (!canCreate(user)) {
    return <Page title="Статистика"><div className="empty" style={{ marginTop: 40 }}>Нет доступа</div></Page>;
  }

  const days = data?.days || [];
  const totals = data?.totals;

  return (
    <Page title="Статистика">
      <div className="vstack" style={{ paddingBottom: 80 }}>
        {error && <div className="error">{error}</div>}

        {/* totals card */}
        {totals && (
          <div className="section-card">
            <div className="section-title">За всё время</div>
            <div className="pool-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
              <div className="pool-item">
                <span className="pool-label">Ставок</span>
                <span className="pool-value">{totals.bets_total}</span>
              </div>
              <div className="pool-item">
                <span className="pool-label">Оборот</span>
                <span className="pool-value">{(totals.volume_tenge || 0).toLocaleString("ru-RU")} ₸</span>
              </div>
              <div className="pool-item" style={{ color: "#f59e0b" }}>
                <span className="pool-label">Комиссия</span>
                <span className="pool-value" style={{ color: "#f59e0b" }}>{(totals.commission_tenge || 0).toLocaleString("ru-RU")} ₸</span>
              </div>
            </div>
          </div>
        )}

        {/* daily breakdown */}
        <div className="section-card">
          <div className="section-title">По дням</div>
          {days.length === 0 && !error && <div className="empty">Данных пока нет</div>}
          <div className="stats-table">
            {days.length > 0 && (
              <div className="stats-header">
                <span>Дата</span>
                <span>Ставок</span>
                <span>Оборот</span>
                <span>Комиссия</span>
              </div>
            )}
            {days.map((d) => (
              <div key={d.day} className="stats-row">
                <span className="stats-date">{new Date(d.day + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                <span>{d.bets_total}</span>
                <span>{(d.volume_tenge || 0).toLocaleString("ru-RU")} ₸</span>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>{(d.commission_tenge || 0).toLocaleString("ru-RU")} ₸</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}

/* ─────────────────────── App shell ──────────────────── */
function AppInner() {
  const { loading } = useAuth();
  if (loading) return <><Topbar /><div className="page"><div className="empty">Загрузка…</div></div></>;
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<MatchesPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/stats" element={<StatsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/create" element={<CreateMatchPage />} />
        <Route path="/match/:id" element={<MatchPage />} />
        <Route path="/match/:id/edit" element={<EditMatchPage />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
