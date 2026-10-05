import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Icon } from "../components/Primitives";

export function WorkspacePage() {
  const { account } = useAuth();
  const { t } = useLanguage();
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">
          {t("welcome")}, {account!.profile.display_name}
        </p>
        <h1 tabIndex={-1}>{t("workspaceTitle")}</h1>
        <p className="page-intro">{t("workspaceDescription")}</p>
      </header>
      <section className="welcome-card">
        <div>
          <span className="status-pill">✓ {t("profileReady")}</span>
          <h2>{t("profileCardTitle")}</h2>
          <p>{t("profileCardDescription")}</p>
          <Link className="button secondary" to="/app/profile">
            {t("editProfile")}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-ring" />
          <div className="art-ring second" />
          <span>↗</span>
        </div>
      </section>
      <section className="planned-section">
        <h2>{t("nextTitle")}</h2>
        <div className="feature-grid">
          {(["training", "nutrition", "progress"] as const).map((kind) => (
            <article className="surface feature-card" key={kind}>
              <span className={`feature-icon ${kind}`}>
                <Icon kind={kind} />
              </span>
              {kind === "training" ? (
                <Link className="button secondary" to="/app/training">
                  {t("training")}
                </Link>
              ) : (
                <span className="planned-label">{t("planned")}</span>
              )}
              <h3>{t(kind)}</h3>
              <p>
                {t(
                  kind === "training"
                    ? "trainingDescription"
                    : kind === "nutrition"
                      ? "nutritionDescription"
                      : "progressDescription",
                )}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
