# Offline and sync API

Authenticated session and CSRF are required for every write. Responses are private and not cached. The implemented adapters are `profile` and read-only `media_asset` metadata. Training and nutrition require their own adapters; see [integration contracts](integration/milestone-2.md).

| Method | Endpoint | Body / query |
| --- | --- | --- |
| POST | `/api/sync/devices/` | `{device_id: UUID, platform: "web"}`; idempotent registration of an owned device |
| POST | `/api/sync/push/` | `{device_id, operations: [...]}`; 1–50 validated operations |
| GET | `/api/sync/changes/` | `device_id`, `after` (default 0), `limit` (1–200, default 100) |
| GET | `/api/sync/snapshot/` | `device_id`; authorized current records and consistent cursor |
| POST | `/api/sync/ack/` | `{device_id, cursor}`; monotonically acknowledge **durably applied** changes |

An operation contains `idempotency_key`, `entity_type`, `entity_id`, `action`, `base_revision`, and `payload`. Keys and entity IDs are UUIDs. Profile only accepts `update`; mutable fields match the profile PATCH API, excluding `revision` (use `base_revision`). Ownership is derived from the session, never a submitted owner. Status is `accepted`, `conflict`, or `rejected` per operation. Responses include sanitized receipt metadata plus freshly authorized `current` data. Retry the same key/body after transport failure. Changing a body under an existing key produces `idempotency_key_reused`.

Conflict resolution is explicit: retain both versions, then submit a new key against the current account revision, or use the account version. Recovered drafts can be downloaded from the sync screen. A deleted entity cannot be recreated using its old UUID. The browser never chooses a winner using device timestamps.

Changes contain `sequence`, entity identity/revision, `action: upsert|delete`, and current authorized `data` (not a historical private payload). Global sequence gaps are normal after owner filtering. `cursor` can advance beyond the last visible change. PostgreSQL advisory transaction locks preserve feed commit order. Cursor expiration returns HTTP 410 `resync_required`; fetch a snapshot, preserve local pending work, durably apply, then acknowledge. Run `prune_sync_feed` periodically for the provisional 30-day retention. Receipts remain retained so delayed retries stay idempotent.

Browser saves commit their projection and queue in one IndexedDB transaction. Synchronization runs explicitly, when reconnecting, and on foreground activation. It uses a Web Lock when supported; server idempotency remains authoritative. Background browser-closed delivery is not promised. The production service worker caches the shell and bundled assets only; API and media requests are excluded. Browser quota/private-mode failures are surfaced as save failures rather than a successful-save claim. Browser storage can be evicted by the browser; use sync and export to protect durable work.

Previously authenticated users can access their active account cache offline on a trusted personal device. Expired sessions pause replay; log in online to resume. Explicit logout locks local access and clears the active marker. Retained data requires the same account's next online authentication. If logout happens offline, the browser marks the server logout pending and resolves it before reopening any session. This isolation is not device-level encryption.

Import [Milestone 2 Postman JSON](postman/TrainFuel.milestone-2.postman_collection.json) with the existing development environment. Run **Core lifecycle**, then **Sync lifecycle**. Run media separately after selecting a local image. Cookie handling and CSRF use the collection's shared scripts. Manual media folder is excluded from unattended Newman runs.
