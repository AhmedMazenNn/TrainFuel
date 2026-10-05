export interface LiftSet {
  id: string;
  position?: number;
  weight_kg: string;
  reps: number;
}
export interface Translation {
  language: "en" | "ar";
  name: string;
  instructions: string[];
  technique_notes: string;
}
export interface Exercise {
  id: string;
  revision: number;
  visibility: "shared" | "private";
  category: string;
  equipment: string;
  archived: boolean;
  translations: Translation[];
  muscles: { code: string; role: "primary" | "secondary" }[];
  media: { id: string; asset_id: string; position?: number }[];
}
export interface Annotation {
  id: string;
  revision: number;
  exercise_id: string;
  tutorial_url: string;
  notes: string;
}
export interface Entry {
  id: string;
  exercise_id: string;
  position?: number;
  sets: LiftSet[];
}
export interface Folder {
  id: string;
  revision: number;
  name: string;
  position: number;
  entries: Entry[];
}
export interface LiftRecord {
  id: string;
  revision: number;
  exercise_id: string;
  folder_exercise_id: string | null;
  local_date: string;
  recorded_at: string;
  kind: "performed" | "reference";
  notes: string;
  sets: LiftSet[];
}
export type Entity = Exercise | Annotation | Folder | LiftRecord;
export function translation(
  exercise: Pick<Exercise, "translations">,
  language: "en" | "ar",
) {
  return (
    exercise.translations.find((t) => t.language === language) ??
    exercise.translations[0]
  );
}
export function newSet(): LiftSet {
  return { id: crypto.randomUUID(), weight_kg: "0", reps: 10 };
}
export function weight(kg: string, unit: string) {
  const value = Number(kg) * (unit === "lb" ? 2.2046226218 : 1);
  return Number(value.toFixed(3)).toString();
}
export function kilogram(value: string, unit: string) {
  return (Number(value) / (unit === "lb" ? 2.2046226218 : 1)).toFixed(3);
}
export function payload(entity: Entity): Record<string, unknown> {
  const { id: _id, revision: _revision, ...body } = entity;
  if ("entries" in body)
    return {
      ...body,
      entries: body.entries.map((e) => ({
        id: e.id,
        exercise_id: e.exercise_id,
        sets: e.sets.map((s) => ({
          id: s.id,
          weight_kg: s.weight_kg,
          reps: s.reps,
        })),
      })),
    };
  if ("sets" in body)
    return {
      ...body,
      sets: body.sets.map((s) => ({
        id: s.id,
        weight_kg: s.weight_kg,
        reps: s.reps,
      })),
    };
  if ("media" in body)
    return {
      ...body,
      media: body.media.map((m) => ({ id: m.id, asset_id: m.asset_id })),
    };
  return body;
}
