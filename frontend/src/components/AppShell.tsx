import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Brand, LanguageSwitch, Message } from "./Primitives";

export function AppShell() {
  const { account, signOut } = useAuth();
  const { t, errorText } = useLanguage();
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
  async function leave() {
    setBusy(true);
    setError("");
    try {
      await signOut();
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
          <NavLink to="/app/account">{t("account")}</NavLink>
        </nav>
        <div className="header-actions">
          <LanguageSwitch />
          <span className="avatar" aria-hidden="true">
            {Array.from(account?.profile.display_name || "?")[0]}
          </span>
          <button
            className="sign-out"
            type="button"
            onClick={leave}
            disabled={busy}
          >
            {t(busy ? "signingOut" : "signOut")}
          </button>
        </div>
      </header>
      <main id="main" className="workspace-main">
        {!online && <Message>{t("offlineNotice")}</Message>}
        {error && <Message>{error}</Message>}
        <Outlet />
      </main>
    </div>
  );
}
