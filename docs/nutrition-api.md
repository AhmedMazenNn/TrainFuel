# Milestone 4: nutrition targets, food logging, and history

Implemented on `feature/milestone-4`, based on Milestone 2. English/Arabic and RTL are supported at `/app/nutrition`. Data saves atomically to account-partitioned IndexedDB before queueing replay. No food lookup, per-100-g multiplication, or automatic nutrition calculation exists.

## Owner-only REST

All routes require an authenticated session; write requests require CSRF. Every record has a client UUID, revision, created/updated timestamps, and soft-delete tombstone. Use:

- `GET/POST /api/nutrition/targets/`, `GET/PATCH/DELETE /api/nutrition/targets/{id}/`
- `GET/POST /api/nutrition/days/`, `GET/PATCH/DELETE /api/nutrition/days/{id}/`
- `GET/POST /api/nutrition/entries/`, `GET/PATCH/DELETE /api/nutrition/entries/{id}/`
- `GET /api/nutrition/history/?date=YYYY-MM-DD`

Lists return `results` and `next_offset`; each page is at most 100 rows. Supply `?offset=100` to continue. POST body: `{"id":"client-uuid","payload":{...}}`; PATCH: `{"revision":1,"payload":{...}}`; DELETE: `{"revision":1}`. PATCH uses a complete target/food payload; day edits require `local_date` plus the intentionally corrected snapshot fields. Successful writes return `current` and the new revision; stale revisions return 409; foreign IDs are inaccessible. Normal REST and replay use the same transactional services and change feed.

Target payload: `effective_date`, `goal` (`cutting`/`bulking`), `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`. Values are manually entered nonnegative decimals, at most three fractional digits. A target applies to newly opened days on/after its effective date. Changing or deleting a schedule never rewrites existing snapshots. Selecting a saved schedule explicitly edits that schedule.

Day payload: `local_date`, optional `source_target`, `goal_snapshot`, and nullable `calorie_target`, `protein_target`, `carb_target`, `fat_target`. An omitted snapshot value is copied from the effective schedule; an explicit null remains unknown. Day dates are immutable; move a food entry by updating its `day` reference. Historical snapshots are independently editable. Future food days are rejected according to the account's configured timezone. Start New Day opens today's date and never locks or clears history. A day deletion explicitly tombstones its active entries.

Food payload: `day`, `name`, positive `portion_g`, nullable `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`, optional `brand_source`/`notes`, and `status` (`draft`/`complete`). Complete requires all four nutrients; zero remains valid. All nutrients describe the **entire eaten portion**. 150 g with 30 g protein stores 30 g protein. Calories stay independent of macro values. The UI supports edits, copies with review, date moves, and explicit confirmed deletion.

Counters sum active entries, label each incomplete nutrient total partial, show target unknown separately, and show over-target intake without clamping. No entries means no observation, not observed zero intake. Weekly history uses Monday–Sunday as the provisional default, includes seven numeric rows and a visual calorie chart, and averages only days with at least one active entry. Incomplete averages remain visibly partial in the numeric rows. REST arithmetic uses decimals; browser totals sum thousandths.

## Sync and concurrent days

Registered types: `nutrition_target`, `nutrition_day`, `food_entry`. Use the Milestone 2 operation envelope. PostgreSQL owner-scope advisory locking serializes date uniqueness and cross-day moves. Partial unique constraints additionally enforce active `(user,effective_date)` and `(user,local_date)` pairs. A deleted UUID cannot be resurrected.

When two devices create the same date, the second accepted day creation returns `canonical_id` and `current` for the existing day. Its snapshot remains authoritative. The browser atomically removes the accepted parent operation and remaps unsent food parent references, local entities, recovered drafts, and queued day edits before replaying children. The engine reads each queued envelope again before transmission, so it does not send a stale captured parent ID. If snapshots differed, the superseded creation remains available as a recovered draft rather than disappearing. Retry receipts read the canonical ID too. Do not change a transmitted idempotency envelope; conflicting changes retain local/account versions and explicit resolution creates a new key.

Food conflicts show translated fields in `/app/sync`; selecting either version archives local operations. Recovered food drafts can be opened as a new editable entry in the nutrition screen or exported from sync details. An entry moved to another date updates both local/server totals. Account switching never shares these stores.

## Lifecycle integration

`nutrition.lifecycle.export_data(user)` returns JSON-compatible active targets/days/entries, authorized via `day__user` for food. `erase_data(user)` must run inside the root account-erasure transaction. It locks the nutrition scope, scrubs names, notes, brand/source, portion/nutrients, source-target links, effective/local dates, and goals; emits deletions; retains owner-linked UUIDs, revisions, and technical event timestamps as tombstones to reject stale replay. Root handles user/profile/session/receipt cleanup and backup retention. Deleted records are not claimed to be physically removed immediately; disconnected devices require root lifecycle handling.

Import [the Postman collection](postman/TrainFuel.milestone-4.postman_collection.json) with [its environment](postman/TrainFuel.milestone-4.local.postman_environment.json). Run the complete collection in order with a fresh generated email. No real credentials are included.
