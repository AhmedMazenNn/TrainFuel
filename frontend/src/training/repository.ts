import { api } from "../api/client";
import {
  applyRemote,
  changed,
  db,
  operations,
  saveEntity,
} from "../offline/database";
import { privateMediaBlob } from "../offline/media";
import {
  payload,
  type Entity,
  type Folder,
  type Exercise,
  type Annotation,
} from "./types";

export const resources = {
  exercise: "exercises",
  exercise_annotation: "annotations",
  workout_folder: "folders",
  exercise_record: "records",
};
export type EntityType = keyof typeof resources;
export async function list<T>(owner: string, type: string): Promise<T[]> {
  const database = await db;
  if ((await database.get("meta", "active")) !== owner) return [];
  return (await database.getAll("entities"))
    .filter((row) => row.owner === owner && row.type === type && row.data)
    .map((row) => ({ ...row.data, revision: row.revision }) as T);
}
export async function refresh(owner: string) {
  for (const [type, resource] of Object.entries(resources)) {
    let offset: number | null = 0;
    while (offset !== null) {
      const result: { results: Entity[]; next_offset: number | null } =
        await api(
          `/training/${resource}/?archived=true&offset=${offset}&limit=100`,
        );
      if ((await (await db).get("meta", "active")) !== owner) return;
      await applyRemote(
        owner,
        result.results.map((entity) => ({
          entity_type: type,
          entity_id: entity.id,
          revision: entity.revision,
          data: entity as unknown as Record<string, unknown>,
        })),
      );
      offset = result.next_offset;
    }
  }
}
export async function save(
  owner: string,
  type: EntityType,
  entity: Entity,
  isNew = false,
) {
  const pending = await operations(owner);
  if (
    pending.some(
      (op) =>
        op.entity_type === type &&
        op.entity_id === entity.id &&
        op.status !== "pending",
    )
  )
    throw new Error("Conflict requires resolution");
  const data = payload(entity);
  if (
    "sets" in entity &&
    (!entity.sets.length ||
      entity.sets.some(
        (s) =>
          Number(s.weight_kg) < 0 ||
          !Number.isFinite(Number(s.weight_kg)) ||
          !Number.isInteger(s.reps) ||
          s.reps < 1,
      ))
  )
    throw new Error("Invalid sets");
  if (
    "entries" in entity &&
    (!entity.name.trim() ||
      entity.entries.some((e) =>
        e.sets.some(
          (s) =>
            Number(s.weight_kg) < 0 ||
            !Number.isFinite(Number(s.weight_kg)) ||
            !Number.isInteger(s.reps) ||
            s.reps < 1,
        ),
      ))
  )
    throw new Error("Invalid prescription");
  if (
    "translations" in entity &&
    (!entity.translations.length ||
      entity.translations.some(
        (t) =>
          !t.name.trim() ||
          !t.instructions.length ||
          t.instructions.some((s) => !s.trim()),
      ))
  )
    throw new Error("Invalid exercise");
  if (
    "tutorial_url" in entity &&
    entity.tutorial_url &&
    !/^https:\/\//.test(entity.tutorial_url)
  )
    throw new Error("Use HTTPS");
  await saveEntity(
    owner,
    type,
    entity.id,
    isNew ? "create" : "update",
    data,
    { ...entity, revision: entity.revision + 1 } as unknown as Record<
      string,
      unknown
    >,
    isNew ? 0 : entity.revision,
  );
}
export async function remove(owner: string, type: EntityType, entity: Entity) {
  const database = await db;
  // Save a recoverable copy before hiding the item; deletion remains an explicit queued operation.
  await database.put("drafts", {
    id: crypto.randomUUID(),
    owner,
    recovered: Date.now(),
    operation: {
      idempotency_key: crypto.randomUUID(),
      owner,
      entity_type: type,
      entity_id: entity.id,
      action: "create",
      base_revision: 0,
      payload: payload(entity),
      created: Date.now(),
      status: "pending",
    },
  });
  await saveEntity(owner, type, entity.id, "delete", {}, null, entity.revision);
}
export async function downloadFolder(owner: string, folder: Folder) {
  const database = await db;
  const result = await api<{
    folder: Folder;
    exercises: Exercise[];
    annotations: Annotation[];
  }>(`/training/folders/${folder.id}/download/`);
  const rows = [
    {
      entity_type: "workout_folder",
      entity_id: result.folder.id,
      revision: result.folder.revision,
      data: result.folder,
    },
    ...result.exercises.map((e) => ({
      entity_type: "exercise",
      entity_id: e.id,
      revision: e.revision,
      data: e,
    })),
    ...result.annotations.map((e) => ({
      entity_type: "exercise_annotation",
      entity_id: e.id,
      revision: e.revision,
      data: e,
    })),
  ];
  await applyRemote(
    owner,
    rows as unknown as Parameters<typeof applyRemote>[1],
  );
  let complete = true,
    bytes = 0;
  const assetIds: string[] = [];
  for (const exercise of result.exercises)
    for (const media of exercise.media) {
      try {
        const existing = await database.get("entities", [
          owner,
          "exercise_cached_media",
          media.asset_id,
        ]);
        let blob = existing?.data?.blob as Blob | undefined;
        if (!blob) {
          if (exercise.visibility === "private")
            blob = await privateMediaBlob(owner, media.asset_id, "original");
          else {
            const response = await fetch(
              `/api/media/catalog/${media.asset_id}/content/?variant=original`,
              { cache: "no-store" },
            );
            if (!response.ok) throw new Error("Unavailable");
            blob = await response.blob();
          }
          const cached = await list<{ blob: Blob }>(
            owner,
            "exercise_cached_media",
          );
          if (
            cached.reduce((sum, item) => sum + item.blob.size, 0) + blob.size >
            100 * 1024 * 1024
          )
            throw new Error("Cache limit");
          if ((await database.get("meta", "active")) !== owner)
            throw new Error("Account changed");
          await database.put("entities", {
            owner,
            type: "exercise_cached_media",
            id: media.asset_id,
            revision: 1,
            data: { blob },
          });
        }
        bytes += blob.size;
        assetIds.push(media.asset_id);
      } catch {
        complete = false;
      }
    }
  if ((await database.get("meta", "active")) !== owner)
    throw new Error("Account changed");
  await database.put("entities", {
    owner,
    type: "folder_download",
    id: folder.id,
    revision: folder.revision,
    data: {
      id: folder.id,
      complete,
      bytes,
      assetIds,
      downloadedAt: Date.now(),
    },
  });
  changed();
  return complete;
}
export async function removeDownload(owner: string, id: string) {
  const database = await db,
    tx = database.transaction(["entities", "meta"], "readwrite");
  if ((await tx.objectStore("meta").get("active")) !== owner)
    throw new Error("Account changed");
  const download = await tx
    .objectStore("entities")
    .get([owner, "folder_download", id]);
  await tx.objectStore("entities").delete([owner, "folder_download", id]);
  const others = (await tx.objectStore("entities").getAll()).filter(
    (e) => e.owner === owner && e.type === "folder_download",
  );
  for (const asset of (download?.data?.assetIds ?? []) as string[])
    if (!others.some((e) => (e.data?.assetIds as string[])?.includes(asset)))
      await tx
        .objectStore("entities")
        .delete([owner, "exercise_cached_media", asset]);
  await tx.done;
  changed();
}

