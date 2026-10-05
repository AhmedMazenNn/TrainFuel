# Milestone 2 contracts for the Milestone 3 and 4 terminals

Work is isolated on `feature/milestone-2` in `/tmp/trainfuel-milestone-2`. It includes the Milestone 1 dependency; `main` and `dev` have not been changed. Integrate the completed branch through `dev` after review. Do not copy its migrations independently of its services.

## Backend domain integration

Register an adapter with `sync.registry.register("your_entity_type", Adapter)` inside your app's `AppConfig.ready()`. Adapters implement:

- `read(user, entity_id)` returns an authorized current JSON record (including `revision`) or `None`. Catalog reads may return public records. Personal records must filter ownership through indirect relationships too.
- `snapshot(user)` returns authorized `{entity_id, revision, data}` records. The initial foundation snapshot is a single response; paginate/stream this interface before large catalog or history datasets are shipped.
- `apply(user, operation)` returns `(status, receipt_metadata)`, with status `accepted`, `conflict`, or `rejected`. The replay service supplies an atomic transaction. Validate first; lock the domain row and relevant uniqueness/ordering scope. Check `base_revision` before mutating. Conflicts return `code: revision_conflict`; deleted rows return `entity_deleted`. Never resurrect an existing tombstoned UUID.

After any accepted write, including normal REST writes, call `sync.services.record_change(entity_type, entity_id, revision, owner=user, deleted=False)` inside the **same** transaction. Use `scope="catalog", owner=None` for shared catalog changes. Deletes increment revision and emit `deleted=True`. Keep tombstones after feed retention. `record_change` serializes sequence allocation until commit; do not insert ChangeRecord directly. Receipts store sanitized metadata, not personal record bodies. The response reads the currently authorized entity separately.

Operations: `{idempotency_key: UUID, entity_type, entity_id: UUID, action: create|update|delete, base_revision: integer, payload: object}`. A retry must use exactly the same key and payload. A deliberate conflict resolution creates a fresh key with the authoritative base revision. Create normally uses base revision 0. The profile adapter supports update only.

Nutrition: ownership and active `(owner, local_date)` uniqueness remain your responsibility. Two offline same-day creations need an adapter-specific canonical-ID reconciliation response before food-entry dependencies are replayed; the profile foundation does not implement this automatically. Preserve explicit dates and target snapshots. Workout ordering conflicts require domain scope locks and explicit revisions; the foundation cannot infer reorder semantics.

## Browser integration

Use the account-partitioned IndexedDB module `frontend/src/offline/database.ts`; never store tokens, passwords, CSRF values, or provider credentials. `saveProfile` is the working atomic save pattern. Other domain editors must atomically write their local entity and operation queue before reporting success. IDs are client UUIDs. The engine replays in durable queue order, blocks further writes to a conflicted entity, and applies feeds durably before acknowledgment. New entity adapters must also reconcile their local projected records after accepted replay. Do not report a domain offline-complete until its local save, retry, conflict, deletion, and account-switch tests pass.

`useSync()` exposes real queue, busy, error, and manual `sync()`. Session expiry preserves local account work but pauses replay; a user must sign in again online. Logout removes the active-account marker before showing public screens. Retained queues are accessible again only after that account authenticates online. This is browser account isolation on a trusted personal device, not encryption against someone with browser storage/devtools access. Offline app restart is supported by the production service worker; development HMR is deliberately uncached. APIs and private media are excluded from shell caching. Add translated, user-readable conflict field renderers for every new domain; the current conflict renderer covers profile preferences.

## Media integration (Milestone 3, then Milestone 5)

Use `media_assets.services.claim_asset(user, asset_id, entity_type, entity_id, purpose)` **inside the domain attachment transaction**. Allowed types: `exercise_media`/`progress_photo`; purposes: `exercise`/`progress`. It locks the asset, verifies owner/ready/purpose, and enforces one active cross-domain attachment. Release the claim (set `deleted_at`) in the same transaction as domain removal/replacement. Catalog administrators have no private-user-media override. Public catalog uploads require explicit source URL, license, and rights acknowledgment.

Upload flow: initiate → send multipart bytes → finalize processed asset → accept domain attachment. A ready media asset is not an accepted exercise attachment or progress photo. Milestone 5 must lock the owner/week scope and enforce four active photos in its attachment transaction; a rejected fifth leaves the local staged file intact. `stageMedia` persists blobs by owner; `uploadStagedMedia` retains the source until the domain acceptance succeeds. The domain then removes the staged blob explicitly.

Private content requires both an authenticated owner session and a 120-second signed grant in `X-Media-Access`. The grant is returned by POST `assets/{id}/access/`; it is never a query-string token. `privateMediaBlob` returns a Blob for an object URL that the component must revoke. Private photo caching remains off; add opt-in account-partitioned caching with deletion/account-switch tests when shipping F17. No files are mounted under public MEDIA_URL.

Milestone 2 supports JPEG/PNG/WebP and exercise GIF, up to 10 MiB original, 20 MP, 10,000 px edge; animation max 120 frames and 80 million aggregate pixels. Progress animations and HEIF are rejected with a recoverable draft; HEIF is not promised without a tested converter. Processing strips embedded metadata and handles EXIF orientation. GIFs are re-encoded; thumbnails are static JPEG.

Run periodic `cleanup_media` for expired uploads and retryable object deletion. Run `prune_sync_feed` for the provisional 30-day feed retention; expired clients snapshot without clearing their local queue. S3 requires a non-public bucket and lifecycle cleanup of uncommitted orphan objects. The local orphan scanner is documented with the media API.
