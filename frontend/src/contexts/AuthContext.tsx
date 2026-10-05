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
import {
  cachedAccount,
  clearErasedAccount,
  db,
  lockAccount,
  rememberAccount,
} from "../offline/database";
import { useLanguage } from "./LanguageContext";
interface AuthValue {
  account: Account | null;
  loading: boolean;
  unavailable: boolean;
  sessionValid: boolean;
  setAccount: (account: Account | null) => void;
  setLocalAccount: (account: Account) => void;
  refresh: () => Promise<void>;
  signOut: (discard?: boolean) => Promise<void>;
}
const Context = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setRawAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [unavailable, setUnavailable] = useState(false),
    [sessionValid, setSessionValid] = useState(false);
  const generation = useRef(0),
    channel = useRef<BroadcastChannel | null>(null),
    currentAccount = useRef<Account | null>(account);
  const { setLanguage } = useLanguage();
  const setLocalAccount = useCallback(
    (next: Account) => setRawAccount(next),
    [],
  );
  const setAccount = useCallback((next: Account | null) => {
    const attempt = ++generation.current;
    setRawAccount(next);
    setSessionValid(Boolean(next));
    setUnavailable(false);
    const persist = next ? rememberAccount(next) : lockAccount();
    persist
      .then((value) => {
        if (generation.current === attempt && next && value)
          setRawAccount(value as Account);
        channel.current?.postMessage("session-changed");
      })
      .catch(() => setUnavailable(true));
  }, []);
  const refresh = useCallback(async () => {
    const attempt = ++generation.current;
    try {
      const database = await db;
      if (await database.get("meta", "logout-pending")) {
        try {
          await api("/auth/logout/", "POST", {});
        } catch (error) {
          if (!(
            error instanceof ApiError &&
            error.data.detail ===
              "Authentication credentials were not provided."
          ))
            throw error;
        }
        await database.delete("meta", "logout-pending");
      }
      const next = await api<Account>("/auth/me/");
      if (generation.current !== attempt) return;
      const stored = await rememberAccount(next);
      if (generation.current !== attempt) return;
      setRawAccount(stored);
      setSessionValid(true);
      setUnavailable(false);
    } catch (error) {
      if (generation.current !== attempt) return;
      const local = await cachedAccount();
      if (generation.current !== attempt) return;
      setRawAccount(local);
      setSessionValid(false);
      setUnavailable(
        !(
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ),
      );
    } finally {
      if (generation.current === attempt) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("trainfuel-auth");
      channel.current.onmessage = () => {
        setRawAccount(null);
        setLoading(true);
        void refresh();
      };
    }
    const expire = () => setSessionValid(false),
      reconnect = () => {
        void refresh();
      };
    const erased = () => {
      const owner = currentAccount.current?.user.id;
      if (owner) void clearErasedAccount(owner);
      currentAccount.current = null;
      setRawAccount(null);
      setSessionValid(false);
      setUnavailable(false);
      ++generation.current;
      channel.current?.postMessage("session-changed");
    };
    currentAccount.current = account;
    window.addEventListener("trainfuel-session-expired", expire);
    window.addEventListener("trainfuel-account-erased", erased);
    window.addEventListener("online", reconnect);
    return () => {
      generation.current++;
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("trainfuel-session-expired", expire);
      window.removeEventListener("trainfuel-account-erased", erased);
      window.removeEventListener("online", reconnect);
    };
  }, [refresh]);
  useEffect(() => {
    if (account?.profile.display_name) setLanguage(account.profile.language);
  }, [account?.profile.language, account?.profile.display_name, setLanguage]);
  useEffect(() => {
    currentAccount.current = account;
  }, [account]);
  async function signOut(discard = false) {
    ++generation.current;
    await lockAccount(discard, true);
    setRawAccount(null);
    setSessionValid(false);
    channel.current?.postMessage("session-changed");
    try {
      await api("/auth/logout/", "POST", {});
      await (await db).delete("meta", "logout-pending");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.data.detail === "Authentication credentials were not provided."
      )
        await (await db).delete("meta", "logout-pending");
    }
  }
  return (
    <Context.Provider
      value={{
        account,
        loading,
        unavailable,
        sessionValid,
        setAccount,
        setLocalAccount,
        refresh,
        signOut,
      }}
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
