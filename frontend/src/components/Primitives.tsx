import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="TrainFuel">
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M7 18V6h11M7 12h8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="18" cy="17" r="2" fill="currentColor" />
        </svg>
      </span>
      <span dir="ltr">
        TrainFuel<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="language-switch" role="group" aria-label={t("language")}>
      <button
        type="button"
        lang="en"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
      <button
        type="button"
        lang="ar"
        aria-pressed={language === "ar"}
        onClick={() => setLanguage("ar")}
      >
        العربية
      </button>
    </div>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
export function PasswordField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={t(visible ? "hidePassword" : "showPassword")}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="m4 4 16 16" />}
          </svg>
        </button>
      </div>
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}
export function Message({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      className={`message ${success ? "success" : "error"}`}
      role={success ? "status" : "alert"}
    >
      {children}
    </div>
  );
}
export function Icon({
  kind,
}: {
  kind: "training" | "nutrition" | "progress";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "training" ? (
        <>
          <path d="m6 6 12 12M3 8l5-5m8 18 5-5M2 5l3-3m14 20 3-3" />
          <path d="m4 10 6-6m4 16 6-6" />
        </>
      ) : kind === "nutrition" ? (
        <>
          <path d="M8 4v5a3 3 0 0 1-6 0V4m3 0v16m13 0V4c-4 2-4 7 0 8" />
        </>
      ) : (
        <>
          <path d="M4 4v16h16m-13-6 4-4 4 2 4-6" />
        </>
      )}
    </svg>
  );
}
