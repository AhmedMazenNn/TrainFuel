import { openDB, type DBSchema } from "idb";
import type { Account, Profile } from "../types/accounts";

export interface PendingOperation {
  idempotency_key: string;
  owner: string;
  entity_type: string;
  entity_id: string;
  action: "create" | "update" | "delete";
  base_revision: number;
  payload: Record<string, unknown>;
  created: number;
  status: "pending" | "conflict" | "rejected";
  current?: Record<string, unknown> | null;
  code?: string;
}
export interface LocalEntity {
  owner: string;
  type: string;
  id: string;
  data: Record<string, unknown> | null;
  revision: number;
  serverData?: Record<string, unknown> | null;
  serverRevision?: number;
}
export interface StagedMedia {
  id: string;
  owner: string;
  purpose: "exercise" | "progress";
  blob: Blob;
  uploadId?: string;
  assetId?: string;
  ready?: boolean;
  error?: string;
  domainEntityId?: string;
  visibility?: "public" | "private";
  source_url?: string;
  license?: string;
  rights_confirmed?: boolean;
}
interface Database extends DBSchema {
  meta: { key: string; value: unknown };
  accounts: { key: string; value: Account };
  entities: { key: [string, string, string]; value: LocalEntity };
  operations: {
    key: string;
    value: PendingOperation;
    indexes: { owner: string };
  };
  drafts: {
    key: string;
    value: {
      id: string;
      owner: string;
      operation: PendingOperation;
      recovered: number;
    };
    indexes: { owner: string };
  };
  media: { key: string; value: StagedMedia; indexes: { owner: string } };
}
export const db = openDB<Database>("trainfuel-offline", 1, {
  upgrade(database) {
    database.createObjectStore("meta");
    database.createObjectStore("accounts", { keyPath: "user.id" });
    database.createObjectStore("entities", {
      keyPath: ["owner", "type", "id"],
    });
    for (const name of ["operations", "drafts", "media"] as const)
      database
        .createObjectStore(name, {
          keyPath: name === "operations" ? "idempotency_key" : "id",
        })
        .createIndex("owner", "owner");
  },
});
export function changed() {
  window.dispatchEvent(new Event("trainfuel-local-change"));
  localChannel?.postMessage("changed");
}
const localChannel =
  "BroadcastChannel" in window ? new BroadcastChannel("trainfuel-local") : null;
if (localChannel)
  localChannel.onmessage = () =>
    window.dispatchEvent(new Event("trainfuel-local-change"));