export async function reorder(owner: string, folders: Folder[]) {
  const database = await db,
    tx = database.transaction(["entities", "meta", "operations"], "readwrite");
  if ((await tx.objectStore("meta").get("active")) !== owner)
    throw new Error("Account changed");
  const queue = await tx.objectStore("operations").index("owner").getAll(owner);
  if (
    queue.some(
      (op) =>
        (op.entity_type === "workout_order" ||
          op.entity_type === "workout_folder") &&
        op.status !== "pending",
    )
  )
    throw new Error("Resolve conflict");
  const order = await tx
      .objectStore("entities")
      .get([owner, "workout_order", owner]),
    base = order?.revision ?? 1;
  const rows = folders.map((folder, index) => ({
    id: folder.id,
    revision: folder.revision,
    position: index + 1,
  }));
  const body = { folders: rows.map(({ id, revision }) => ({ id, revision })) };
  await tx
    .objectStore("operations")
    .put({
      owner,
      idempotency_key: crypto.randomUUID(),
      entity_type: "workout_order",
      entity_id: owner,
      action: "update",
      base_revision: base,
      payload: body,
      status: "pending",
      created: Math.max(Date.now(), ...queue.map((op) => op.created + 1)),
    });
  await tx
    .objectStore("entities")
    .put({
      owner,
      type: "workout_order",
      id: owner,
      revision: base + 1,
      data: {
        id: owner,
        revision: base + 1,
        folders: rows.map((row) => ({ ...row, revision: row.revision + 1 })),
      },
    });
  for (const [index, folder] of folders.entries())
    await tx
      .objectStore("entities")
      .put({
        owner,
        type: "workout_folder",
        id: folder.id,
        revision: folder.revision + 1,
        data: { ...folder, position: index + 1, revision: folder.revision + 1 },
      });
  await tx.done;
  changed();
}
