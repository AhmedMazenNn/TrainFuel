import { acceptCanonicalDay } from "../nutrition/store";
import { api, ApiError } from "../api/client";
import {
  applyRemote,
  changed,
  db,
  deviceId,
  operations,
  type PendingOperation,
} from "../offline/database";

import { uploadStagedMedia } from "../offline/media";

interface Receipt {
  idempotency_key: string;
  status: PendingOperation["status"] | "accepted";
  current: Record<string, unknown> | null;
  code?: string;
  canonical_id?: string;
  revision?: number;
}
export async function synchronize(owner: string) {
  const run = async () => {
    const database = await db;
    const active = async () => {
      if ((await database.get("meta", "active")) !== owner)
        throw new Error("Account changed.");
    };
    await active();
    const device = await deviceId(owner);
    await api("/sync/devices/", "POST", { device_id: device, platform: "web" });
    async function snapshot() {
      const result = await api<{
        entities: Record<
          string,
          {
            entity_id: string;
            revision: number;
            data: Record<string, unknown>;
          }[]
        >;
        cursor: number;
      }>(`/sync/snapshot/?device_id=${device}`);
      await active();
      await applyRemote(
        owner,
        Object.entries(result.entities).flatMap(([entity_type, rows]) =>
          rows.map((row) => ({ ...row, entity_type })),
        ),
        result.cursor,
        true,
      );
    }
    if ((await database.get("meta", `cursor:${owner}`)) === undefined)
      await snapshot();
    const blocked = new Set<string>();
    const considered = new Set<string>();
    for (const queued of await operations(owner)) {
      considered.add(queued.idempotency_key);
      let op = await database.get("operations", queued.idempotency_key);
      if (!op) continue;
      const entity = `${op.entity_type}:${op.entity_id}`;
      if (op.status !== "pending") {
        blocked.add(entity);
        continue;
      }
      if (blocked.has(entity)) continue;
      await active();
      if (
        op.entity_type === "progress_photo" &&
        typeof op.payload.local_media_id === "string"
      ) {
        const localId = op.payload.local_media_id;
        const assetId = await uploadStagedMedia(owner, localId);
        const { local_media_id: _local, ...fields } = op.payload;
        op = { ...op, payload: { ...fields, asset_id: assetId } };
        await database.put("operations", op);
        await database.put(
          "meta",
          localId,
          `photo-staged:${op.idempotency_key}`,
        );
      }
      const result = await api<{ results: Receipt[] }>("/sync/push/", "POST", {
        device_id: device,
        operations: [
          {
            idempotency_key: op.idempotency_key,
            entity_type: op.entity_type,
            entity_id: op.entity_id,
            action: op.action,
            base_revision: op.base_revision,
            payload: op.payload,
          },
        ],
      });
      await active();
      const receipt = result.results[0];
      if (receipt.status === "accepted") {
        if (
          receipt.canonical_id &&
          receipt.current &&
          op.entity_type === "nutrition_day"
        ) {
          await acceptCanonicalDay(
            owner,
            op.entity_id,
            receipt.canonical_id,
            receipt.current,
            op.idempotency_key,
            receipt.revision,
          );
          continue;
        }
        await database.delete("operations", op.idempotency_key);
        const stagedId = await database.get(
          "meta",
          `photo-staged:${op.idempotency_key}`,
        );
        if (typeof stagedId === "string") {
          await database.delete("media", stagedId);
          await database.delete("meta", `photo-staged:${op.idempotency_key}`);
        }
        if (op.entity_type === "progress_photo" && receipt.current?.asset_id) {
          for (const media of await database.getAllFromIndex(
            "media",
            "owner",
            owner,
          ))
            if (media.assetId === receipt.current.asset_id)
              await database.delete("media", media.id);
        }
        if (receipt.current)
          await applyRemote(owner, [
            {
              entity_type: op.entity_type,
              entity_id: op.entity_id,
              revision: Number(receipt.current.revision),
              data: receipt.current,
            },
          ]);
      } else {
        await database.put("operations", {
          ...op,
          status: receipt.status,
          current: receipt.current,
          code: receipt.code,
        });
        blocked.add(entity);
        changed();
      }
    }
    let more = true;
    while (more) {
      await active();
      const cursor = Number(
        (await database.get("meta", `cursor:${owner}`)) ?? 0,
      );
      try {
        const result = await api<{
          changes: Parameters<typeof applyRemote>[1];
          cursor: number;
          has_more: boolean;
        }>(`/sync/changes/?device_id=${device}&after=${cursor}`);
        await active();
        await applyRemote(owner, result.changes, result.cursor);
        // The IDB transaction commits before acknowledgment.
        await api("/sync/ack/", "POST", {
          device_id: device,
          cursor: result.cursor,
        });
        more = result.has_more;
      } catch (error) {
        if (error instanceof ApiError && error.status === 410) {
          await snapshot();
          continue;
        }
        throw error;
      }
    }
    return considered;
  };
  if (navigator.locks)
    return navigator.locks.request(`trainfuel-sync:${owner}`, run);
  return run();
}
