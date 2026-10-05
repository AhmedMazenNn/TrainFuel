import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiWithHeaders, ApiError } from "../api/client";
import { Field, Message } from "../components/Primitives";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

type Receipt = {
  job_id: string;
  kind: "export" | "delete";
  status: string;
  error_code?: string | null;
  download_path?: string | null;
};
type RequestResult = {
  job_id: string;
  kind: Receipt["kind"];
  status: string;
  receipt_token: string;
  status_path: string;
};
const copy = {
  en: {
    title: "Your data and privacy",
    intro:
      "Download a copy of your TrainFuel data or request permanent account removal.",
    export: "Download your data",
    exportText:
      "We prepare a private ZIP containing your profile and saved training, nutrition, and progress data. Photos are excluded unless you choose to include them.",
    photos: "Include my progress photo originals",
    prepare: "Prepare export",
    deletion: "Delete your account",
    deletionText:
      "This permanently removes your account, personal records, and private media. You will be signed out while cleanup runs.",
    confirmEmail: "Confirm account email",
    password: "Current password",
    deleteButton: "Request permanent deletion",
    receipt: "Request receipt",
    check: "Check status",
    download: "Download ZIP",
    pending: "Waiting to be processed",
    running: "Processing",
    ready: "Complete",
    failed:
      "Could not complete this request. Contact support with your receipt.",
    cancelled: "Cancelled",
    expired: "Expired",
    statusTitle: "Your request",
    invalid: "This receipt is no longer available in this browser.",
    reauth: "Sign in again before making a privacy request.",
    confirm: "Please enter your account email and confirm permanent deletion.",
    error:
      "We could not complete this request. Check your connection and try again.",
    typed: "I understand this action permanently deletes my account and data.",
    warning:
      "Deletion cannot be undone. Make sure any export you need is ready first.",
    cancel: "Cancel",
    reauthTitle: "Confirm it is you",
    includePhotosHelp:
      "Progress photos can contain sensitive information. Include them only if you want the originals in the export.",
  },
  ar: {
    title: "بياناتك وخصوصيتك",
    intro: "نزّل نسخة من بياناتك أو اطلب حذف حسابك نهائياً.",
    export: "تنزيل بياناتك",
    exportText:
      "نجهّز ملف ZIP خاصاً يتضمن ملفك الشخصي وبيانات التدريب والتغذية والتقدم. لن تُضمّن الصور إلا إذا اخترت ذلك.",
    photos: "تضمين الصور الأصلية لتقدمي",
    prepare: "إعداد النسخة",
    deletion: "حذف حسابك",
    deletionText:
      "سيؤدي ذلك نهائياً إلى حذف حسابك وسجلاتك الشخصية ووسائطك الخاصة. سيتم تسجيل خروجك أثناء التنظيف.",
    confirmEmail: "تأكيد بريد الحساب",
    password: "كلمة المرور الحالية",
    deleteButton: "طلب الحذف النهائي",
    receipt: "إيصال الطلب",
    check: "تحقق من الحالة",
    download: "تنزيل ملف ZIP",
    pending: "بانتظار المعالجة",
    running: "قيد المعالجة",
    ready: "اكتمل",
    failed: "تعذر إكمال الطلب. تواصل مع الدعم باستخدام الإيصال.",
    cancelled: "أُلغي",
    expired: "انتهت الصلاحية",
    statusTitle: "حالة طلبك",
    invalid: "لم يعد هذا الإيصال متاحاً في هذا المتصفح.",
    reauth: "سجّل الدخول مجدداً قبل إرسال طلب الخصوصية.",
    confirm: "أدخل بريد حسابك وأكّد رغبتك في الحذف النهائي.",
    error: "تعذر إكمال الطلب. تحقق من الاتصال وحاول مجدداً.",
    typed: "أفهم أن هذا الإجراء سيحذف حسابي وبياناتي نهائياً.",
    warning: "لا يمكن التراجع عن الحذف. تأكد من تجهيز أي نسخة تحتاجها أولاً.",
    cancel: "إلغاء",
    reauthTitle: "تأكيد هويتك",
    includePhotosHelp:
      "قد تحتوي صور التقدم على معلومات حساسة. أضف النسخ الأصلية فقط إذا رغبت بذلك.",
  },
} as const;

function savedReceipt(): RequestResult | null {
  try {
    const value = sessionStorage.getItem("trainfuel.privacy-receipt");
    return value ? (JSON.parse(value) as RequestResult) : null;
  } catch {
    return null;
  }
}

