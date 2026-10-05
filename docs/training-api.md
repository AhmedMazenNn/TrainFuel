# Training API and offline behavior

Milestone 3 implements F08–F12 on `feature/milestone-3-parallel`, based on the Milestone 2 foundation. The website route is `/app/training`; language switching includes Arabic RTL. The original generated UI is not imported.

All endpoints below use the existing cookie session and CSRF header. Collections return `{results, next_offset}` with `offset`/`limit` (maximum 100). IDs are UUIDs created by clients where available. POST bodies contain the aggregate's fields and optional `id`; PUT bodies contain the complete editable aggregate plus integer `revision`. DELETE bodies contain `revision`. Stale writes return 409, unauthorized personal IDs return 404, invalid bodies return 400. Do not send server-only `position` for nested children: array order defines positions.

| Endpoint under `/api/training/` | Behavior |
| --- | --- |
| `options/` GET | Controlled category/equipment/muscle codes and catalog permission |
| `exercises/` GET/POST; `exercises/{id}/` GET/PUT/DELETE | Shared catalog and owned private exercises; controlled filters `q`, `muscle`, `equipment`, `category`, `visibility`, `archived=true` |
| `annotations/` GET/POST; `annotations/{id}/` GET/PUT/DELETE | Separate private tutorial URLs/notes; one active annotation per owner/exercise, HTTPS only |
| `folders/` GET/POST; `folders/{id}/` GET/PUT/DELETE | Full ordered folder/prescription aggregate; repeated exercise selections allowed |
| `folders/reorder/` GET/POST | Owner-wide order revision and atomic reorder; POST `{revision, folders:[{id,revision}]}` includes every active folder |
| `folders/{id}/download/` GET | Authorized folder, referenced exercise metadata, and owner's annotations |
| `records/` GET/POST; `records/{id}/` GET/PUT/DELETE | Dated performed/reference set aggregates; optional `exercise_id` collection filter |
| `catalog-audit/` GET | Catalog-admin-only latest 100 sanitized metadata events; action/field names/revision, no user-private record bodies |

Example exercise:

```json
{"visibility":"private","category":"strength","equipment":"dumbbell","archived":false,"translations":[{"language":"en","name":"Row","instructions":["Brace your trunk","Pull smoothly"],"technique_notes":""}],"muscles":[{"code":"back","role":"primary"}],"media":[]}
```

At least one English or Arabic translation must include a name and ordered instructions. The UI uses the requested language when available, otherwise the first available translation and an explicit alternate-language label. User-entered text is preserved. Category codes: strength/cardio/mobility; equipment: bodyweight/barbell/dumbbell/machine/cable/band/kettlebell/other. Bilingual muscle definitions are seeded by migration; exercises start empty. No unlicensed external images or third-party catalogs are bundled.

Example folder and record:

```json
{"name":"Pull day","position":1,"entries":[{"id":"CLIENT_ENTRY_UUID","exercise_id":"EXERCISE_UUID","sets":[{"id":"CLIENT_SET_UUID","weight_kg":"20.000","reps":12}]}]}
```

```json
{"exercise_id":"EXERCISE_UUID","folder_exercise_id":null,"local_date":"2026-10-05","recorded_at":"2026-10-05T10:00:00Z","kind":"performed","notes":"","sets":[{"id":"CLIENT_SET_UUID","weight_kg":"22.000","reps":10}]}
```

Weights persist as Decimal(12,3) kilograms; pounds convert only at entry/display boundaries. Explicit local dates remain stable after timezone changes. Final records require at least one positive-repetition, nonnegative-weight set. Prescriptions and records use separate tables. Editing or deleting history never changes a prescription; copying history into a prescription is explicit. Folder removal clears optional record context, bumps affected record revisions, and preserves lifting history. New folders append authoritatively under the owner lock; order edits use the separate revisioned scope.

## Sync and durability

The adapters are `exercise`, `exercise_annotation`, `workout_folder`, `exercise_record`, and `workout_order`. They use the existing replay envelope and receipts. Nested child mutations replace the submitted aggregate and bump its parent revision. Deleted aggregate UUIDs are retained as tombstones and cannot be recreated. Referenced exercises must be archived rather than deleted; archived exercises remain readable in existing plans/history but cannot be newly selected. Shared writes require catalog-admin permission, which grants no access to private exercises, links, folders, history, or media.

Editors atomically persist the local projection and durable operation queue before reporting saved. Folder ordering atomically persists all local positions and one scope operation. Conflicts expose both versions and preserve recovery drafts; retry acceptance uses stable idempotency keys. Deletions require confirmation and save a recoverable JSON draft locally. Full snapshots retain local-only download/cache state. Storage errors leave the editor open and report failure rather than claiming success.

## Media and offline downloads

Images/GIFs use the Milestone 2 staged upload/finalization APIs and `claim_asset` in the exercise attachment transaction. Local originals remain staged until the attachment replay succeeds. Catalog upload requires an HTTPS source URL, license/attribution, and an explicit rights confirmation. Private uploads never return permanent public URLs. Authorized content is fetched as blobs, temporary object URLs are revoked, and private content is excluded from the service-worker shell cache. Reduced-motion clients receive static thumbnails for display; explicit offline downloads cache original exercise media only after user action.

Download for Offline is enabled once the folder is server-accepted. It saves the authorized manifest, then selected media. Its status distinguishes completed download from metadata saved with missing media. The UI reports byte use and permits removing a download. Exercise media has a provisional 100 MiB account-scoped cache limit; quota or connection failure leaves metadata usable and reports an incomplete download. Two folders may share cached media; removing one only removes media not used by another download. A missing/unavailable image has an instruction-first fallback. Tutorial URLs are preserved, but external video is opened on demand and not downloaded or embedded.

Account caches use existing owner-keyed IndexedDB `entities` records with local-only types `folder_download`, `exercise_cached_media`, and `training_options`. Account discard/deletion clears them with all other owner data. A media tombstone invalidates its local exercise-media blob. Browser storage is device-local isolation, not encryption against devtools access. Large catalog/history snapshots still need a paginated foundation snapshot before genuinely large production datasets; REST list endpoints are paginated today.

## Lifecycle integration

`training.lifecycle.export_data(user)` exports active owned exercises, annotations, folders, and records without storage keys, shared catalog data, or audit internals. `erase_data(user)` runs in the lifecycle owner's transaction: releases attachment claims, purges translations/muscle associations/media attachments/planned and recorded children, blanks tutorial links/notes/folder names, neutralizes record dates/kinds and exercise classification, and emits aggregate tombstones. Inaccessible tombstones retain UUID relationships, revisions, creation/update/deletion timestamps and neutral schema-required placeholders. The shared catalog and metadata-only CatalogAudit are retained independently from personal user data. The lifecycle owner handles asset bytes, upload records, account identity and browser-device cleanup.

## Verification

Run `backend/.venv/bin/python backend/manage.py test training` against PostgreSQL. Browser tests run the built service-worker app, not uncached development HMR:

```bash
cd frontend
TRAINFUEL_API_PORT=18003 TRAINFUEL_WEB_PORT=15183 npm run test:e2e -- tests/training.spec.ts
```

Import [training Postman collection](postman/TrainFuel.milestone-3.postman_collection.json) with its own test account, or run Newman with `--env-var api_base=http://127.0.0.1:18003`. The sample test password is a disposable development fixture, not a credential for a real account. Live catalog content sourcing/rights approval and S3-provider readiness remain external release dependencies.
