import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "../api/client";
import type { Account } from "../types/accounts";
import { useLanguage } from "./LanguageContext";

interface AuthValue {
  account: Account | null;
  loading: boolean;
  unavailable: boolean;
  setAccount: (account: Account | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setRawAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const { setLanguage } = useLanguage();
  const current = useRef<Account | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const generation = useRef(0);
  const setAccount = useCallback((next: Account | null) => {
    generation.current += 1;
    const changed = current.current?.user.id !== next?.user.id;
    current.current = next;
    setRawAccount(next);
    if (changed) channel.current?.postMessage("session-changed");
  }, []);
  async function refresh() {
    const attempt = ++generation.current;
    try {
      const current = await api<Account>("/auth/me/");
      if (generation.current !== attempt) return;
      setAccount(current);
      setUnavailable(false);
    } catch (error) {
      if (generation.current !== attempt) return;
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        setAccount(null);
        setUnavailable(false);
      } else {
        setUnavailable(true);
        throw error;
      }
    }
  }
  useEffect(() => {
    let active = true;
    function checkSession() {
      const attempt = ++generation.current;
      current.current = null;
      setRawAccount(null);
      setLoading(true);
      api<Account>("/auth/me/")
        .then((next) => {
          if (active && generation.current === attempt) {
            current.current = next;
            setRawAccount(next);
            setUnavailable(false);
          }
        })
        .catch((error) => {
          if (active && generation.current === attempt)
            setUnavailable(
              !(
                error instanceof ApiError &&
                (error.status === 401 || error.status === 403)
              ),
            );
        })
        .finally(() => {
          if (active && generation.current === attempt) setLoading(false);
        });
    }
    checkSession();
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("trainfuel-auth");
      channel.current.onmessage = (event) => {
        if (event.data === "session-changed") checkSession();
      };
    }
    const expire = () => setAccount(null);
    window.addEventListener("trainfuel-session-expired", expire);
    return () => {
      active = false;
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("trainfuel-session-expired", expire);
    };
  }, []);
  useEffect(() => {
    if (account?.profile.display_name) setLanguage(account.profile.language);
  }, [
    account?.user.id,
    account?.profile.language,
    account?.profile.display_name,
  ]);
  async function signOut() {
    await api("/auth/logout/", "POST", {});
    setAccount(null);
  }
  return (
    <Context.Provider
      value={{ account, loading, unavailable, setAccount, refresh, signOut }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider is missing");
  return context;
}
