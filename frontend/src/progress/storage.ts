import {
  changed,
  db,
  saveEntity,
  operations,
  resolve,
  type LocalEntity,
} from "../offline/database";
import { privateMediaBlob } from "../offline/media";
export async function records(owner: string, type: string) {
  return (await (await db).getAll("entities")).filter(
    (r) => r.owner === owner && r.type === type && r.data,
  );
}
export async function save(
  owner: string,
  type: string,
  payload: Record<string, unknown>,
  row?: LocalEntity,
) {
  const id = row?.id ?? crypto.randomUUID();
  if (row) {
    const failed = (await operations(owner)).find(
      (op) =>
        op.entity_type === type &&
        op.entity_id === id &&
        op.status !== "pending",
    );
    if (failed) {
      const wasCreate = failed.action === "create";
      const base = Number(failed.current?.revision ?? 0);
      await resolve(owner, failed.idempotency_key, "server");
      return saveEntity(
        owner,
        type,
        id,
        wasCreate ? "create" : "update",
        payload,
        { ...payload, id, revision: base + 1 },
        base,
      );
    }
  }
  return saveEntity(
    owner,
    type,
    id,
    row ? "update" : "create",
    payload,
    { ...payload, id, revision: (row?.revision ?? 0) + 1 },
    row?.revision ?? 0,
  );
}
export async function remove(owner: string, row: LocalEntity) {
  return saveEntity(owner, row.type, row.id, "delete", {}, null, row.revision);
}
export async function cachePreference(owner: string, value?: boolean) {
  const database = await db;
  if (value !== undefined) {
    await database.put("meta", value, `photos-cache:${owner}`);
    if (!value) await clearPhotoCache(owner);
    changed();
  }
  return Boolean(await database.get("meta", `photos-cache:${owner}`));
}
export async function clearPhotoCache(owner: string, asset?: string) {
  const database = await db;
  const tx = database.transaction("meta", "readwrite");
  await tx.store.put(
    Number((await tx.store.get(`photo-epoch:${owner}`)) || 0) + 1,
    `photo-epoch:${owner}`,
  );
  for (const key of await tx.store.getAllKeys())
    if (
      key.startsWith(`photo:${owner}:`) &&
      (!asset || key.includes(`:${asset}:`))
    )
      await tx.store.delete(key);
  await tx.done;
}
export async function photoBlob(
  owner: string,
  asset: string,
  variant = "thumbnail",
) {
  const database = await db;
  if ((await database.get("meta", "active")) !== owner)
    throw new Error("Account changed");
  const key = `photo:${owner}:${asset}:${variant}`;
  const epoch = Number(
    (await database.get("meta", `photo-epoch:${owner}`)) || 0,
  );
  const enabled = await cachePreference(owner);
  const cached = enabled ? await database.get("meta", key) : null;
  if (cached instanceof Blob) return cached;
  const blob = await privateMediaBlob(owner, asset, variant);
  const tx = database.transaction("meta", "readwrite");
  if (
    enabled &&
    (await tx.store.get("active")) === owner &&
    (await tx.store.get(`photos-cache:${owner}`)) &&
    Number((await tx.store.get(`photo-epoch:${owner}`)) || 0) === epoch &&
    blob.size <= 50 * 1024 * 1024
  ) {
    const keys = (await tx.store.getAllKeys()).filter(
      (k) => k.startsWith(`photo:${owner}:`) && k !== key,
    );
    let total = blob.size;
    for (const k of keys) {
      const value = await tx.store.get(k);
      if (value instanceof Blob) total += value.size;
    }
    while (total > 50 * 1024 * 1024 && keys.length) {
      const oldest = keys.shift()!;
      const value = await tx.store.get(oldest);
      if (value instanceof Blob) total -= value.size;
      await tx.store.delete(oldest);
    }
    await tx.store.put(blob, key);
  }
  await tx.done;
  return blob;
}
export function today(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monday(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function kg(value: string, unit: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0)
    throw new Error("Enter a positive weight");
  return (unit === "lb" ? numeric * 0.45359237 : numeric).toFixed(3);
}
export function displayWeight(value: unknown, unit: string) {
  return (Number(value) / (unit === "lb" ? 0.45359237 : 1)).toFixed(2);
}
