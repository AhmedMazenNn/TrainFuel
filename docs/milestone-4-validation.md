# Milestone 4 verification

F13–F15 implement manual effective-date targets, independent day snapshots, food entry drafts/completed totals, daily counters, historical date corrections, seven-day summaries, and accessible numeric chart alternatives. The implementation uses the Milestone 2 authenticated replay/change feed and production offline shell.

Verified on PostgreSQL 16 with isolated `trainfuel_milestone4` database:

- 50 combined backend tests passed (12 nutrition tests plus 38 account/config/sync/media regression tests); the subsequently added exact-once food receipt test brings nutrition to 13, which passed separately.
- Ten Playwright scenarios passed across desktop and Pixel 7 mobile: offline restart; portion totals and explicit zero; independent 2,500 kcal day targets; historical date moves; two offline browser devices canonicalizing the same date while retaining both meals; partial unknown drafts; Arabic RTL/no viewport overflow; explicit conflict resolution retaining both versions before replay; and schedule editing that preserves existing snapshots while changing newly opened days.
- One initial mobile registration assertion timed out at five seconds while parallel agents were running. The final browser run uses 15-second synchronization assertions and passed all ten tests. It does not simulate success or disable replay.
- Type checking, production build, migration drift check, and whitespace check passed.

The PostgreSQL concurrency test runs simultaneous transactions in separate connections and verifies one canonical owner/date row with both independently created foods. CHECK and partial uniqueness constraints are exercised, as are private indirect ownership, administrator boundaries, future-date rejection, source schedule edits not altering history, deletion tombstones, and JSON-safe lifecycle export.

The Newman run passed all 18 requests and 24 assertions. Postman coverage uses [18 ordered requests](postman/TrainFuel.milestone-4.postman_collection.json), including CSRF/session bootstrap, snapshot independence, unknown versus zero, positive portion validation, historical moves, stale revisions, and resurrection rejection. Credentials in this collection are disposable test values; use a fresh generated account and local environment.

Monday–Sunday weeks remain a provisional product default. Future food logging, food databases, nutrition estimates, and native clients remain outside scope. Offline support requires an initially authenticated account on the device and the production service worker; local browser data is account-partitioned, not encrypted against device administrators. Initial snapshots remain a single foundation response; large-history pagination/streaming and production release budgets belong to integration/release verification.
