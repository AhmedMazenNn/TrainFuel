import { useEffect, useState, useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Brand, LanguageSwitch, Message } from "./Primitives";
import { useSync } from "../sync/SyncContext";
import { syncCopy } from "../sync/copy";
import { db, operations } from "../offline/database";

export function AppShell() {
  const { account, signOut, sessionValid } = useAuth();
  const { t, errorText, language } = useLanguage();
  const { queue, busy: syncBusy, error: syncError, sync } = useSync();
  const copy = syncCopy[language];
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  async function leave(discard = false) {
    setBusy(true);
    setError("");
    try {
      dialog.current?.close();
      await signOut(discard);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        {t("skipContent")}
      </a>
      <header className="app-header">
        <Brand />
        <nav aria-label={t("overview")}>
          <NavLink to="/app" end>
            {t("overview")}
          </NavLink>
          <NavLink to="/app/profile">{t("profile")}</NavLink>
          <NavLink to="/app/training">{t("training")}</NavLink>
          <NavLink to="/app/account">{t("account")}</NavLink>
          <NavLink to="/app/privacy">
            {language === "ar" ? "الخصوصية" : "Privacy"}
          </NavLink>
          <NavLink to="/app/sync">{copy.details}</NavLink>
        </nav>
        <div className="header-actions">
          <LanguageSwitch />
          <span className="avatar" aria-hidden="true">
            {Array.from(account?.profile.display_name || "?")[0]}
          </span>
          <button
            className="sign-out"
            type="button"
            onClick={async () => {
              const media = await (
                await db
              ).getAllFromIndex("media", "owner", account!.user.id);
              const pending = await operations(account!.user.id);
              if (pending.length || media.length) dialog.current?.showModal();
              else void leave();
            }}
            disabled={busy}
          >
            {t(busy ? "signingOut" : "signOut")}
          </button>
        </div>
      </header>
      <main id="main" className="workspace-main">
        {!online && <Message>{copy.offline}</Message>}
        {!sessionValid && online && <Message>{copy.paused}</Message>}
        <p className="sync-status" role="status">
          {syncBusy
            ? copy.syncing
            : syncError || queue.some((op) => op.status !== "pending")
              ? copy.attention
              : queue.length
                ? copy.pending
                : copy.synced}
        </p>
        {error && <Message>{error}</Message>}
        <Outlet />
      </main>
      <dialog
        ref={dialog}
        className="logout-dialog"
        aria-labelledby="logout-title"
      >
        <h2 id="logout-title">{copy.logout}</h2>
        <p>{copy.logoutIntro}</p>
        <div className="sync-actions">
          <button
            className="button primary"
            disabled={!online || !sessionValid || busy}
            onClick={async () => {
              try {
                await sync();
                const pending = await operations(account!.user.id);
                const media = await (
                  await db
                ).getAllFromIndex("media", "owner", account!.user.id);
                if (pending.length || media.length) {
                  setError(copy.attention);
                  return;
                }
                await leave();
              } catch {
                setError(copy.serverError);
              }
            }}
          >
            {copy.syncLeave}
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => leave()}
          >
            {copy.retain}
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={() => leave(true)}
          >
            {copy.discard}
          </button>
          <button
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            {copy.cancel}
          </button>
        </div>
        {error && <Message>{error}</Message>}
      </dialog>
    </div>
  );
}