function safeAccount(account: Account): Account {
  const { csrf_token: _secret, ...safe } = account;
  return safe as Account; // CSRF/session/provider credentials are never persisted.
}
export async function rememberAccount(account: Account) {
  const database = await db;
  const tx = database.transaction(
    ["accounts", "meta", "operations"],
    "readwrite",
  );
  const previous = await tx.objectStore("accounts").get(account.user.id);
  const pending = await tx
    .objectStore("operations")
    .index("owner")
    .getAll(account.user.id);
  const merged = safeAccount(
    pending.length && previous
      ? { ...account, profile: previous.profile }
      : account,
  );
  await tx.objectStore("accounts").put(merged);
  await tx.objectStore("meta").put(account.user.id, "active");
  await tx.done;
  return merged;
}
export async function cachedAccount() {
  const database = await db;
  const owner = await database.get("meta", "active");
  return typeof owner === "string"
    ? ((await database.get("accounts", owner)) ?? null)
    : null;
}
export async function deviceId(owner: string) {
  const database = await db;
  const tx = database.transaction("meta", "readwrite");
  let id = (await tx.store.get(`device:${owner}`)) as string | undefined;
  if (!id) {
    id = crypto.randomUUID();
    await tx.store.put(id, `device:${owner}`);
  }
  await tx.done;
  return id;
}
export async function operations(owner: string) {
  return (await (await db).getAllFromIndex("operations", "owner", owner)).sort(
    (a, b) => a.created - b.created,
  );
}
export async function saveProfile(account: Account, profile: Profile) {
  const database = await db;
  const tx = database.transaction(
    ["accounts", "operations", "meta"],
    "readwrite",
  );
  if ((await tx.objectStore("meta").get("active")) !== account.user.id)
    throw new Error("Account changed. Sign in again.");
  const current =
    (await tx.objectStore("accounts").get(account.user.id)) ??
    safeAccount(account);
  const payload = {
    display_name: profile.display_name.trim(),
    timezone: profile.timezone,
    language: profile.language,
    weight_unit: profile.weight_unit,
    goal: profile.goal,
    height_cm: profile.height_cm || null,
  };
  if (
    !payload.display_name ||
    !["en", "ar"].includes(payload.language) ||
    !["kg", "lb"].includes(payload.weight_unit) ||
    !["cutting", "bulking"].includes(payload.goal) ||
    (payload.height_cm !== null &&
      (!Number.isFinite(Number(payload.height_cm)) ||
        Number(payload.height_cm) <= 0))
  )
    throw new Error("Check your profile fields.");
  new Intl.DateTimeFormat("en", { timeZone: payload.timezone });
  const existing = await tx
    .objectStore("operations")
    .index("owner")
    .getAll(account.user.id);
  const created = Math.max(Date.now(), ...existing.map((op) => op.created + 1));
  await tx.objectStore("operations").put({
    idempotency_key: crypto.randomUUID(),
    owner: account.user.id,
    entity_type: "profile",
    entity_id: profile.user_id,
    action: "update",
    base_revision: current.profile.revision,
    payload,
    created,
    status: "pending",
  });
  const next = {
    ...current,
    profile: {
      ...current.profile,
      ...payload,
      revision: current.profile.revision + 1,
    },
  };
  await tx.objectStore("accounts").put(next);
  await tx.done;
  changed();
  return next;
}
export async function lockAccount(discard = false, logout = false) {
  const database = await db;
  const tx = database.transaction(
    ["meta", "operations", "drafts", "media", "accounts", "entities"],
    "readwrite",
  );
  const owner = await tx.objectStore("meta").get("active");
  await tx.objectStore("meta").delete("active");
  if (typeof owner === "string")
    await tx
      .objectStore("meta")
      .put(
        Number(
          (await tx.objectStore("meta").get(`photo-epoch:${owner}`)) || 0,
        ) + 1,
        `photo-epoch:${owner}`,
      );
  if (typeof owner === "string")
    for (const key of await tx.objectStore("meta").getAllKeys())
      if (key.startsWith(`photo:${owner}:`))
        await tx.objectStore("meta").delete(key);
  if (logout) await tx.objectStore("meta").put(true, "logout-pending");
  if (typeof owner === "string" && discard) {
    const removedOperations = new Set<string>();
    for (const name of ["operations", "drafts", "media"] as const) {
      for (const row of await tx
        .objectStore(name)
        .index("owner")
        .getAll(owner)) {
        if ("idempotency_key" in row)
          removedOperations.add(row.idempotency_key);
        await tx
          .objectStore(name)
          .delete("idempotency_key" in row ? row.idempotency_key : row.id);
      }
    }
    await tx.objectStore("accounts").delete(owner);
    for (const row of await tx.objectStore("entities").getAll())
      if (row.owner === owner)
        await tx.objectStore("entities").delete([owner, row.type, row.id]);
    await tx.objectStore("meta").delete(`cursor:${owner}`);
    for (const key of await tx.objectStore("meta").getAllKeys())
      if (
        key === `photo-epoch:${owner}` ||
        key === `photos-cache:${owner}` ||
        key.startsWith(`reminder-fired:${owner}:`) ||
        [...removedOperations].some((id) => key === `photo-staged:${id}`)
      )
        await tx.objectStore("meta").delete(key);
  }
  await tx.done;
  changed();
}

