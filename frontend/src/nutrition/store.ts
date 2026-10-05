import { db, changed, saveEntity, type LocalEntity } from "../offline/database";
export const nutrients = [
  "calories_kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
] as const;
export const targets = [
  "calorie_target",
  "protein_target",
  "carb_target",
  "fat_target",
] as const;
export type Row = Record<string, unknown> & { id: string; revision: number };
export async function records(owner: string, type: string): Promise<Row[]> {
  return (await (await db).getAll("entities"))
    .filter((r) => r.owner === owner && r.type === type && r.data)
    .map((r) => ({ ...r.data, id: r.id, revision: r.revision }) as Row);
}
export async function save(
  owner: string,
  type: string,
  data: Row,
  action: "create" | "update" | "delete",
) {
  const payload: Record<string, unknown> = { ...data };
  delete payload.id;
  delete payload.revision;
  delete payload.created_at;
  delete payload.updated_at;
  return saveEntity(
    owner,
    type,
    data.id,
    action,
    action === "delete" ? {} : payload,
    action === "delete" ? null : { ...data, revision: data.revision + 1 },
    data.revision,
  );
}
export function localDate(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}
export async function openDay(owner: string, date: string, goal: string) {
  const database = await db;
  // One transaction across tabs ensures repeated Start New Day does not enqueue twins.
  const tx = database.transaction(
    ["meta", "entities", "operations"],
    "readwrite",
  );
  if ((await tx.objectStore("meta").get("active")) !== owner)
    throw new Error("Account changed");
  const all = (await tx.objectStore("entities").getAll()).filter(
    (r) => r.owner === owner && r.data,
  );
  const existing = all.find(
    (r) => r.type === "nutrition_day" && r.data?.local_date === date,
  );
  if (existing) {
    await tx.done;
    return {
      ...existing.data,
      id: existing.id,
      revision: existing.revision,
    } as Row;
  }
  const effective = all
    .filter(
      (r) =>
        r.type === "nutrition_target" && String(r.data?.effective_date) <= date,
    )
    .sort((a, b) =>
      String(b.data?.effective_date).localeCompare(
        String(a.data?.effective_date),
      ),
    )[0];
  const id = crypto.randomUUID();
  const data: Row = {
    id,
    revision: 1,
    local_date: date,
    goal_snapshot: effective?.data?.goal ?? goal,
    source_target: effective?.id ?? null,
  };
  targets.forEach(
    (key, i) => (data[key] = effective?.data?.[nutrients[i]] ?? null),
  );
  const payload: Record<string, unknown> = { ...data };
  delete payload.id;
  delete payload.revision;
  const queue = await tx.objectStore("operations").index("owner").getAll(owner);
  await tx
    .objectStore("entities")
    .put({ owner, type: "nutrition_day", id, data, revision: 1 });
  await tx.objectStore("operations").put({
    owner,
    idempotency_key: crypto.randomUUID(),
    entity_type: "nutrition_day",
    entity_id: id,
    action: "create",
    base_revision: 0,
    payload,
    created: Math.max(Date.now(), ...queue.map((r) => r.created + 1)),
    status: "pending",
  });
  await tx.done;
  changed();
  return data;
}
export function totals(entries: Row[], day: Row | undefined) {
  return nutrients.map((key, i) => {
    const known = entries.filter(
      (e) => e[key] !== null && e[key] !== undefined && e[key] !== "",
    );
    // Persisted decimals have three fractional places; calculate sums in integer milliunits.
    const consumed =
      known.reduce((sum, e) => sum + Math.round(Number(e[key]) * 1000), 0) /
      1000;
    const target = day?.[targets[i]];
    return {
      key,
      consumed,
      target: target == null ? null : Number(target),
      partial: known.length !== entries.length,
      observed: entries.length > 0,
    };
  });
}
/** Same-date day IDs are canonicalized before their unsent children replay. */
export async function acceptCanonicalDay(
  owner: string,
  oldId: string,
  newId: string,
  current: Record<string, unknown>,
  key: string,
  acceptedRevision?: number,
) {
  const database = await db;
  const tx = database.transaction(
    ["meta", "entities", "operations", "drafts"],
    "readwrite",
  );
  const previous = await tx
    .objectStore("entities")
    .get([owner, "nutrition_day", oldId]);
  let dayRevision = acceptedRevision ?? Number(current.revision);
  let dayPending = false;
  if ((await tx.objectStore("meta").get("active")) !== owner)
    throw new Error("Account changed");
  const accepted = await tx.objectStore("operations").get(key);
  if (
    accepted &&
    previous?.data &&
    [...targets, "goal_snapshot"].some((field) =>
      field === "goal_snapshot"
        ? previous.data?.[field] !== current[field]
        : previous.data?.[field] == null || current[field] == null
          ? previous.data?.[field] !== current[field]
          : Number(previous.data?.[field]) !== Number(current[field]),
    )
  )
    await tx.objectStore("drafts").put({
      id: crypto.randomUUID(),
      owner,
      operation: accepted,
      recovered: Date.now(),
    });
  await tx.objectStore("operations").delete(key);
  for (const operation of (
    await tx.objectStore("operations").index("owner").getAll(owner)
  ).sort((a, b) => a.created - b.created)) {
    if (
      operation.entity_type === "food_entry" &&
      operation.payload.day === oldId
    ) {
      operation.payload = { ...operation.payload, day: newId };
      await tx.objectStore("operations").put(operation);
    }
    if (
      operation.entity_type === "nutrition_day" &&
      operation.entity_id === oldId
    ) {
      operation.entity_id = newId;
      operation.base_revision = dayRevision++;
      dayPending = true;
      await tx.objectStore("operations").put(operation);
    }
  }
  for (const entity of await tx.objectStore("entities").getAll()) {
    if (entity.owner !== owner) continue;
    if (entity.type === "food_entry" && entity.data?.day === oldId) {
      entity.data = { ...entity.data, day: newId };
      await tx.objectStore("entities").put(entity);
    }
  }
  for (const draft of await tx
    .objectStore("drafts")
    .index("owner")
    .getAll(owner)) {
    if (
      draft.operation.entity_type === "food_entry" &&
      draft.operation.payload.day === oldId
    ) {
      draft.operation.payload = { ...draft.operation.payload, day: newId };
      await tx.objectStore("drafts").put(draft);
    }
  }
  await tx.objectStore("entities").delete([owner, "nutrition_day", oldId]);
  await tx.objectStore("entities").put({
    owner,
    type: "nutrition_day",
    id: newId,
    data:
      dayPending && previous?.data
        ? { ...previous.data, id: newId, revision: dayRevision }
        : current,
    revision: dayRevision,
    serverData: current,
    serverRevision: Number(current.revision),
  });
  await tx.done;
  changed();
}
