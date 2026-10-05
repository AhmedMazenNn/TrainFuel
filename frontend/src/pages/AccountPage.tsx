import { useState } from "react";
import { api } from "../api/client";
import { GoogleButton } from "../components/GoogleButton";
import { Message } from "../components/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export function AccountPage() {
  const { account } = useAuth();
  const { t, errorText } = useLanguage();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function recover() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/auth/password-reset/", "POST", {
        email: account!.user.email,
      });
      setMessage(t("recoverySent"));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-page">
      <header className="page-heading">
        <p className="eyebrow">{t("account")}</p>
        <h1 tabIndex={-1}>{t("accountTitle")}</h1>
        <p className="page-intro">{t("accountIntro")}</p>
      </header>
      {error && <Message>{error}</Message>}
      {message && <Message success>{message}</Message>}
      <section className="surface account-card">
        <div className="card-heading">
          <h2>{t("emailLogin")}</h2>
          <span className="status-pill">
            {t(account!.user.has_password ? "enabled" : "notSet")}
          </span>
        </div>
        <p className="account-email" dir="ltr">
          {account!.user.email}
        </p>
        <p>{t("passwordManage")}</p>
        <button
          type="button"
          className="button secondary"
          onClick={recover}
          disabled={busy}
        >
          {t(busy ? "sending" : "sendLink")}
        </button>
      </section>
      <section className="surface account-card">
        <div className="card-heading">
          <h2>{t("googleAccount")}</h2>
          <span className="status-pill">
            {t(account!.identities.includes("google") ? "linked" : "notLinked")}
          </span>
        </div>
        <p>{t("linkHelp")}</p>
        {!account!.identities.includes("google") && (
          <GoogleButton purpose="link" />
        )}
      </section>
      <aside className="privacy-note">
        <span aria-hidden="true">◇</span>
        <div>
          <h2>{t("accountPrivacyTitle")}</h2>
          <p>{t("accountPrivacyDetail")}</p>
        </div>
      </aside>
    </section>
  );
}
