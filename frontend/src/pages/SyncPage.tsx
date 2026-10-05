import {
  NutritionConflictFields,
  nutritionConflictMessage,
} from "../nutrition/ConflictFields";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useSync } from "../sync/SyncContext";
import { syncCopy } from "../sync/copy";
import { changed, db, resolve, type StagedMedia } from "../offline/database";
import { uploadStagedMedia } from "../offline/media";
import { Message } from "../components/Primitives";
import { TrainingConflictVersion } from "../training/ConflictVersion";
export function SyncPage() {
  const { account, sessionValid } = useAuth(),
    { language, t } = useLanguage(),
    { queue, busy, error, sync } = useSync();
  const copy = syncCopy[language],
    owner = account!.user.id;
  const [draftCount, setDraftCount] = useState(0),
    [media, setMedia] = useState<StagedMedia[]>([]),
    [localError, setLocalError] = useState("");
  useEffect(() => {
    let live = true;
    const load = async () => {
      const database = await db;
      const drafts = await database.getAllFromIndex("drafts", "owner", owner),
        staged = await database.getAllFromIndex("media", "owner", owner);
      if (live) {
        setDraftCount(drafts.length);
        setMedia(staged);
      }
    };
    void load();
    window.addEventListener("trainfuel-local-change", load);
    return () => {
      live = false;
      window.removeEventListener("trainfuel-local-change", load);
    };
  }, [owner]);
  async function action(task: () => Promise<unknown>) {
    try {
      setLocalError("");
      await task();
    } catch {
      setLocalError(copy.serverError);
    }
  }
  async function exportDrafts() {
    const rows = await (await db).getAllFromIndex("drafts", "owner", owner);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "trainfuel-recovered-drafts.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  function version(data: Record<string, unknown>) {
    if (
      ["translations", "entries", "sets", "tutorial_url", "folders"].some(
        (key) => key in data,
      )
    )
      return <TrainingConflictVersion data={data} />;
    if (["name", "local_date", "effective_date"].some((key) => key in data))
      return <NutritionConflictFields data={data} language={language} />;
    const labels: Record<string, [string, string]> = {
      local_date: ["Recorded date", "تاريخ القياس"],
      weight_kg: ["Weight (kg)", "الوزن (كجم)"],
      notes: ["Notes", "ملاحظات"],
      week_start: ["Assigned week", "الأسبوع المخصص"],
      capture_date: ["Capture date", "تاريخ التصوير"],
      label: ["Label", "الوصف"],
      category: ["Reminder category", "نوع التذكير"],
      local_time: ["Local time", "الوقت المحلي"],
      weekdays: ["Weekdays", "أيام الأسبوع"],
      enabled: ["Enabled", "مفعّل"],
    };
    if (Object.keys(labels).some((key) => key in data))
      return (
        <dl className="version-fields">
          {Object.entries(labels)
            .filter(([key]) => key in data)
            .map(([key, text]) => (
              <div key={key}>
                <dt>{text[language === "ar" ? 1 : 0]}</dt>
                <dd>{String(data[key] ?? "—")}</dd>
              </div>
            ))}
        </dl>
      );
    const fields = [
      ["display_name", "displayName"],
      ["timezone", "timezone"],
      ["weight_unit", "units"],
      ["language", "language"],
      ["goal", "goal"],
      ["height_cm", "height"],
    ] as const;
    return (
      <dl className="version-fields">
        {fields
          .filter(([key]) => key in data)
          .map(([key, label]) => {
            const value = data[key];
            let text = value == null ? "—" : String(value);
            if (key === "weight_unit")
              text = value === "kg" ? t("kilograms") : t("pounds");
            if (key === "goal" && (value === "cutting" || value === "bulking"))
              text = t(value);
            if (key === "language")
              text = value === "ar" ? "العربية" : "English";
            return (
              <div key={key}>
                <dt>{t(label)}</dt>
                <dd>{text}</dd>
              </div>
            );
          })}
      </dl>
    );
  }
  return (
    <section className="sync-page">
      <header className="page-heading">
        <p className="eyebrow">TrainFuel</p>
        <h1 tabIndex={-1}>{copy.title}</h1>
        <p className="page-intro">{copy.intro}</p>
      </header>
      {!sessionValid && (
        <Message>
          {copy.paused} <Link to="/login">{copy.signin}</Link>
        </Message>
      )}
      {(error || localError) && <Message>{copy.serverError}</Message>}
      <div className="surface sync-summary">
        <strong role="status">
          {busy
            ? copy.syncing
            : queue.some((op) => op.status !== "pending")
              ? copy.attention
              : queue.length
                ? copy.pending
                : copy.synced}
        </strong>
        <button
          className="button primary"
          disabled={busy || !sessionValid || !navigator.onLine}
          onClick={() => action(sync)}
        >
          {copy.sync}
        </button>
      </div>
      {!queue.length && <p>{copy.empty}</p>}
      {queue.map((op) => (
        <article className="surface sync-operation" key={op.idempotency_key}>
          <h2>{op.entity_type === "profile" ? t("profile") : copy.title}</h2>
          <p>{op.status === "pending" ? copy.pending : copy.attention}</p>
          {op.code === "week_full" && (
            <p>
              {language === "ar"
                ? "الأسبوع ممتلئ. عدّل المسودة إلى أسبوع آخر أو استبدل صورة مقبولة. الملف محفوظ."
                : "This week is full. Edit the draft to another week or replace an accepted photo. Your file is retained."}
            </p>
          )}
          {op.entity_type === "progress_photo" && op.status !== "pending" && (
            <Link to="/app/progress">
              {language === "ar" ? "مراجعة مسودة الصورة" : "Review photo draft"}
            </Link>
          )}
          {op.status !== "pending" && (
            <>
              <div className="conflict-versions">
                <div>
                  <h3>{copy.local}</h3>
                  {version(op.payload)}
                </div>
                <div>
                  <h3>{copy.server}</h3>
                  {op.current ? (
                    version(op.current)
                  ) : (
                    <p>
                      {nutritionConflictMessage(op.code, language) ??
                        copy.deleted}
                    </p>
                  )}
                </div>
              </div>
              <div className="sync-actions">
                {op.current && op.status === "conflict" && (
                  <button
                    className="button primary"
                    onClick={() =>
                      action(() => resolve(owner, op.idempotency_key, "local"))
                    }
                  >
                    {copy.keep}
                  </button>
                )}
                <button
                  className="button secondary"
                  onClick={() =>
                    action(() => resolve(owner, op.idempotency_key, "server"))
                  }
                >
                  {copy.use}
                </button>
              </div>
            </>
          )}
        </article>
      ))}
      {draftCount > 0 && (
        <div className="surface sync-summary">
          <h2>
            {copy.drafts} ({draftCount})
          </h2>
          <button
            className="button secondary"
            onClick={() => action(exportDrafts)}
          >
            {copy.export}
          </button>
        </div>
      )}
      {media.length > 0 && (
        <div className="surface sync-operation">
          <h2>{copy.media}</h2>
          {media.map((item) => (
            <div className="sync-actions" key={item.id}>
              <span>
                {t(item.purpose === "exercise" ? "training" : "progress")} ·{" "}
                {Math.ceil(item.blob.size / 1024)} KB
                {item.error ? " · " + copy.attention : ""}
              </span>
              <button
                className="button secondary"
                disabled={!sessionValid}
                onClick={() => action(() => uploadStagedMedia(owner, item.id))}
              >
                {copy.retry}
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  action(async () => {
                    await (await db).delete("media", item.id);
                    changed();
                  })
                }
              >
                {copy.remove}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
