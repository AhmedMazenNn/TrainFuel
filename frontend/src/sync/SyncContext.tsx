import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  cachedAccount,
  operations,
  type PendingOperation,
} from "../offline/database";
import { synchronize } from "./engine";
interface Value {
  queue: PendingOperation[];
  busy: boolean;
  error: string;
  sync: () => Promise<void>;
}
const Context = createContext<Value | null>(null);
export function SyncProvider({ children }: { children: ReactNode }) {
  const { account, sessionValid, setLocalAccount } = useAuth();
  const owner = account?.user.id;
  const [queue, setQueue] = useState<PendingOperation[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const running = useRef<Promise<void> | null>(null),
    ownerRef = useRef(owner),
    requested = useRef(false);
  ownerRef.current = owner;
  const reload = useCallback(async () => {
    if (!owner) {
      setQueue([]);
      return;
    }
    const pending = await operations(owner),
      local = await cachedAccount();
    if (ownerRef.current !== owner) return;
    setQueue(pending);
    if (local?.user.id === owner) setLocalAccount(local);
  }, [owner, setLocalAccount]);
  const sync = useCallback(async () => {
    if (!owner || !sessionValid || !navigator.onLine) return;
    if (running.current) {
      requested.current = true;
      return running.current;
    }
    const attempt = (async () => {
      setBusy(true);
      setError("");
      const considered = new Set<string>();
      let failed = false;
      try {
        let again = true;
        while (again) {
          requested.current = false;
          const seen = await synchronize(owner);
          for (const key of seen) considered.add(key);
          again =
            requested.current &&
            ownerRef.current === owner &&
            navigator.onLine &&
            (await operations(owner)).some(
              (op) => op.status === "pending" && !seen.has(op.idempotency_key),
            );
        }
      } catch (caught) {
        failed = true;
        setError(caught instanceof Error ? caught.message : "Sync failed");
        throw caught;
      } finally {
        await reload();
        setBusy(false);
        running.current = null;
        if (
          !failed &&
          ownerRef.current === owner &&
          navigator.onLine &&
          (await operations(owner)).some(
            (op) =>
              op.status === "pending" && !considered.has(op.idempotency_key),
          )
        )
          window.dispatchEvent(new Event("trainfuel-sync-request"));
      }
    })();
    running.current = attempt;
    return attempt;
  }, [owner, sessionValid, reload]);
  useEffect(() => {
    void reload();
    const trigger = () => {
        void sync().catch(() => {});
      },
      update = () => {
        void reload();
        trigger();
      },
      foreground = () => {
        if (document.visibilityState === "visible") trigger();
      };
    trigger();
    window.addEventListener("online", trigger);
    window.addEventListener("trainfuel-sync-request", trigger);
    window.addEventListener("trainfuel-local-change", update);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      window.removeEventListener("online", trigger);
      window.removeEventListener("trainfuel-sync-request", trigger);
      window.removeEventListener("trainfuel-local-change", update);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [reload, sync]);
  return (
    <Context.Provider value={{ queue, busy, error, sync }}>
      {children}
    </Context.Provider>
  );
}
export function useSync() {
  const value = useContext(Context);
  if (!value) throw new Error("SyncProvider missing");
  return value;
}