export async function clearErasedAccount(owner: string) {
  const database = await db;
  const stores = [...database.objectStoreNames];
  const tx = database.transaction(stores, "readwrite");
  const removedOperations = new Set<string>();
  const operationsStore = tx.objectStore("operations");
  for (
    const cursor = await operationsStore.openCursor();
    cursor;
    await cursor.continue()
  ) {
    if (cursor.value.owner === owner) {
      removedOperations.add(cursor.value.idempotency_key);
      await cursor.delete();
    }
  }
  for (const storeName of stores) {
    const store = tx.objectStore(storeName);
    if (storeName === "operations") continue;
    for (
      let cursor = await store.openCursor();
      cursor;
      cursor = await cursor.continue()
    ) {
      const value = cursor.value as unknown;
      const record =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : null;
      const ownerMatches =
        record?.owner === owner ||
        (record?.user &&
          typeof record.user === "object" &&
          (record.user as { id?: unknown }).id === owner);
      const key = String(cursor.key);
      const metaMatches =
        storeName === "meta" &&
        ((key === `active` && cursor.value === owner) ||
          key === `cursor:${owner}` ||
          key === `device:${owner}` ||
          key === `photo-epoch:${owner}` ||
          key === `photos-cache:${owner}` ||
          key.startsWith(`reminder-fired:${owner}:`) ||
          [...removedOperations].some((id) => key === `photo-staged:${id}`) ||
          key.startsWith(`photo:${owner}:`));
      if (ownerMatches || metaMatches) await cursor.delete();
    }
  }
  await tx.done;
  window.dispatchEvent(new Event("trainfuel-local-change"));
}
export async function applyRemote(
  owner: string,
  rows: {
    entity_type: string;
    entity_id: string;
    revision: number;
    data: Record<string, unknown> | null;
    action?: string;
  }[],
  cursor?: number,
  snapshot = false,
) {
  const database = await db;
  const tx = database.transaction(
    ["meta", "accounts", "entities", "operations"],
    "readwrite",
  );
  const queue = await tx.objectStore("operations").index("owner").getAll(owner);
  if (snapshot)
    for (const row of await tx.objectStore("entities").getAll())
      if (
        row.owner === owner &&
        ![
          "folder_download",
          "exercise_cached_media",
          "training_options",
        ].includes(row.type) &&
        !queue.some(
          (op) => op.entity_type === row.type && op.entity_id === row.id,
        )
      )
        await tx.objectStore("entities").delete([owner, row.type, row.id]);
  for (const row of rows) {
    const existing = await tx
      .objectStore("entities")
      .get([owner, row.entity_type, row.entity_id]);
    const pending = queue.some(
      (op) =>
        op.entity_type === row.entity_type && op.entity_id === row.entity_id,
    );
    const serverData = row.action === "delete" ? null : row.data;
    if (row.entity_type === "media_asset" && !serverData)
      await tx
        .objectStore("entities")
        .delete([owner, "exercise_cached_media", row.entity_id]);
    if (row.entity_type === "workout_order" && serverData && !pending) {
      for (const folder of serverData.folders as {
        id: string;
        revision: number;
        position: number;
      }[]) {
        const local = await tx
          .objectStore("entities")
          .get([owner, "workout_folder", folder.id]);
        if (
          local?.data &&
          !queue.some(
            (op) =>
              op.entity_type === "workout_folder" && op.entity_id === folder.id,
          )
        )
          await tx.objectStore("entities").put({
            ...local,
            revision: folder.revision,
            data: {
              ...local.data,
              revision: folder.revision,
              position: folder.position,
            },
          });
      }
    }
    if (
      row.entity_type === "progress_photo" &&
      existing?.data?.asset_id &&
      (row.action === "delete" || existing.data.asset_id !== row.data?.asset_id)
    ) {
      await tx
        .objectStore("meta")
        .put(
          Number(
            (await tx.objectStore("meta").get(`photo-epoch:${owner}`)) || 0,
          ) + 1,
          `photo-epoch:${owner}`,
        );
      for (const key of await tx.objectStore("meta").getAllKeys())
        if (key.startsWith(`photo:${owner}:${existing.data.asset_id}:`))
          await tx.objectStore("meta").delete(key);
    }
    await tx.objectStore("entities").put({
      owner,
      type: row.entity_type,
      id: row.entity_id,
      revision: pending && existing ? existing.revision : row.revision,
      data: pending && existing ? existing.data : serverData,
      serverData,
      serverRevision: row.revision,
    });
    if (
      row.entity_type === "profile" &&
      row.data &&
      !queue.some((op) => op.entity_type === "profile")
    ) {
      const account = await tx.objectStore("accounts").get(owner);
      if (account)
        await tx
          .objectStore("accounts")
          .put({ ...account, profile: row.data as unknown as Profile });
    }
  }
  if (cursor !== undefined)
    await tx.objectStore("meta").put(cursor, `cursor:${owner}`);
  await tx.done;
  changed();
}
export async function resolve(
  owner: string,
  key: string,
  choice: "local" | "server",
) {
  const database = await db;
  const tx = database.transaction(
    ["operations", "drafts", "accounts", "meta", "entities"],
    "readwrite",
  );
  if ((await tx.objectStore("meta").get("active")) !== owner)
    throw new Error("Account changed.");
  const op = await tx.objectStore("operations").get(key);
  if (!op || op.owner !== owner) throw new Error("Operation unavailable");
  const related = (
    await tx.objectStore("operations").index("owner").getAll(owner)
  )
    .filter(
      (item) =>
        item.entity_type === op.entity_type && item.entity_id === op.entity_id,
    )
    .sort((a, b) => a.created - b.created);
  const latest = related[related.length - 1];
  for (const item of related) {
    await tx.objectStore("drafts").put({
      id: crypto.randomUUID(),
      owner,
      operation: item,
      recovered: Date.now(),
    });
    await tx.objectStore("operations").delete(item.idempotency_key);
  }
  const account = await tx.objectStore("accounts").get(owner);
  const entity = await tx
    .objectStore("entities")
    .get([owner, op.entity_type, op.entity_id]);
  if (entity)
    await tx.objectStore("entities").put({
      ...entity,
      data:
        choice === "local" && op.current ? entity.data : (op.current ?? null),
      revision:
        Number(op.current?.revision ?? entity.serverRevision ?? 0) +
        (choice === "local" && op.current ? 1 : 0),
    });
  if (choice === "local" && op.current) {
    let payload = latest.payload;
    if (op.entity_type === "workout_order") {
      const remote = op.current.folders as { id: string; revision: number }[];
      const local = latest.payload.folders as {
        id: string;
        revision: number;
      }[];
      const ordered = [
        ...local
          .filter((folder) => remote.some((item) => item.id === folder.id))
          .map((folder) => remote.find((item) => item.id === folder.id)!),
        ...remote.filter(
          (folder) => !local.some((item) => item.id === folder.id),
        ),
      ];
      payload = {
        folders: ordered.map(({ id, revision }) => ({ id, revision })),
      };
    }
    await tx.objectStore("operations").put({
      ...latest,
      idempotency_key: crypto.randomUUID(),
      base_revision: Number(op.current.revision),
      status: "pending",
      created: Date.now(),
      current: undefined,
      code: undefined,
      payload,
    });
    if (account && op.entity_type === "profile")
      await tx.objectStore("accounts").put({
        ...account,
        profile: {
          ...account.profile,
          revision: Number(op.current.revision) + 1,
        },
      });
  } else if (account && op.entity_type === "profile" && op.current)
    await tx
      .objectStore("accounts")
      .put({ ...account, profile: op.current as unknown as Profile });
  await tx.done;
  changed();
}
export async function stageMedia(
  owner: string,
  blob: Blob,
  purpose: StagedMedia["purpose"],
) {
  if (blob.size > 10 * 1024 * 1024)
    throw new Error("Maximum original size is 10 MB.");
  const database = await db;
  const tx = database.transaction(["meta", "media"], "readwrite");
  if ((await tx.objectStore("meta").get("active")) !== owner)
    throw new Error("Account changed.");
  const id = crypto.randomUUID();
  await tx.objectStore("media").put({ id, owner, blob, purpose });
  await tx.done;
  changed();
  return id;
}

/** Domain editors must persist the local projection and replay envelope together. */
export async function saveEntity(
  owner: string,
  entityType: string,
  entityId: string,
  action: PendingOperation["action"],
  payload: Record<string, unknown>,
  localData: Record<string, unknown> | null,
  baseRevision: number,
) {
  const database = await db;
  const tx = database.transaction(
    ["meta", "entities", "operations"],
    "readwrite",
  );
  if ((await tx.objectStore("meta").get("active")) !== owner)
    throw new Error("Account changed.");
  const queue = await tx.objectStore("operations").index("owner").getAll(owner);
  const op: PendingOperation = {
    idempotency_key: crypto.randomUUID(),
    owner,
    entity_type: entityType,
    entity_id: entityId,
    action,
    base_revision: baseRevision,
    payload,
    status: "pending",
    created: Math.max(Date.now(), ...queue.map((item) => item.created + 1)),
  };
  await tx.objectStore("entities").put({
    owner,
    type: entityType,
    id: entityId,
    data: localData,
    revision: baseRevision + 1,
  });
  await tx.objectStore("operations").put(op);
  await tx.done;
  changed();
  return op;
}
