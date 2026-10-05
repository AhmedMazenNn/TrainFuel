import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import type { Account } from "../types/accounts";
import {
  Brand,
  Field,
  Icon,
  LanguageSwitch,
  Message,
  PasswordField,
} from "../components/Primitives";
import { GoogleButton } from "../components/GoogleButton";

type Mode = "login" | "register" | "recovery" | "reset";
export function AuthPage({ mode }: { mode: Mode }) {
  const { t, errorText } = useLanguage();
  const { account, setAccount, unavailable, loading, sessionValid } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  useEffect(() => {
    setPassword("");
    setError("");
    setSuccess(false);
  }, [mode]);
  if (loading)
    return (
      <div className="loading-screen" role="status">
        {t("loading")}
      </div>
    );
  if (account && sessionValid && (mode === "login" || mode === "register"))
    return (
      <Navigate
        to={account.profile.display_name ? "/app" : "/onboarding"}
        replace
      />
    );
  const titles = {
    login: "loginTitle",
    register: "registerTitle",
    recovery: "recoveryTitle",
    reset: "resetTitle",
  } as const;
  const intros = {
    login: "loginIntro",
    register: "registerIntro",
    recovery: "recoveryIntro",
    reset: "resetIntro",
  } as const;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login" || mode === "register") {
        setAccount(
          await api<Account>(`/auth/${mode}/`, "POST", { email, password }),
        );
        setPassword("");
      } else if (mode === "recovery") {
        await api("/auth/password-reset/", "POST", { email });
        setSuccess(true);
      } else {
        await api("/auth/password-reset/confirm/", "POST", {
          uid: params.get("uid") || "",
          token: params.get("token") || "",
          password,
        });
        setAccount(null);
        setPassword("");
        setSuccess(true);
      }
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="public-header">
        <Brand />
        <LanguageSwitch />
      </header>
      <main id="main" className="auth-layout">
        <section className="auth-story" aria-label={t("heroEyebrow")}>
          <div className="story-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">{t("heroEyebrow")}</p>
          <h2>{t("heroTitle")}</h2>
          <p className="story-description">{t("heroDescription")}</p>
          <div className="story-features">
            {(["training", "nutrition", "progress"] as const).map((kind, i) => (
              <div className="story-feature" key={kind}>
                <span className="story-icon">
                  <Icon kind={kind} />
                </span>
                <div>
                  <h3>
                    {t(
                      (
                        [
                          "heroWorkout",
                          "heroNutrition",
                          "heroProgress",
                        ] as const
                      )[i],
                    )}
                  </h3>
                  <p>
                    {t(
                      (
                        [
                          "heroWorkoutDetail",
                          "heroNutritionDetail",
                          "heroProgressDetail",
                        ] as const
                      )[i],
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="story-footnote">{t("heroFootnote")}</p>
        </section>
        <section className="auth-form-panel">
          <div className="auth-form-wrap">
            <p className="eyebrow">{t("brandTag")}</p>
            <h1 tabIndex={-1}>{t(titles[mode])}</h1>
            <p className="page-intro">{t(intros[mode])}</p>
            {unavailable && <Message>{t("networkError")}</Message>}
            {error && <Message>{error}</Message>}
            {success ? (
              <>
                <Message success>
                  {t(mode === "reset" ? "resetSuccess" : "recoverySent")}
                </Message>
                <Link className="button primary" to="/login">
                  {t("backToLogin")}
                </Link>
              </>
            ) : (
              <form onSubmit={submit} aria-busy={busy}>
                {mode !== "reset" && (
                  <Field
                    label={t("email")}
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder={t("emailPlaceholder")}
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                  />
                )}
                {mode !== "recovery" && (
                  <PasswordField
                    label={t(mode === "reset" ? "newPassword" : "password")}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={mode === "login" ? undefined : 8}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    hint={mode !== "login" ? t("passwordHelp") : undefined}
                    disabled={busy}
                  />
                )}
                {mode === "login" && (
                  <Link className="forgot-link" to="/forgot-password">
                    {t("forgot")}
                  </Link>
                )}
                <button
                  type="submit"
                  className="button primary"
                  disabled={busy}
                >
                  {t(
                    busy
                      ? mode === "login"
                        ? "signingIn"
                        : mode === "register"
                          ? "creating"
                          : "saving"
                      : mode === "login"
                        ? "signIn"
                        : mode === "register"
                          ? "createAccount"
                          : mode === "recovery"
                            ? "sendLink"
                            : "resetPassword",
                  )}
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
            )}
            {(mode === "login" || mode === "register") && (
              <>
                <div className="separator">
                  <span>{t("or")}</span>
                </div>
                <GoogleButton purpose="signin" />
                <p className="auth-alternative">
                  {t(mode === "login" ? "noAccount" : "haveAccount")}{" "}
                  <Link to={mode === "login" ? "/register" : "/login"}>
                    {t(mode === "login" ? "createAccount" : "signIn")}
                  </Link>
                </p>
              </>
            )}
            {(mode === "recovery" || (mode === "reset" && !success)) && (
              <Link className="back-link" to="/login">
                {t("backToLogin")}
              </Link>
            )}
            <p className="auth-privacy">
              <span aria-hidden="true">◇</span>
              {t("authPrivacy")}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
