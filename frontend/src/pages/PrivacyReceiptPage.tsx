import { useState } from "react";
import { Link } from "react-router-dom";
import { apiWithHeaders } from "../api/client";
import { Message } from "../components/Primitives";
import { useLanguage } from "../contexts/LanguageContext";

type RequestReceipt = {
  job_id: string;
  kind: "export" | "delete";
  receipt_token: string;
  status_path: string;
};
type ReceiptStatus = { status: string; download_path?: string | null };
const text = {
  en: {
    title: "Privacy request",
    intro:
      "Check your request progress here. Your private receipt authorizes access to this request.",
    check: "Check status",
    download: "Download export",
    noReceipt: "No privacy request receipt is saved in this browser session.",
    pending: "Waiting to be processed",
    running: "Processing",
    ready: "Complete",
    failed:
      "Could not complete this request. Contact support with your receipt.",
    expired: "Expired",
    cancelled: "Cancelled",
    back: "Return to sign in",
    failedRequest:
      "Could not check the request. Try again when you are online.",
  },
  ar: {
    title: "طلب الخصوصية",
    intro: "تحقق من تقدم طلبك هنا. يتيح الإيصال الخاص الوصول إلى هذا الطلب.",
    check: "تحقق من الحالة",
    download: "تنزيل النسخة",
    noReceipt: "لا يوجد إيصال طلب خصوصية محفوظ في جلسة هذا المتصفح.",
    pending: "بانتظار المعالجة",
    running: "قيد المعالجة",
    ready: "اكتمل",
    failed: "تعذر إكمال الطلب. تواصل مع الدعم باستخدام الإيصال.",
    expired: "انتهت الصلاحية",
    cancelled: "أُلغي",
    back: "العودة لتسجيل الدخول",
    failedRequest: "تعذر التحقق من الطلب. حاول مجدداً عند الاتصال بالإنترنت.",
  },
} as const;
function loadReceipt(): RequestReceipt | null {
  try {
    const raw = sessionStorage.getItem("trainfuel.privacy-receipt");
    return raw ? (JSON.parse(raw) as RequestReceipt) : null;
  } catch {
    return null;
  }
}

export function PrivacyReceiptPage() {
  const { language } = useLanguage();
  const t = text[language];
  const [request] = useState(loadReceipt);
  const [status, setStatus] = useState<ReceiptStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      setStatus(
        await apiWithHeaders<ReceiptStatus>(
          request.status_path.replace("/api", ""),
          { "X-Privacy-Receipt": request.receipt_token },
        ),
      );
    } catch {
      setError(t.failedRequest);
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
          credentials: "same-origin",
          headers: { "X-Privacy-Receipt": request.receipt_token },
        },
      );
      if (!response.ok) throw new Error("download");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "trainfuel-personal-data.zip";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(t.failedRequest);
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    pending: t.pending,
    running: t.running,
    ready: t.ready,
    failed: t.failed,
    expired: t.expired,
    cancelled: t.cancelled,
  };
  return (
    <main className="loading-screen privacy-receipt-screen">
      <section className="surface account-card">
        <h1 tabIndex={-1}>{t.title}</h1>
        {request ? (
          <>
            <p>{t.intro}</p>
            <p>
              <strong>
                {labels[status?.status ?? "pending"] ?? status?.status}
              </strong>
            </p>
            <p dir="ltr">{request.job_id}</p>
            <div className="sync-actions">
              <button
                className="button secondary"
                onClick={check}
                disabled={busy}
              >
                {t.check}
              </button>
              {status?.download_path && (
                <button
                  className="button primary"
                  onClick={download}
                  disabled={busy}
                >
                  {t.download}
                </button>
              )}
            </div>
          </>
        ) : (
          <p>{t.noReceipt}</p>
        )}
        {error && <Message>{error}</Message>}
        <Link to="/login">{t.back}</Link>
      </section>
    </main>
  );
}