export function PrivacyPage() {
  const { account, signOut } = useAuth();
  const { language, errorText } = useLanguage();
  const t = copy[language];
  const navigate = useNavigate();
  const [includePhotos, setIncludePhotos] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [request, setRequest] = useState<RequestResult | null>(savedReceipt);
  const [status, setStatus] = useState<Receipt | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function keepReceipt(value: RequestResult) {
    setRequest(value);
    setStatus(null);
    try {
      sessionStorage.setItem(
        "trainfuel.privacy-receipt",
        JSON.stringify(value),
      );
    } catch {
      /* Receipt remains visible for this page session. */
    }
  }
  function fail(caught: unknown) {
    setError(
      caught instanceof ApiError &&
        caught.data.code === "reauthentication_required"
        ? t.reauth
        : errorText(caught) || t.error,
    );
  }
  async function exportData() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<RequestResult>("/privacy/exports/", "POST", {
        include_photos: includePhotos,
      });
      keepReceipt(result);
      setMessage(t.pending);
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<RequestResult>(
        "/privacy/account-deletion/",
        "POST",
        {
          confirmation_email: confirmEmail,
          ...(account!.user.has_password ? { password } : {}),
        },
      );
      keepReceipt(result);
      setMessage(t.pending);
      await signOut(true);
      navigate("/privacy/request", { replace: true });
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }
  async function checkStatus() {
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiWithHeaders<Receipt>(
        request.status_path.replace("/api", ""),
        { "X-Privacy-Receipt": request.receipt_token },
      );
      setStatus(result);
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!request || !status?.download_path) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api${status.download_path.replace(/^\/api/, "")}`,
        {
          credentials: "include",
          headers: { "X-Privacy-Receipt": request.receipt_token },
        },
      );
      if (!response.ok) throw new Error("download");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "trainfuel-personal-data.zip";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  const statusLabel = status
    ? ((
        {
          pending: t.pending,
          running: t.running,
          ready: t.ready,
          failed: t.failed,
          cancelled: t.cancelled,
          expired: t.expired,
        } as Record<string, string>
      )[status.status] ?? status.status)
    : "";
  return (
    <section className="account-page privacy-page">
      <header className="page-heading">
        <p className="eyebrow">{t.title}</p>
        <h1 tabIndex={-1}>{t.title}</h1>
        <p className="page-intro">{t.intro}</p>
      </header>
      {error && <Message>{error}</Message>}
      {message && <Message success>{message}</Message>}
      <section className="surface account-card">
        <h2>{t.export}</h2>
        <p>{t.exportText}</p>
        <label className="privacy-check">
          <input
            type="checkbox"
            checked={includePhotos}
            onChange={(e) => setIncludePhotos(e.target.checked)}
            disabled={busy}
          />
          <span>
            <strong>{t.photos}</strong>
            <small>{t.includePhotosHelp}</small>
          </span>
        </label>
        <button
          className="button primary"
          type="button"
          onClick={exportData}
          disabled={busy}
        >
          {t.prepare}
        </button>
      </section>
      <section className="surface account-card danger-card">
        <h2>{t.deletion}</h2>
        <p>{t.deletionText}</p>
        <p className="field-hint">{t.warning}</p>
        <form onSubmit={deleteAccount}>
          <Field
            label={t.confirmEmail}
            type="email"
            autoComplete="email"
            dir="ltr"
            required
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            disabled={busy}
          />
          {account!.user.has_password && (
            <Field
              label={t.password}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          )}
          <label className="privacy-check">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
            />
            <span>{t.typed}</span>
          </label>
          <button
            className="button danger"
            type="submit"
            disabled={busy || !confirmed}
          >
            {t.deleteButton}
          </button>
        </form>
      </section>
      {request && (
        <section
          className="surface account-card privacy-receipt"
          aria-live="polite"
        >
          <div className="card-heading">
            <h2>{t.statusTitle}</h2>
            <span className="status-pill">{statusLabel || t.pending}</span>
          </div>
          <p>
            {t.receipt}: <code dir="ltr">{request.job_id}</code>
          </p>
          <div className="sync-actions">
            <button
              className="button secondary"
              type="button"
              onClick={checkStatus}
              disabled={busy}
            >
              {t.check}
            </button>
            {status?.download_path && (
              <button
                className="button primary"
                type="button"
                onClick={download}
                disabled={busy}
              >
                {t.download}
              </button>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
