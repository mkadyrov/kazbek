import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await api.me();
        if (!cancelled) setUser(data.user);
      } catch {
        setToken("");
        if (!cancelled) {
          setTokenState("");
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      setAuth(nextToken, nextUser) {
        setToken(nextToken);
        setTokenState(nextToken || "");
        setUser(nextUser || null);
      },
      async refreshMe() {
        const data = await api.me();
        setUser(data.user);
        return data.user;
      },
      logout() {
        setToken("");
        setTokenState("");
        setUser(null);
      },
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

