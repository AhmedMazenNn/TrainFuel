import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import type { Account } from "../types/accounts";
import { Message } from "./Primitives";

interface GoogleAPI {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        nonce: string;
        auto_select: boolean;
        callback: (value: { credential: string }) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleAPI;
  }
}
let scriptPromise: Promise<void> | null = null;
function loadGoogle() {
  if (window.google) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        scriptPromise = null;
        reject(new Error("Google could not load"));
      };
      document.head.appendChild(script);
    });
  return scriptPromise;
}
export function GoogleButton({ purpose }: { purpose: "signin" | "link" }) {
  const { t, language, errorText } = useLanguage();
  const { setAccount } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const target = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    api<{ enabled: boolean }>("/auth/google/config/")
      .then((config) => {
        if (active) setEnabled(config.enabled);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);
  async function begin() {
    setError("");
    setBusy(true);
    setReady(false);
    try {
      const challenge = await api<{ nonce: string; client_id: string }>(
        "/auth/google/challenge/",
        "POST",
        { purpose },
      );
      await loadGoogle();
      if (!mounted.current || !target.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: challenge.client_id,
        nonce: challenge.nonce,
        auto_select: false,
        callback: async ({ credential }) => {
          if (!mounted.current) return;
          setBusy(true);
          try {
            const account = await api<Account>(
              purpose === "link" ? "/auth/google/link/" : "/auth/google/",
              "POST",
              { credential },
            );
            if (mounted.current) setAccount(account);
          } catch (caught) {
            if (mounted.current) {
              setError(errorText(caught));
              setReady(false);
              target.current?.replaceChildren();
            }
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
      });
      target.current.replaceChildren();
      window.google.accounts.id.renderButton(target.current, {
        theme: "outline",
        size: "large",
        text: purpose === "link" ? "signin_with" : "continue_with",
        shape: "pill",
        locale: language,
      });
      setReady(true);
    } catch (caught) {
      if (mounted.current) setError(errorText(caught));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="google-section">
      {enabled && !ready && (
        <button
          className="button google-start"
          type="button"
          onClick={begin}
          disabled={busy}
        >
          <span aria-hidden="true" className="google-letter">
            G
          </span>
          {t(
            busy
              ? "googleLoading"
              : purpose === "link"
                ? "googleLink"
                : "google",
          )}
        </button>
      )}
      {ready && <p className="field-hint">{t("googleReady")}</p>}
      <div className="google-target" ref={target} aria-busy={busy} />
      {enabled === false && (
        <p className="field-hint">{t("googleUnavailable")}</p>
      )}
      {error && <Message>{error}</Message>}
    </div>
  );
}
