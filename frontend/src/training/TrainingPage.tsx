import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useSync } from "../sync/SyncContext";
import { Field, Message } from "../components/Primitives";
import { api } from "../api/client";
import { changed, db, stageMedia, type StagedMedia } from "../offline/database";
import { privateMediaBlob, uploadStagedMedia } from "../offline/media";
import { trainingCopy, labels } from "./copy";
import {
  list,
  refresh,
  save,
  remove,
  downloadFolder,
  removeDownload,
  reorder,
  type EntityType,
} from "./repository";
import {
  translation,
  newSet,
  weight,
  kilogram,
  type Exercise,
  type Folder,
  type Annotation,
  type LiftRecord,
  type LiftSet,
  type Entity,
} from "./types";
import "./training.css";

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      className="training-dialog"
      ref={ref}
      onCancel={close}
      aria-labelledby="training-dialog-title"
    >
      <h2 id="training-dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}
function Select({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function SetEditor({
  sets,
  onChange,
}: {
  sets: LiftSet[];
  onChange: (s: LiftSet[]) => void;
}) {
  const { account } = useAuth(),
    { language } = useLanguage(),
    c = trainingCopy[language],
    unit = account!.profile.weight_unit;
  const move = (index: number, delta: number) => {
    const next = [...sets];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return (
    <div className="training-sets">
      <p className="field-hint">
        {c.units} {unit}
      </p>
      {sets.map((set, index) => (
        <fieldset className="training-set" key={set.id}>
          <legend>
            {c.ordinal} {index + 1}
          </legend>
          <Field
            label={`${c.weight} (${unit})`}
            type="number"
            min="0"
            step="0.001"
            required
            value={weight(set.weight_kg, unit)}
            onChange={(e) =>
              onChange(
                sets.map((s) =>
                  s.id === set.id
                    ? { ...s, weight_kg: kilogram(e.target.value, unit) }
                    : s,
                ),
              )
            }
          />
          <Field
            label={c.reps}
            type="number"
            min="1"
            step="1"
            required
            value={set.reps}
            onChange={(e) =>
              onChange(
                sets.map((s) =>
                  s.id === set.id ? { ...s, reps: Number(e.target.value) } : s,
                ),
              )
            }
          />
          <div className="training-actions">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={`${c.moveUp} ${c.ordinal} ${index + 1}`}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={index === sets.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`${c.moveDown} ${c.ordinal} ${index + 1}`}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(sets.filter((s) => s.id !== set.id))}
            >
              {c.remove}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() => onChange([...sets, newSet()])}
      >
        {c.addSet}
      </button>
    </div>
  );
}
function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  const { account } = useAuth(),
    { language } = useLanguage(),
    c = trainingCopy[language],
    owner = account!.user.id;
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true,
      objectUrl = "";
    setUrl("");
    const load = async () => {
      const asset = exercise.media[0]?.asset_id;
      if (!asset) return;
      const cache = await (
        await db
      ).get("entities", [owner, "exercise_cached_media", asset]);
      let blob = cache?.data?.blob as Blob | undefined;
      if (
        blob?.type === "image/gif" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        blob = undefined;
      if (!blob && navigator.onLine) {
        if (exercise.visibility === "private")
          blob = await privateMediaBlob(owner, asset);
        else {
          const r = await fetch(
            `/api/media/catalog/${asset}/content/?variant=thumbnail`,
            { cache: "no-store" },
          );
          if (r.ok) blob = await r.blob();
        }
      }
      if (blob && live && (await (await db).get("meta", "active")) === owner) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    };
    void load().catch(() => {});
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [exercise.id, exercise.revision, owner]);
  return url ? (
    <img
      className="exercise-image"
      src={url}
      alt={translation(exercise, language)?.name ?? ""}
    />
  ) : (
    <div className="exercise-media-fallback">
      <span aria-hidden="true">↗</span>
      <p>{c.noMedia}</p>
    </div>
  );
}

export function TrainingPage() {
  const { account, sessionValid } = useAuth(),
    { language } = useLanguage(),
    { queue, sync } = useSync(),
    c = trainingCopy[language],
    owner = account!.user.id,
    unit = account!.profile.weight_unit;
  const [tab, setTab] = useState("catalog"),
    [exercises, setExercises] = useState<Exercise[]>([]),
    [folders, setFolders] = useState<Folder[]>([]),
    [records, setRecords] = useState<LiftRecord[]>([]),
    [annotations, setAnnotations] = useState<Annotation[]>([]),
    [staged, setStaged] = useState<StagedMedia[]>([]),
    [downloads, setDownloads] = useState<
      { id: string; complete: boolean; bytes: number }[]
    >([]),
    [admin, setAdmin] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [equipment, setEquipment] = useState(""),
    [category, setCategory] = useState(""),
    [muscle, setMuscle] = useState(""),
    [visibility, setVisibility] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [selected, setSelected] = useState("");
  const [editor, setEditor] = useState<{
      type: EntityType;
      entity: Entity;
      isNew: boolean;
    } | null>(null),
    [confirm, setConfirm] = useState<{
      type: EntityType;
      entity: Entity;
    } | null>(null),
    [link, setLink] = useState<Exercise | null>(null),
    [audit, setAudit] = useState<
      { id: string; action: string; fields: string[]; revision: number }[]
    >([]);
  const label = (code: string) =>
    labels[code]?.[language === "ar" ? 1 : 0] ?? code;
  useEffect(() => {
    let live = true;
    const load = async () => {
      const [e, f, r, a, d, m, opt] = await Promise.all([
        list<Exercise>(owner, "exercise"),
        list<Folder>(owner, "workout_folder"),
        list<LiftRecord>(owner, "exercise_record"),
        list<Annotation>(owner, "exercise_annotation"),
        list<{ id: string; complete: boolean; bytes: number }>(
          owner,
          "folder_download",
        ),
        (await db).getAllFromIndex("media", "owner", owner),
        list<{ catalog_admin: boolean }>(owner, "training_options"),
      ]);
      if (live) {
        setExercises(e);
        setFolders(f.sort((a, b) => a.position - b.position));
        setRecords(
          r.sort(
            (a, b) =>
              b.local_date.localeCompare(a.local_date) ||
              b.recorded_at.localeCompare(a.recorded_at),
          ),
        );
        setAnnotations(a);
        setDownloads(d);
        setStaged(m);
        setAdmin(opt[0]?.catalog_admin ?? false);
      }
    };
    void load();
    window.addEventListener("trainfuel-local-change", load);
    if (navigator.onLine && sessionValid) {
      void refresh(owner).catch(() => {});
      void api<{ catalog_admin: boolean }>("/training/options/")
        .then(async (opt) => {
          if ((await (await db).get("meta", "active")) !== owner) return;
          await (
            await db
          ).put("entities", {
            owner,
            type: "training_options",
            id: owner,
            revision: 1,
            data: opt,
          });
          changed();
        })
        .catch(() => {});
    }
    return () => {
      live = false;
      window.removeEventListener("trainfuel-local-change", load);
    };
  }, [owner, sessionValid]);
  async function action(task: () => Promise<unknown>, success = c.saved) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await task();
      setMessage(success);
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  }
  const conflicting = (type: EntityType, id: string) =>
    queue.some(
      (op) =>
        op.entity_type === type &&
        op.entity_id === id &&
        op.status !== "pending",
    );
  const edit = (type: EntityType, entity: Entity, isNew = false) =>
    setEditor({ type, entity: structuredClone(entity), isNew });
  const visible = exercises
    .filter(
      (e) =>
        (showArchived || !e.archived) &&
        (!equipment || e.equipment === equipment) &&
        (!category || e.category === category) &&
        (!visibility || e.visibility === visibility) &&
        (!muscle || e.muscles.some((m) => m.code === muscle)) &&
        e.translations.some((t) =>
          t.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        ),
    )
    .sort((a, b) =>
      (translation(a, language)?.name ?? "").localeCompare(
        translation(b, language)?.name ?? "",
        language,
      ),
    );
  const newExercise = (): Exercise => ({
    id: crypto.randomUUID(),
    revision: 0,
    visibility: tab === "admin" ? "shared" : "private",
    category: "strength",
    equipment: "bodyweight",
    archived: false,
    translations: [],
    muscles: [],
    media: [],
  });
  const newRecord = (eid: string): LiftRecord => ({
    id: crypto.randomUUID(),
    revision: 0,
    exercise_id: eid,
    folder_exercise_id: null,
    local_date: new Intl.DateTimeFormat("en-CA", {
      timeZone: account!.profile.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    recorded_at: new Date().toISOString(),
    kind: "performed",
    notes: "",
    sets: [newSet()],
  });
  async function attach(exercise: Exercise, file: StagedMedia) {
    const asset = await uploadStagedMedia(owner, file.id);
    await save(owner, "exercise", {
      ...exercise,
      media: exercise.media.some((item) => item.asset_id === asset)
        ? exercise.media
        : [...exercise.media, { id: crypto.randomUUID(), asset_id: asset }],
    });
    await sync();
    if (
      !(await (await db).getAllFromIndex("operations", "owner", owner)).some(
        (op) => op.entity_type === "exercise" && op.entity_id === exercise.id,
      ) &&
      (
        (await (await db).get("entities", [owner, "exercise", exercise.id]))
          ?.serverData?.media as { asset_id: string }[] | undefined
      )?.some((item) => item.asset_id === asset)
    ) {
      await (await db).delete("media", file.id);
      changed();
    }
  }
  return (
    <section className="training-page">
      <header className="page-heading">
        <p className="eyebrow">TrainFuel / {c.folders}</p>
        <h1 tabIndex={-1}>{c.title}</h1>
        <p className="page-intro">{c.intro}</p>
      </header>
      <nav className="training-tabs" aria-label={c.title}>
        {["catalog", "folders", "history", ...(admin ? ["admin"] : [])].map(
          (name) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              aria-pressed={tab === name}
              onClick={() => {
                setTab(name);
                if (name === "admin")
                  void api<{ results: typeof audit }>(
                    "/training/catalog-audit/",
                  )
                    .then((r) => setAudit(r.results))
                    .catch(() => {});
              }}
            >
              {c[name as "catalog" | "folders" | "history" | "admin"]}
            </button>
          ),
        )}
      </nav>
      {message && <Message success>{message}</Message>}
      {error && <Message>{error}</Message>}
      {(tab === "catalog" || tab === "admin") && (
        <>
          <div className="training-toolbar">
            <Field
              label={c.search}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="button primary"
              onClick={() => edit("exercise", newExercise(), true)}
            >
              {c.create}
            </button>
            <button
              className="button secondary"
              disabled={!sessionValid || !navigator.onLine || busy}
              onClick={() => action(() => refresh(owner), c.snapshot)}
            >
              {c.snapshot}
            </button>
          </div>
          <div className="training-filters" role="group" aria-label={c.filters}>
            <Select
              label={c.equipment}
              value={equipment}
              onChange={setEquipment}
              items={[
                { value: "", label: c.all },
                ...[
                  "bodyweight",
                  "barbell",
                  "dumbbell",
                  "machine",
                  "cable",
                  "band",
                  "kettlebell",
                  "other",
                ].map((value) => ({ value, label: label(value) })),
              ]}
            />
            <Select
              label={c.category}
              value={category}
              onChange={setCategory}
              items={[
                { value: "", label: c.all },
                ...["strength", "cardio", "mobility"].map((value) => ({
                  value,
                  label: label(value),
                })),
              ]}
            />
            <Select
              label={c.muscle}
              value={muscle}
              onChange={setMuscle}
              items={[
                { value: "", label: c.all },
                ...[
                  "chest",
                  "back",
                  "shoulders",
                  "biceps",
                  "triceps",
                  "quadriceps",
                  "hamstrings",
                  "glutes",
                  "calves",
                  "core",
                ].map((value) => ({ value, label: label(value) })),
              ]}
            />
            <Select
              label={c.visibility}
              value={visibility}
              onChange={setVisibility}
              items={[
                { value: "", label: c.all },
                { value: "shared", label: c.shared },
                { value: "private", label: c.private },
              ]}
            />
            <label className="training-check">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              {c.archived}
            </label>
          </div>
          {!visible.length && (
            <p className="training-empty">
              {navigator.onLine ? c.empty : c.unavailable}
            </p>
          )}
          <div className="training-grid">
            {visible.map((exercise) => {
              const text = translation(exercise, language),
                annotation = annotations.find(
                  (a) => a.exercise_id === exercise.id,
                );
              return (
                <article className="surface exercise-card" key={exercise.id}>
                  <ExerciseMedia exercise={exercise} />
                  <div className="exercise-card-body">
                    <span className="status-pill">
                      {exercise.visibility === "shared" ? c.shared : c.private}
                      {exercise.archived ? ` · ${c.archived}` : ""}
                    </span>
                    <h2 lang={text?.language}>{text?.name}</h2>
                    {text?.language !== language && (
                      <p className="field-hint">
                        {c.fallback}:{" "}
                        {text?.language === "ar" ? c.arabic : c.english}
                      </p>
                    )}
                    <p>
                      {label(exercise.category)} · {label(exercise.equipment)}
                    </p>
                    <p>
                      {exercise.muscles
                        .map((m) => `${label(m.code)} (${label(m.role)})`)
                        .join(" · ")}
                    </p>
                    <details>
                      <summary>{c.instructions}</summary>
                      <ol lang={text?.language}>
                        {text?.instructions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                      {text?.technique_notes && (
                        <p lang={text.language}>{text.technique_notes}</p>
                      )}
                    </details>
                    {annotation?.tutorial_url && (
                      <a
                        href={annotation.tutorial_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {c.open}
                      </a>
                    )}
                    <div className="training-actions">
                      <button
                        className="button secondary"
                        onClick={() => {
                          setTab("history");
                          setSelected(exercise.id);
                        }}
                      >
                        {c.previous}
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => setLink(exercise)}
                      >
                        {c.tutorial}
                      </button>
                      {(exercise.visibility === "private" || admin) && (
                        <>
                          <button
                            className="button secondary"
                            disabled={conflicting("exercise", exercise.id)}
                            onClick={() => edit("exercise", exercise)}
                          >
                            {c.edit}
                          </button>
                          <button
                            className="button secondary"
                            disabled={conflicting("exercise", exercise.id)}
                            onClick={() =>
                              action(() =>
                                save(owner, "exercise", {
                                  ...exercise,
                                  archived: !exercise.archived,
                                }),
                              )
                            }
                          >
                            {exercise.archived ? c.restore : c.archive}
                          </button>
                          <button
                            className="button secondary"
                            disabled={conflicting("exercise", exercise.id)}
                            onClick={() =>
                              setConfirm({ type: "exercise", entity: exercise })
                            }
                          >
                            {c.delete}
                          </button>
                        </>
                      )}
                    </div>
                    {staged
                      .filter((m) => m.domainEntityId === exercise.id)
                      .map((file) => (
                        <div className="training-staged" key={file.id}>
                          <p>{c.pendingMedia}</p>
                          <button
                            className="button primary"
                            disabled={
                              !sessionValid || !navigator.onLine || busy
                            }
                            onClick={() => action(() => attach(exercise, file))}
                          >
                            {c.attach}
                          </button>
                        </div>
                      ))}
                  </div>
                </article>
              );
            })}
          </div>
          {tab === "admin" && (
            <section className="surface training-history">
              <h2>{c.audit}</h2>
              {audit.map((item) => (
                <p key={item.id}>
                  {item.action} · {c.revision} {item.revision} · {c.fields}:{" "}
                  {item.fields.join(", ")}
                </p>
              ))}
            </section>
          )}
        </>
      )}
      {tab === "folders" && (
        <>
          <div className="training-toolbar">
            <h2>{c.folders}</h2>
            <button
              className="button primary"
              onClick={() =>
                edit(
                  "workout_folder",
                  {
                    id: crypto.randomUUID(),
                    revision: 0,
                    name: "",
                    position: folders.length + 1,
                    entries: [],
                  },
                  true,
                )
              }
            >
              {c.addFolder}
            </button>
          </div>
          <p className="field-hint">{c.limit}</p>
          {!folders.length && <p className="training-empty">{c.empty}</p>}
          {folders.map((folder, index) => {
            const download = downloads.find((d) => d.id === folder.id);
            return (
              <article className="surface folder-card" key={folder.id}>
                <div className="training-toolbar">
                  <div>
                    <span className="eyebrow">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2>{folder.name}</h2>
                  </div>
                  <div className="training-actions">
                    <button
                      className="button secondary"
                      disabled={conflicting("workout_folder", folder.id)}
                      onClick={() => edit("workout_folder", folder)}
                    >
                      {c.edit}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        edit(
                          "workout_folder",
                          {
                            ...structuredClone(folder),
                            id: crypto.randomUUID(),
                            revision: 0,
                            name: `${folder.name} (${c.duplicate})`,
                            position: folders.length + 1,
                            entries: folder.entries.map((e) => ({
                              ...e,
                              id: crypto.randomUUID(),
                              sets: e.sets.map((s) => ({
                                ...s,
                                id: crypto.randomUUID(),
                              })),
                            })),
                          },
                          true,
                        )
                      }
                    >
                      {c.duplicate}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        setConfirm({ type: "workout_folder", entity: folder })
                      }
                    >
                      {c.delete}
                    </button>
                    <button
                      className="button secondary"
                      disabled={index === 0 || busy}
                      aria-label={`${c.moveUp} ${folder.name}`}
                      onClick={() =>
                        action(async () => {
                          const next = [...folders];
                          [next[index], next[index - 1]] = [
                            next[index - 1],
                            next[index],
                          ];
                          await reorder(owner, next);
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      className="button secondary"
                      disabled={index === folders.length - 1 || busy}
                      aria-label={`${c.moveDown} ${folder.name}`}
                      onClick={() =>
                        action(async () => {
                          const next = [...folders];
                          [next[index], next[index + 1]] = [
                            next[index + 1],
                            next[index],
                          ];
                          await reorder(owner, next);
                        })
                      }
                    >
                      ↓
                    </button>
                  </div>
                </div>
                {folder.entries.map((entry, i) => {
                  const exercise = exercises.find(
                    (e) => e.id === entry.exercise_id,
                  );
                  return (
                    <div className="folder-entry" key={entry.id}>
                      <h3>
                        {i + 1}.{" "}
                        {exercise
                          ? translation(exercise, language)?.name
                          : c.unavailable}
                      </h3>
                      <ol className="set-list">
                        {entry.sets.map((s) => (
                          <li key={s.id}>
                            {weight(s.weight_kg, unit)} {unit} × {s.reps}
                          </li>
                        ))}
                      </ol>
                      <button
                        className="button secondary"
                        onClick={() => {
                          setTab("history");
                          setSelected(entry.exercise_id);
                        }}
                      >
                        {c.previous}
                      </button>
                      {exercise && !exercise.archived && (
                        <button
                          className="button secondary"
                          onClick={() =>
                            edit(
                              "exercise_record",
                              {
                                ...newRecord(entry.exercise_id),
                                folder_exercise_id: entry.id,
                                sets: entry.sets.map((s) => ({
                                  ...s,
                                  id: crypto.randomUUID(),
                                })),
                              },
                              true,
                            )
                          }
                        >
                          {c.record}
                        </button>
                      )}
                    </div>
                  );
                })}
                <div className="training-download">
                  <button
                    className="button secondary"
                    disabled={
                      !sessionValid ||
                      !navigator.onLine ||
                      busy ||
                      queue.some(
                        (op) =>
                          op.entity_type === "workout_folder" &&
                          op.entity_id === folder.id,
                      )
                    }
                    onClick={() =>
                      action(async () => {
                        const complete = await downloadFolder(owner, folder);
                        setMessage(complete ? c.downloaded : c.incomplete);
                      }, "")
                    }
                  >
                    {c.download}
                  </button>
                  {download && (
                    <>
                      <p role="status">
                        {download.complete ? c.downloaded : c.incomplete} ·{" "}
                        {c.bytes}: {(download.bytes / 1024 / 1024).toFixed(2)}{" "}
                        MB
                      </p>
                      <button
                        className="button secondary"
                        onClick={() =>
                          action(
                            () => removeDownload(owner, folder.id),
                            c.clearDownload,
                          )
                        }
                      >
                        {c.clearDownload}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </>
      )}
      {tab === "history" && (
        <>
          <div className="training-toolbar">
            <Select
              label={c.selected}
              value={selected}
              onChange={setSelected}
              items={[
                { value: "", label: c.all },
                ...exercises.map((e) => ({
                  value: e.id,
                  label: translation(e, language)?.name ?? e.id,
                })),
              ]}
            />
            <button
              className="button primary"
              disabled={
                !selected || exercises.find((e) => e.id === selected)?.archived
              }
              onClick={() => edit("exercise_record", newRecord(selected), true)}
            >
              {c.record}
            </button>
          </div>
          <h2>{c.previous}</h2>
          {!records.filter((r) => !selected || r.exercise_id === selected)
            .length && <p className="training-empty">{c.noPrevious}</p>}
          {records
            .filter((r) => !selected || r.exercise_id === selected)
            .map((record) => (
              <article className="surface training-history" key={record.id}>
                <span className="status-pill">
                  {record.kind === "performed" ? c.performed : c.reference}
                </span>
                <h3>
                  {translation(
                    exercises.find((e) => e.id === record.exercise_id) ?? {
                      translations: [],
                    },
                    language,
                  )?.name ?? c.unavailable}
                </h3>
                <time dateTime={record.local_date}>{record.local_date}</time>
                <ol className="set-list">
                  {record.sets.map((s) => (
                    <li key={s.id}>
                      {weight(s.weight_kg, unit)} {unit} × {s.reps}
                    </li>
                  ))}
                </ol>
                {record.notes && <p>{record.notes}</p>}
                <div className="training-actions">
                  <button
                    className="button secondary"
                    disabled={conflicting("exercise_record", record.id)}
                    onClick={() => edit("exercise_record", record)}
                  >
                    {c.edit}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      setConfirm({ type: "exercise_record", entity: record })
                    }
                  >
                    {c.delete}
                  </button>
                </div>
                {folders.some((f) =>
                  f.entries.some((e) => e.exercise_id === record.exercise_id),
                ) && (
                  <Select
                    label={c.copy}
                    value=""
                    items={[
                      { value: "", label: c.selected },
                      ...folders.flatMap((f) =>
                        f.entries
                          .filter((e) => e.exercise_id === record.exercise_id)
                          .map((e) => ({
                            value: `${f.id}:${e.id}`,
                            label: `${f.name} · ${f.entries.indexOf(e) + 1}`,
                          })),
                      ),
                    ]}
                    onChange={(value) => {
                      if (!value) return;
                      const [folderId, entryId] = value.split(":");
                      const folder = folders.find((f) => f.id === folderId)!;
                      void action(
                        () =>
                          save(owner, "workout_folder", {
                            ...folder,
                            entries: folder.entries.map((e) =>
                              e.id === entryId
                                ? {
                                    ...e,
                                    sets: record.sets.map((s) => ({
                                      ...s,
                                      id: crypto.randomUUID(),
                                    })),
                                  }
                                : e,
                            ),
                          }),
                        c.copied,
                      );
                    }}
                  />
                )}
              </article>
            ))}
        </>
      )}
      {editor && (
        <Modal
          title={
            editor.type === "exercise"
              ? c.create
              : editor.type === "workout_folder"
                ? c.folders
                : c.record
          }
          close={() => setEditor(null)}
        >
          <Editor
            key={editor.entity.id}
            type={editor.type}
            entity={editor.entity}
            exercises={exercises}
            onCancel={() => setEditor(null)}
            onSave={async (entity, file, provenance) => {
              await action(async () => {
                if (file) {
                  const id = await stageMedia(owner, file, "exercise"),
                    database = await db,
                    staged = await database.get("media", id);
                  if (staged)
                    await database.put("media", {
                      ...staged,
                      domainEntityId: entity.id,
                      ...provenance,
                    });
                  changed();
                }
                await save(owner, editor.type, entity, editor.isNew);
                setEditor(null);
              });
            }}
          />
        </Modal>
      )}
      {link && (
        <Modal title={c.tutorial} close={() => setLink(null)}>
          <AnnotationEditor
            annotation={annotations.find((a) => a.exercise_id === link.id)}
            exercise={link}
            onCancel={() => setLink(null)}
            onSave={async (annotation, isNew) => {
              await action(async () => {
                await save(owner, "exercise_annotation", annotation, isNew);
                setLink(null);
              });
            }}
          />
        </Modal>
      )}
      {confirm && (
        <Modal title={c.delete} close={() => setConfirm(null)}>
          <p>
            {confirm.type === "workout_folder" ? c.deleteFolder : c.confirm}
          </p>
          <div className="training-actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await remove(owner, confirm.type, confirm.entity);
                  setConfirm(null);
                })
              }
            >
              {c.delete}
            </button>
            <button
              className="button secondary"
              onClick={() => setConfirm(null)}
            >
              {c.cancel}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function AnnotationEditor({
  annotation,
  exercise,
  onCancel,
  onSave,
}: {
  annotation?: Annotation;
  exercise: Exercise;
  onCancel: () => void;
  onSave: (a: Annotation, isNew: boolean) => Promise<void>;
}) {
  const { language } = useLanguage(),
    c = trainingCopy[language],
    [url, setUrl] = useState(annotation?.tutorial_url ?? ""),
    [notes, setNotes] = useState(annotation?.notes ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(
          {
            id: annotation?.id ?? crypto.randomUUID(),
            revision: annotation?.revision ?? 0,
            exercise_id: exercise.id,
            tutorial_url: url,
            notes,
          },
          !annotation,
        );
      }}
    >
      <p>{c.tutorialHelp}</p>
      <Field
        label={c.tutorial}
        type="url"
        pattern="https://.*"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <label className="field">
        {c.notes}
        <textarea
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="training-actions">
        <button className="button primary">{c.annotation}</button>
        <button type="button" className="button secondary" onClick={onCancel}>
          {c.cancel}
        </button>
      </div>
    </form>
  );
}

function Editor({
  type,
  entity,
  exercises,
  onCancel,
  onSave,
}: {
  type: EntityType;
  entity: Entity;
  exercises: Exercise[];
  onCancel: () => void;
  onSave: (
    e: Entity,
    file: File | null,
    p?: Partial<StagedMedia>,
  ) => Promise<void>;
}) {
  const { language } = useLanguage(),
    c = trainingCopy[language],
    [draft, setDraft] = useState(entity),
    [file, setFile] = useState<File | null>(null),
    [source, setSource] = useState(""),
    [license, setLicense] = useState(""),
    [rights, setRights] = useState(false),
    [saving, setSaving] = useState(false);
  const update = (data: Partial<Entity>) =>
      setDraft({ ...draft, ...data } as Entity),
    label = (code: string) => labels[code]?.[language === "ar" ? 1 : 0] ?? code;
  const [enName, setEnName] = useState(
      "translations" in entity
        ? (entity.translations.find((t) => t.language === "en")?.name ?? "")
        : "",
    ),
    [arName, setArName] = useState(
      "translations" in entity
        ? (entity.translations.find((t) => t.language === "ar")?.name ?? "")
        : "",
    ),
    [enSteps, setEnSteps] = useState(
      "translations" in entity
        ? (entity.translations
            .find((t) => t.language === "en")
            ?.instructions.join("\n") ?? "")
        : "",
    ),
    [arSteps, setArSteps] = useState(
      "translations" in entity
        ? (entity.translations
            .find((t) => t.language === "ar")
            ?.instructions.join("\n") ?? "")
        : "",
    ),
    [enNotes, setEnNotes] = useState(
      "translations" in entity
        ? (entity.translations.find((t) => t.language === "en")
            ?.technique_notes ?? "")
        : "",
    ),
    [arNotes, setArNotes] = useState(
      "translations" in entity
        ? (entity.translations.find((t) => t.language === "ar")
            ?.technique_notes ?? "")
        : "",
    ),
    [addId, setAddId] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        let next = draft;
        if (type === "exercise") {
          next = {
            ...draft,
            translations: [
              ...(enName
                ? [
                    {
                      language: "en" as const,
                      name: enName,
                      instructions: enSteps.split("\n").filter((s) => s.trim()),
                      technique_notes: enNotes,
                    },
                  ]
                : []),
              ...(arName
                ? [
                    {
                      language: "ar" as const,
                      name: arName,
                      instructions: arSteps.split("\n").filter((s) => s.trim()),
                      technique_notes: arNotes,
                    },
                  ]
                : []),
            ],
          } as Exercise;
        }
        setSaving(true);
        void onSave(
          next,
          file,
          "visibility" in draft && draft.visibility === "shared"
            ? {
                visibility: "public",
                source_url: source,
                license,
                rights_confirmed: rights,
              }
            : {},
        ).finally(() => setSaving(false));
      }}
    >
      {"translations" in draft && (
        <>
          <p>{draft.visibility === "shared" ? c.shared : c.private}</p>
          <fieldset>
            <legend>{c.english}</legend>
            <Field
              label={`${c.name} · English`}
              lang="en"
              dir="ltr"
              value={enName}
              onChange={(e) => setEnName(e.target.value)}
            />
            <label className="field">
              {c.steps} · English
              <textarea
                dir="ltr"
                required={!!enName}
                value={enSteps}
                onChange={(e) => setEnSteps(e.target.value)}
              />
            </label>
            <label className="field">
              {c.technique} · English
              <textarea
                dir="ltr"
                value={enNotes}
                onChange={(e) => setEnNotes(e.target.value)}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>{c.arabic}</legend>
            <Field
              label={`${c.name} · العربية`}
              lang="ar"
              dir="rtl"
              value={arName}
              onChange={(e) => setArName(e.target.value)}
            />
            <label className="field">
              {c.steps} · العربية
              <textarea
                dir="rtl"
                required={!!arName}
                value={arSteps}
                onChange={(e) => setArSteps(e.target.value)}
              />
            </label>
            <label className="field">
              {c.technique} · العربية
              <textarea
                dir="rtl"
                value={arNotes}
                onChange={(e) => setArNotes(e.target.value)}
              />
            </label>
          </fieldset>
          <Select
            label={c.category}
            value={draft.category}
            onChange={(category) => update({ category })}
            items={["strength", "cardio", "mobility"].map((value) => ({
              value,
              label: label(value),
            }))}
          />
          <Select
            label={c.equipment}
            value={draft.equipment}
            onChange={(equipment) => update({ equipment })}
            items={[
              "bodyweight",
              "barbell",
              "dumbbell",
              "machine",
              "cable",
              "band",
              "kettlebell",
              "other",
            ].map((value) => ({ value, label: label(value) }))}
          />
          <fieldset>
            <legend>{c.muscle}</legend>
            {[
              "chest",
              "back",
              "shoulders",
              "biceps",
              "triceps",
              "quadriceps",
              "hamstrings",
              "glutes",
              "calves",
              "core",
            ].map((code) => (
              <Select
                key={code}
                label={label(code)}
                value={draft.muscles.find((m) => m.code === code)?.role ?? ""}
                onChange={(role) =>
                  update({
                    muscles: [
                      ...draft.muscles.filter((m) => m.code !== code),
                      ...(role
                        ? [{ code, role: role as "primary" | "secondary" }]
                        : []),
                    ],
                  })
                }
                items={[
                  { value: "", label: "—" },
                  { value: "primary", label: label("primary") },
                  { value: "secondary", label: label("secondary") },
                ]}
              />
            ))}
          </fieldset>
          <Field
            label={c.media}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="field-hint">{c.mediaHelp}</p>
          {file && draft.visibility === "shared" && (
            <>
              <Field
                label={
                  language === "ar"
                    ? "رابط مصدر مرخص (HTTPS)"
                    : "Licensed source URL (HTTPS)"
                }
                required
                type="url"
                pattern="https://.*"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <Field
                label={
                  language === "ar"
                    ? "الترخيص ونسبة العمل"
                    : "License and attribution"
                }
                required
                maxLength={255}
                value={license}
                onChange={(e) => setLicense(e.target.value)}
              />
              <label className="training-check">
                <input
                  required
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                />
                {language === "ar"
                  ? "أؤكد امتلاكي حق نشر هذه الوسائط"
                  : "I confirm the right to publish this media"}
              </label>
            </>
          )}
          <label className="training-check">
            <input
              type="checkbox"
              checked={draft.archived}
              onChange={(e) => update({ archived: e.target.checked })}
            />
            {c.archived}
          </label>
          <p className="field-hint">{c.archivedHelp}</p>
        </>
      )}
      {"entries" in draft && (
        <>
          <Field
            label={c.folderName}
            required
            maxLength={200}
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          {draft.entries.map((entry, index) => (
            <fieldset key={entry.id}>
              <legend>
                {index + 1}.{" "}
                {translation(
                  exercises.find((e) => e.id === entry.exercise_id) ?? {
                    translations: [],
                  },
                  language,
                )?.name ?? c.unavailable}
              </legend>
              <div className="training-actions">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`${c.moveUp} ${index + 1}`}
                  onClick={() => {
                    const entries = [...draft.entries];
                    [entries[index], entries[index - 1]] = [
                      entries[index - 1],
                      entries[index],
                    ];
                    update({ entries });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === draft.entries.length - 1}
                  aria-label={`${c.moveDown} ${index + 1}`}
                  onClick={() => {
                    const entries = [...draft.entries];
                    [entries[index], entries[index + 1]] = [
                      entries[index + 1],
                      entries[index],
                    ];
                    update({ entries });
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      entries: draft.entries.filter((e) => e.id !== entry.id),
                    })
                  }
                >
                  {c.remove}
                </button>
              </div>
              <SetEditor
                sets={entry.sets}
                onChange={(sets) =>
                  update({
                    entries: draft.entries.map((e) =>
                      e.id === entry.id ? { ...e, sets } : e,
                    ),
                  })
                }
              />
            </fieldset>
          ))}
          <Select
            label={c.addExercise}
            value={addId}
            onChange={setAddId}
            items={[
              { value: "", label: c.selected },
              ...exercises
                .filter((e) => !e.archived)
                .map((e) => ({
                  value: e.id,
                  label: translation(e, language)?.name ?? e.id,
                })),
            ]}
          />
          <button
            type="button"
            className="button secondary"
            disabled={!addId}
            onClick={() => {
              update({
                entries: [
                  ...draft.entries,
                  {
                    id: crypto.randomUUID(),
                    exercise_id: addId,
                    sets: [newSet()],
                  },
                ],
              });
              setAddId("");
            }}
          >
            {c.addExercise}
          </button>
        </>
      )}
      {"sets" in draft && (
        <>
          <Select
            label={c.selected}
            value={draft.exercise_id}
            onChange={(exercise_id) =>
              update({ exercise_id, folder_exercise_id: null })
            }
            items={exercises
              .filter((e) => !e.archived || e.id === draft.exercise_id)
              .map((e) => ({
                value: e.id,
                label: translation(e, language)?.name ?? e.id,
              }))}
          />
          <Field
            label={c.date}
            required
            type="date"
            value={draft.local_date}
            onChange={(e) => update({ local_date: e.target.value })}
          />
          <Field
            label={c.time}
            required
            type="datetime-local"
            value={new Date(
              new Date(draft.recorded_at).getTime() -
                new Date(draft.recorded_at).getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)}
            onChange={(e) => {
              if (e.target.value)
                update({ recorded_at: new Date(e.target.value).toISOString() });
            }}
          />
          <Select
            label={c.record}
            value={draft.kind}
            onChange={(kind) =>
              update({ kind: kind as "performed" | "reference" })
            }
            items={[
              { value: "performed", label: c.performed },
              { value: "reference", label: c.reference },
            ]}
          />
          <label className="field">
            {c.notes}
            <textarea
              value={draft.notes}
              maxLength={5000}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>
          <SetEditor sets={draft.sets} onChange={(sets) => update({ sets })} />
        </>
      )}
      <div className="training-actions training-form-actions">
        <button className="button primary" disabled={saving}>
          {c.save}
        </button>
        <button className="button secondary" type="button" onClick={onCancel}>
          {c.cancel}
        </button>
      </div>
    </form>
  );
}
