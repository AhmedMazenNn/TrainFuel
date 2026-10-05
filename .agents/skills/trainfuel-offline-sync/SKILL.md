---
name: trainfuel-offline-sync
description: Implement or review TrainFuel durable browser persistence, operation queues, server replay, change feeds, conflict recovery, and account isolation. Use when changes affect offline saving or synchronization rather than purely visual sync indicators.
---

# TrainFuel offline and synchronization

Read [AGENTS.md](../../../AGENTS.md), [PRD section 6 and acceptance matrix](../../../docs/prd.md), and the `sync_device`, `sync_operation`, `change_record`, and affected domain tables in [the DBML](../../../docs/schema.dbml).

On `feature/generated-ui`, the generated prototype localStorage adapters and timer-driven `SyncContext` are prototype mechanisms. They do not implement a durable replay queue, real server acknowledgments, or account isolation. Keep platform persistence behind adapters; the initial deliverable is browser storage/cache, with native storage a later phase.

## Persistence and transport

- Persist each local mutation and its queued operation durably before reporting successful local save. Give domain entities client-generated identifiers and operations stable idempotency keys. Queue entries carry the base revision and enough dependency information to replay parents before children.
- Partition records, queues, downloaded content, and private media by account. An expired server session can leave established local access available under device policy but pauses replay until reauthentication. Recheck server authorization on every operation; device identity alone is insufficient.
- Commit accepted server mutation, change-feed record, and sanitized operation receipt in one transaction. Retrying an operation returns its prior outcome without duplicating domain data. The server receipt table is not the device's pending queue.
- Apply pulled changes durably before advancing the acknowledged cursor. Filter the global feed to authorized owner and shared catalog changes; gaps in its sequence are valid. Support full resync when an old cursor expires without discarding pending local work.
- Sync on reconnect, foreground, and explicit request. Treat background behavior as best-effort. Surface Saved on this device, Pending sync, Synced, and Needs attention from real persistence/replay outcomes rather than elapsed timers.

## Reconciliation and recovery

- Independent new records merge by identifier. Concurrent creation of a day merges to one owner/local-date day and retains food entries from both devices, remapping local references as needed.
- Revision mismatches on the same record retain both versions and offer an explicit user choice. Do not silently use device-clock last-write-wins. Folder reorder conflicts retain both orders for resolution.
- Use tombstones to prevent stale clients resurrecting deleted records. Hold edits against deleted entities for review and allow recovery as a new draft rather than overwriting deletion.
- Calculate local totals immediately and reconcile with authoritative results after replay. Moving historical entries updates both days; target changes do not rewrite old snapshots without explicit selection.
- Media bytes and local pending photos are separate from accepted server attachments. Load [trainfuel-private-media](../trainfuel-private-media/SKILL.md) for finalization, slots, and rejected upload recovery.
- On logout with pending work, offer sync, protected account-local retention, or explicit discard. Never silently lose unsynced data or expose it after account switching. Clear active account caches/session access and cancel reminders according to the selected lifecycle action; retained pending work remains account-isolated.

Downloaded catalog metadata/media must have honest availability and storage status. Uncached catalog content, external tutorial playback, new login/recovery/linking, and upload finalization require connectivity. Private-photo browser caching is opt-in. Remote revocation cannot instantly erase an offline device.

## Acceptance checks

- Offline edits survive reload/restart and synchronize once after reconnect; retry and acknowledgment loss do not duplicate records.
- Two devices create the same day and retain both devices' food entries on one server day.
- Concurrent set edits and folder reorders preserve both versions until resolution; stale edits cannot resurrect tombstoned data.
- Crashes between receiving and applying changes do not advance the cursor prematurely; expired cursors recover without losing queued edits.
- Session expiry pauses replay; account switching reveals no previous account data; logout never silently discards queued work.
- Save/queue failures and rejected media drafts remain visible and recoverable.
