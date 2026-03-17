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
          placeholder={`Игрок ${selected.length + 1} из 2…`}
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
                <div style={{ fontSize: 12, color: "var(--muted)" }}>@{u.username} · {u.rating}</div>
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
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Рейтинг {player.rating}</div>
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
      <NavLink to="/" className="brand">Paddle Bets</NavLink>
      <nav className="topnav">
        {user ? (
          <>
            <NavLink to="/create" className={({ isActive }) => isActive ? "active" : ""}>+ Создать</NavLink>
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
      {user && (
        <NavLink to="/create" className={({ isActive }) => isActive ? "bnav-item active" : "bnav-item"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <span>Создать</span>
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
  const [form, setForm] = useState({ first_name: "", last_name: "", rating: 1000 });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    setForm({ first_name: user.first_name || "", last_name: user.last_name || "", rating: user.rating ?? 1000 });
  }, [user]);

  async function onSave() {
    setError(""); setSaved(false); setBusy(true);
    try {
      await api.updateMe({ first_name: form.first_name || null, last_name: form.last_name || null, rating: Number(form.rating) });
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
          <div className="field"><label>Рейтинг</label><input value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} inputMode="numeric" /></div>
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
function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listMatches().then((d) => setMatches(d.matches || [])).catch((e) => setError(e?.data?.error || e.message));
  }, []);

  return (
    <Page title="Матчи">
      {error && <div className="error">{error}</div>}
      <div className="list">
        {matches.map((m) => {
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
                <div className="vs-badge">VS</div>
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
                <span>Пул: {(m.total_pool_tenge || 0).toLocaleString("ru-RU")} ₸</span>
                <span>{m.matched_pairs_count || 0} пар</span>
                {m.pending_bets_count > 0 && <span style={{ color: "#f59e0b" }}>{m.pending_bets_count} ожидают</span>}
                <span>×{m.odds_a} / ×{m.odds_b}</span>
              </div>
            </NavLink>
          );
        })}
        {matches.length === 0 && <div className="empty">Матчей пока нет</div>}
      </div>
    </Page>
  );
}

/* ────────────────────── CreateMatchPage ─────────────── */
function CreateMatchPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ title: "", location: "", start_time: "", notes: "", odds_a: "2.00", odds_b: "2.00" });
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const allSelected = useMemo(() => [...teamA, ...teamB].map((u) => u.id), [teamA, teamB]);
  const labelA = teamA.map(displayName).join(" & ") || "Команда A";
  const labelB = teamB.map(displayName).join(" & ") || "Команда B";

  async function onSubmit(e) {
    e.preventDefault();
    if (teamA.length !== 2 || teamB.length !== 2) { setError("Выберите по 2 игрока в каждую команду"); return; }
    const oa = parseFloat(form.odds_a); const ob = parseFloat(form.odds_b);
    if (!oa || !ob || oa < 1.01 || ob < 1.01) { setError("Коэффициенты должны быть ≥ 1.01"); return; }
    setError(""); setBusy(true);
    try {
      const data = await api.createMatch({
        title: form.title, location: form.location || null,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        notes: form.notes || null,
        team_a: teamA.map((u) => u.id), team_b: teamB.map((u) => u.id),
        odds_a: oa, odds_b: ob,
      });
      nav(`/match/${data.match.id}`);
    } catch (e2) { setError(e2?.data?.error || e2.message); }
    finally { setBusy(false); }
  }

  if (!user) return <Page title="Создать матч"><div className="panel">Нужно войти.</div></Page>;

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
              <input value={form.odds_a} onChange={(e) => setForm((f) => ({ ...f, odds_a: e.target.value }))} inputMode="decimal" placeholder="2.00" />
            </div>
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span className="team-dot b" />{labelB}</label>
              <input value={form.odds_b} onChange={(e) => setForm((f) => ({ ...f, odds_b: e.target.value }))} inputMode="decimal" placeholder="2.00" />
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        <button disabled={busy || teamA.length !== 2 || teamB.length !== 2} type="submit" className="btn-primary">
          Создать матч
        </button>
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
        const pot = b.amount_tenge + counterAmt;
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
                  : <strong>{counterAmt.toLocaleString("ru-RU")} ₸</strong> · Банк: {pot.toLocaleString("ru-RU")} ₸
                </div>
                <button className="btn-accept" disabled={busy} onClick={() => setAccepting(b)}>
                  Принять вызов
                </button>
              </div>
            ) : (
              <div className="confirm-box">
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  Принять вызов? Ваша ставка: <strong>{counterAmt.toLocaleString("ru-RU")} ₸</strong> на {oppoLabel}.<br />
                  Победитель заберёт <strong>{pot.toLocaleString("ru-RU")} ₸</strong>.
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
  const potWin = odds ? Math.round(Number(form.amount) * (odds - 1)) : null;

  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    const amt = Math.floor(Number(form.amount));
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
        <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} inputMode="numeric" placeholder="1000" />
      </div>
      {potWin !== null && Number(form.amount) > 0 && (
        <div className="payout-preview">
          Выигрыш если победят {form.side === "A" ? labelA : labelB}:{" "}
          <strong>{(Number(form.amount) + potWin).toLocaleString("ru-RU")} ₸</strong>
          <div style={{ fontSize: 11, marginTop: 2, color: "var(--muted)" }}>
            (ставка {Number(form.amount).toLocaleString("ru-RU")} + прибыль {potWin.toLocaleString("ru-RU")} ₸)
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

/* ──────────────────────── MatchPage ─────────────────── */
function MatchPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);

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

          {match.winner && (
            <div className="winner-banner big">
              🏆 Победитель: {match.winner === "A" ? labelA : labelB}
            </div>
          )}

          <div className="vs-detail">
            <div className="vs-detail-team">
              <div className="vs-detail-label a">Команда A</div>
              <div className="vstack tight">
                {teamAPlayers.map((p) => <PlayerSlot key={p.id} player={p} accent="#22c55e" />)}
              </div>
              <div className="odds-badge a">×{match.odds_a?.toFixed(2)}</div>
            </div>
            <div className="vs-detail-mid">VS</div>
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
            <div className="section-title">Управление матчем</div>
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
          <div className="pool-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <div className="pool-item">
              <span className="pool-label">В игре</span>
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
                          🏆 {displayName(pairWinner)} получает {pair.pot_tenge.toLocaleString("ru-RU")} ₸
                        </span>
                      ) : (
                        <span>Банк пары: <strong>{pair.pot_tenge.toLocaleString("ru-RU")} ₸</strong></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/create" element={<CreateMatchPage />} />
        <Route path="/match/:id" element={<MatchPage />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
