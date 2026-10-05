import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Field, Message } from "../components/Primitives";
import { db, stageMedia, type LocalEntity } from "../offline/database";
import { useSync } from "../sync/SyncContext";
import { progressCopy } from "./copy";
import {
  cachePreference,
  clearPhotoCache,
  displayWeight,
  kg,
  monday,
  photoBlob,
  records,
  remove,
  save,
  today,
} from "./storage";
function Photo({
  owner,
  row,
  original = false,
}: {
  owner: string;
  row: LocalEntity;
  original?: boolean;
}) {
  const [url, setUrl] = useState("");
  const { language } = useLanguage();
  useEffect(() => {
    let active = true;
    let object = "";
    setUrl("");
    (async () => {
      const data = row.data!;
      let blob: Blob;
      if (typeof data.local_media_id === "string") {
        const staged = await (await db).get("media", data.local_media_id);
        if (!staged || staged.owner !== owner) throw Error();
        blob = staged.blob;
      } else
        blob = await photoBlob(
          owner,
          String(data.asset_id),
          original ? "original" : "thumbnail",
        );
      if (active) {
        object = URL.createObjectURL(blob);
        setUrl(object);
      }
    })().catch(() => {});
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [owner, row.id, row.revision, original]);
  return url ? (
    <img
      src={url}
      alt={String(row.data?.label || row.data?.capture_date || "")}
      className={original ? "progress-original" : "progress-image"}
    />
  ) : (
    <p>{progressCopy[language].missing}</p>
  );
}
export function ProgressPage() {
  const { account } = useAuth();
  const { language } = useLanguage();
  const c = progressCopy[language];
  const { sync } = useSync();
  const owner = account!.user.id;
  const unit = account!.profile.weight_unit;
  const [weights, setWeights] = useState<LocalEntity[]>([]),
    [photos, setPhotos] = useState<LocalEntity[]>([]);
  const [date, setDate] = useState(today(account!.profile.timezone)),
    [weight, setWeight] = useState(""),
    [notes, setNotes] = useState(""),
    [edit, setEdit] = useState<LocalEntity>();
  const [week, setWeek] = useState(monday(date)),
    [capture, setCapture] = useState(date),
    [label, setLabel] = useState(""),
    [photoNotes, setPhotoNotes] = useState(""),
    [photoEdit, setPhotoEdit] = useState<LocalEntity>(),
    [file, setFile] = useState<File>(),
    [cached, setCached] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [left, setLeft] = useState(""),
    [right, setRight] = useState(""),
    [leftPhoto, setLeftPhoto] = useState(""),
    [rightPhoto, setRightPhoto] = useState(""),
    [side, setSide] = useState(0),
    [zoom, setZoom] = useState<LocalEntity>();
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoomScale, setZoomScale] = useState(1);
  useEffect(() => {
    const reload = () => {
      void records(owner, "weight_entry").then((rows) =>
        setWeights(
          rows.sort((a, b) =>
            String(a.data!.local_date).localeCompare(
              String(b.data!.local_date),
            ),
          ),
        ),
      );
      void records(owner, "progress_photo").then(setPhotos);
      void cachePreference(owner).then(setCached);
    };
    reload();
    window.addEventListener("trainfuel-local-change", reload);
    return () => window.removeEventListener("trainfuel-local-change", reload);
  }, [owner]);
  useEffect(() => {
    if (edit) setWeight(displayWeight(edit.data!.weight_kg, unit));
  }, [unit]);
  async function weightSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const duplicate = weights.find(
        (row) => row.data!.local_date === date && row.id !== edit?.id,
      );
      if (duplicate) {
        setError(
          language === "en"
            ? "This date already has a measurement. Edit that record explicitly."
            : "يوجد قياس لهذا التاريخ. عدّل السجل الحالي.",
        );
        return;
      }
      await save(
        owner,
        "weight_entry",
        {
          local_date: date,
          weight_kg:
            edit && weight === displayWeight(edit.data!.weight_kg, unit)
              ? edit.data!.weight_kg
              : kg(weight, unit),
          notes,
        },
        edit,
      );
      setMessage(c.saved);
      setWeight("");
      setNotes("");
      setEdit(undefined);
    } catch {
      setError(c.error);
    }
  }
  async function photoSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (monday(week) !== week) throw Error();
      let localId: string | undefined;
      if (file) localId = await stageMedia(owner, file, "progress");
      if (!localId && !photoEdit) throw Error();
      await save(
        owner,
        "progress_photo",
        {
          week_start: week,
          capture_date: capture,
          label,
          notes: photoNotes,
          ...(localId
            ? { local_media_id: localId }
            : photoEdit!.data!.local_media_id
              ? { local_media_id: photoEdit!.data!.local_media_id }
              : { asset_id: photoEdit!.data!.asset_id }),
        },
        photoEdit,
      );
      setFile(undefined);
      setPhotoEdit(undefined);
      setMessage(c.staged);
    } catch {
      setError(c.error);
    }
  }
  async function erase(row: LocalEntity) {
    if (!window.confirm(c.confirm)) return;
    try {
      await remove(owner, row);
      if (row.type === "progress_photo")
        await clearPhotoCache(owner, String(row.data!.asset_id));
      setMessage(c.saved);
    } catch {
      setError(c.error);
    }
  }
  const weeks = Array.from(
    new Set(photos.map((row) => String(row.data!.week_start))),
  )
    .sort()
    .reverse();
  const selectedLeft = photos.filter(
    (row) => row.data!.week_start === (left || weeks[0]),
  );
  const selectedRight = photos.filter(
    (row) => row.data!.week_start === (right || weeks[1] || weeks[0]),
  );
  const a = selectedLeft.find((r) => r.id === leftPhoto) || selectedLeft[0];
  const b =
    selectedRight.find((r) => r.id === rightPhoto) ||
    selectedRight.find(
      (r) => r.data!.label && r.data!.label === a?.data!.label,
    ) ||
    selectedRight[0];
  function summary(start: string) {
    const end = new Date(`${start}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const list = weights.filter(
      (r) =>
        String(r.data!.local_date) >= start &&
        String(r.data!.local_date) < end.toISOString().slice(0, 10),
    );
    return list.length
      ? `${list.map((r) => `${r.data!.local_date}: ${displayWeight(r.data!.weight_kg, unit)} ${unit}`).join(" · ")}`
      : c.unknown;
  }
  return (
    <section className="progress-page">
      <header className="page-heading">
        <p className="eyebrow">TrainFuel</p>
        <h1 tabIndex={-1}>{c.title}</h1>
        <p>{c.intro}</p>
        <button
          className="button secondary"
          onClick={() => void sync().catch(() => setError(c.error))}
        >
          {c.sync}
        </button>
      </header>
      {message && <Message success>{message}</Message>}
      {error && <Message>{error}</Message>}
      <div className="progress-columns">
        <section className="settings-card">
          <h2>{c.weight}</h2>
          <form onSubmit={weightSave}>
            <Field
              label={c.date}
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
            <Field
              label={`${c.weight} (${unit})`}
              type="number"
              min="0.001"
              step="0.001"
              value={weight}
              required
              onChange={(e) => setWeight(e.target.value)}
            />
            <Field
              label={c.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={5000}
            />
            <button className="button primary">{c.save}</button>
            {edit && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setEdit(undefined);
                  setWeight("");
                }}
              >
                {c.cancel}
              </button>
            )}
          </form>
          <h3>{c.history}</h3>
          <p>{c.gaps}</p>
          <WeightChart rows={weights} unit={unit} />
          <ul className="progress-history">
            {weights.map((row) => (
              <li key={row.id}>
                <span>
                  {String(row.data!.local_date)} ·{" "}
                  <strong>
                    {displayWeight(row.data!.weight_kg, unit)} {unit}
                  </strong>
                  <br />
                  {String(row.data!.notes)}
                </span>
                <button
                  onClick={() => {
                    setEdit(row);
                    setDate(String(row.data!.local_date));
                    setWeight(displayWeight(row.data!.weight_kg, unit));
                    setNotes(String(row.data!.notes));
                  }}
                >
                  {c.edit}
                </button>
                <button onClick={() => void erase(row)}>{c.delete}</button>
              </li>
            ))}
          </ul>
          {!weights.length && <p>{c.empty}</p>}
        </section>
        <section className="settings-card">
          <h2>{c.photos}</h2>
          <p>{c.limit}</p>
          <form onSubmit={photoSave}>
            <Field
              label={c.week}
              type="date"
              required
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
            <Field
              label={c.capture}
              type="date"
              required
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
            />
            <Field
              label={c.label}
              value={label}
              maxLength={100}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Field
              label={c.notes}
              value={photoNotes}
              maxLength={5000}
              onChange={(e) => setPhotoNotes(e.target.value)}
            />
            <Field
              label={c.file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required={!photoEdit}
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            <button className="button primary">
              {photoEdit ? c.save : c.add}
            </button>
            {photoEdit && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setPhotoEdit(undefined)}
              >
                {c.cancel}
              </button>
            )}
          </form>
          <label className="progress-cache">
            <input
              type="checkbox"
              checked={cached}
              onChange={(e) => {
                setCached(e.target.checked);
                void cachePreference(owner, e.target.checked);
              }}
            />
            {c.cache}
          </label>
          <button
            onClick={async () => {
              await clearPhotoCache(owner);
              setMessage(
                language === "ar"
                  ? "تم مسح الصور المحفوظة"
                  : "Cached photos cleared",
              );
            }}
          >
            {c.clear}
          </button>
          <div className="progress-gallery">
            {photos.map((row) => (
              <article key={row.id}>
                <Photo owner={owner} row={row} />
                <p>
                  <strong>{String(row.data!.label)}</strong>{" "}
                  {String(row.data!.capture_date)}
                  <br />
                  {String(row.data!.week_start)} · {String(row.data!.notes)}
                </p>
                <button
                  onClick={() => {
                    setPhotoEdit(row);
                    setWeek(String(row.data!.week_start));
                    setCapture(String(row.data!.capture_date));
                    setLabel(String(row.data!.label));
                    setPhotoNotes(String(row.data!.notes));
                    setFile(undefined);
                  }}
                >
                  {c.edit} / {c.replace}
                </button>
                <button onClick={() => void erase(row)}>{c.delete}</button>
                <button
                  onClick={() => {
                    setZoom(row);
                    dialog.current?.showModal();
                  }}
                >
                  {c.zoom}
                </button>
              </article>
            ))}
          </div>
          {!photos.length && <p>{c.empty}</p>}
        </section>
      </div>
      <section className="settings-card">
        <h2>{c.compare}</h2>
        <div className="progress-columns">
          {[
            [c.left, left, setLeft, selectedLeft, leftPhoto, setLeftPhoto],
            [
              c.right,
              right,
              setRight,
              selectedRight,
              rightPhoto,
              setRightPhoto,
            ],
          ].map((item, index) => (
            <div key={index}>
              <label>
                {String(item[0])}
                <select
                  value={(item[1] as string) || weeks[index] || weeks[0] || ""}
                  onChange={(e) =>
                    (item[2] as (v: string) => void)(e.target.value)
                  }
                >
                  {weeks.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              <label>
                {c.choose}
                <select
                  value={(item[4] as string) || ((index ? b : a)?.id ?? "")}
                  onChange={(e) =>
                    (item[5] as (v: string) => void)(e.target.value)
                  }
                >
                  {(item[3] as LocalEntity[]).map((r) => (
                    <option key={r.id} value={r.id}>
                      {String(r.data!.label || r.data!.capture_date)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
        <div className="progress-mobile-toggle">
          <button onClick={() => setSide(0)} aria-pressed={side === 0}>
            {c.left}
          </button>
          <button onClick={() => setSide(1)} aria-pressed={side === 1}>
            {c.right}
          </button>
        </div>
        <div className="progress-comparison">
          {[a, b].map((row, index) =>
            row ? (
              <article
                key={row.id + index}
                className={side === index ? "selected" : ""}
              >
                <Photo owner={owner} row={row} />
                <p>
                  {String(row.data!.capture_date)} · {String(row.data!.label)}
                </p>
                <p>{summary(String(row.data!.week_start))}</p>
                <button
                  onClick={() => {
                    setZoom(row);
                    dialog.current?.showModal();
                  }}
                >
                  {c.zoom}
                </button>
              </article>
            ) : (
              <p key={index}>{c.empty}</p>
            ),
          )}
        </div>
      </section>
      <dialog
        ref={dialog}
        className="progress-zoom"
        onClose={() => {
          setZoom(undefined);
          setZoomScale(1);
        }}
        aria-label={c.zoom}
      >
        <button onClick={() => dialog.current?.close()}>{c.close}</button>
        {zoom && (
          <>
            <label>
              {c.zoom}
              <input
                type="range"
                min="1"
                max="3"
                step="0.25"
                value={zoomScale}
                onChange={(event) => setZoomScale(Number(event.target.value))}
              />
            </label>
            <div className="progress-zoom-canvas">
              <div style={{ width: `${zoomScale * 100}%` }}>
                <Photo owner={owner} row={zoom} original />
              </div>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
function WeightChart({ rows, unit }: { rows: LocalEntity[]; unit: string }) {
  const { language } = useLanguage();
  if (!rows.length) return null;
  const values = rows.map((r) => Number(r.data!.weight_kg));
  const low = Math.min(...values) - 1,
    high = Math.max(...values) + 1;
  const first = Date.parse(String(rows[0].data!.local_date));
  const last = Date.parse(String(rows.at(-1)!.data!.local_date));
  const x = (r: LocalEntity) =>
    20 +
    ((Date.parse(String(r.data!.local_date)) - first) /
      Math.max(86400000, last - first)) *
      560;
  const y = (r: LocalEntity) =>
    150 - ((Number(r.data!.weight_kg) - low) / (high - low)) * 130;
  return (
    <svg
      className="weight-chart"
      viewBox="0 0 600 180"
      role="img"
      aria-label={`${progressCopy[language].weight} (${unit}); ${progressCopy[language].history}`}
    >
      {rows.map((r, i) => (
        <g key={r.id}>
          {i > 0 &&
            Date.parse(String(r.data!.local_date)) -
              Date.parse(String(rows[i - 1].data!.local_date)) ===
              86400000 && (
              <line
                x1={x(rows[i - 1])}
                y1={y(rows[i - 1])}
                x2={x(r)}
                y2={y(r)}
                stroke="currentColor"
              />
            )}
          <circle cx={x(r)} cy={y(r)} r="4" fill="currentColor" />
          <title>
            {String(r.data!.local_date)}:{" "}
            {displayWeight(r.data!.weight_kg, unit)} {unit}
          </title>
        </g>
      ))}
    </svg>
  );
}
