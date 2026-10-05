import { useLanguage } from "../contexts/LanguageContext";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { list } from "./repository";
import { trainingCopy, labels } from "./copy";
import type { Exercise, Folder, LiftRecord, Annotation } from "./types";
import { translation } from "./types";

export function TrainingConflictVersion({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const { language } = useLanguage(),
    c = trainingCopy[language],
    label = (value: string) =>
      labels[value]?.[language === "ar" ? 1 : 0] ?? value;
  const { account } = useAuth();
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    if (account)
      void Promise.all([
        list<Folder>(account.user.id, "workout_folder"),
        list<Exercise>(account.user.id, "exercise"),
      ]).then(([folders, exercises]) => {
        if (live)
          setNames(
            Object.fromEntries([
              ...folders.map((folder) => [folder.id, folder.name]),
              ...exercises.map((exercise) => [
                exercise.id,
                translation(exercise, language)?.name ?? c.unavailable,
              ]),
            ]),
          );
      });
    return () => {
      live = false;
    };
  }, [account?.user.id, language]);
  if ("translations" in data) {
    const exercise = data as unknown as Exercise;
    return (
      <div>
        {exercise.translations.map((t) => (
          <div lang={t.language} key={t.language}>
            <h4>{t.name}</h4>
            <ol>
              {t.instructions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <p>{t.technique_notes}</p>
          </div>
        ))}
        <p>
          {c.category}: {label(exercise.category)} · {c.equipment}:{" "}
          {label(exercise.equipment)}
        </p>
        <p>
          {exercise.muscles
            .map((m) => `${label(m.code)} (${label(m.role)})`)
            .join(" · ")}
        </p>
        <p>
          {c.archived}: {exercise.archived ? "✓" : "—"}
        </p>
        <p>
          {c.media}: {exercise.media.length}
        </p>
      </div>
    );
  }
  if ("entries" in data) {
    const folder = data as unknown as Folder;
    return (
      <div>
        <h4>{folder.name}</h4>
        <p>{folder.position}</p>
        {folder.entries.map((entry, index) => (
          <div key={entry.id}>
            <p>{names[entry.exercise_id] ?? `${c.catalog} ${index + 1}`}</p>
            <ol>
              {entry.sets.map((s) => (
                <li key={s.id}>
                  {s.weight_kg} kg × {s.reps}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    );
  }
  if ("sets" in data) {
    const record = data as unknown as LiftRecord;
    return (
      <div>
        <h4>{names[record.exercise_id] ?? c.catalog}</h4>
        <p>
          {record.local_date} · {record.recorded_at}
        </p>
        <p>{record.kind === "reference" ? c.reference : c.performed}</p>
        <ol>
          {record.sets.map((s) => (
            <li key={s.id}>
              {s.weight_kg} kg × {s.reps}
            </li>
          ))}
        </ol>
        <p>{record.notes}</p>
      </div>
    );
  }
  if ("tutorial_url" in data) {
    const annotation = data as unknown as Annotation;
    return (
      <dl>
        <dt>{c.tutorial}</dt>
        <dd>{annotation.tutorial_url || "—"}</dd>
        <dt>{c.notes}</dt>
        <dd>{annotation.notes || "—"}</dd>
      </dl>
    );
  }
  if ("folders" in data) {
    const folders = data.folders as { id: string; revision: number }[];
    return (
      <ol>
        {folders.map((f, index) => (
          <li key={f.id}>
            {names[f.id] ?? `${c.folders} ${index + 1}`} · {c.revision}{" "}
            {f.revision}
          </li>
        ))}
      </ol>
    );
  }
  return null;
}
