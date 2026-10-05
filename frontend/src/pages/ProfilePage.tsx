import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import type { Profile } from "../types/accounts";
import { Field, Message } from "../components/Primitives";
import { saveProfile } from "../offline/database";
import { syncCopy } from "../sync/copy";

export function ProfilePage({ onboarding = false }: { onboarding?: boolean }) {
  const { account, setLocalAccount } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const profile = account!.profile;
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraft({
      ...profile,
      language: onboarding ? language : profile.language,
      timezone:
        onboarding && profile.timezone === "UTC"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : profile.timezone,
    });
  }, [profile.user_id, profile.revision, onboarding]);
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await saveProfile(account!, draft);
      const current = next.profile;
      setLocalAccount(next);
      setLanguage(current.language);
      setSaved(true);
      if (onboarding) navigate("/app", { replace: true });
    } catch {
      setError(
        language === "ar"
          ? "تعذّر الحفظ على هذا الجهاز. راجع الحقول ومساحة تخزين المتصفح."
          : "Could not save on this device. Check your fields and browser storage.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile-page">
      <header className="page-heading">
        <p className="eyebrow">{t("profile")}</p>
        <h1 tabIndex={-1}>{t(onboarding ? "onboardTitle" : "profileTitle")}</h1>
        <p className="page-intro">
          {t(onboarding ? "onboardIntro" : "profileIntro")}
        </p>
      </header>
      <form className="surface profile-form" onSubmit={submit} aria-busy={busy}>
        {error && <Message>{error}</Message>}
        {saved && <Message success>{syncCopy[language].saved}</Message>}
        <Field
          label={t("displayName")}
          autoComplete="nickname"
          required
          maxLength={100}
          value={draft.display_name}
          placeholder={t("namePlaceholder")}
          onChange={(event) => update("display_name", event.target.value)}
          disabled={busy}
        />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="profile-language">{t("language")}</label>
            <select
              id="profile-language"
              value={draft.language}
              onChange={(event) =>
                update("language", event.target.value as Profile["language"])
              }
              disabled={busy}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="profile-unit">{t("units")}</label>
            <select
              id="profile-unit"
              value={draft.weight_unit}
              onChange={(event) =>
                update(
                  "weight_unit",
                  event.target.value as Profile["weight_unit"],
                )
              }
              disabled={busy}
            >
              <option value="kg">{t("kilograms")}</option>
              <option value="lb">{t("pounds")}</option>
            </select>
          </div>
        </div>
        <Field
          label={t("timezone")}
          value={draft.timezone}
          required
          maxLength={100}
          list="timezones"
          dir="ltr"
          hint={t("timezoneHelp")}
          onChange={(event) => update("timezone", event.target.value)}
          disabled={busy}
        />
        <datalist id="timezones">
          {[
            "UTC",
            "Africa/Cairo",
            "Asia/Riyadh",
            "Asia/Dubai",
            "Europe/London",
            "America/New_York",
          ].map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <fieldset className="goal-fieldset">
          <legend>{t("goal")}</legend>
          <div className="goal-options">
            {(["cutting", "bulking"] as const).map((goal) => (
              <label
                key={goal}
                className={`goal-choice ${draft.goal === goal ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="goal"
                  value={goal}
                  checked={draft.goal === goal}
                  onChange={() => update("goal", goal)}
                  disabled={busy}
                />
                <span>
                  <strong>{t(goal)}</strong>
                  <small>
                    {t(goal === "cutting" ? "cuttingDetail" : "bulkingDetail")}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <p className="field-hint">{t("goalHelp")}</p>
        </fieldset>
        <Field
          label={`${t("height")} · ${t("optional")}`}
          type="number"
          min="0.001"
          step="0.001"
          value={draft.height_cm ?? ""}
          onChange={(event) => update("height_cm", event.target.value || null)}
          disabled={busy}
        />
        <button className="button primary" type="submit" disabled={busy}>
          {t(busy ? "saving" : onboarding ? "continue" : "save")}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </section>
  );
}
