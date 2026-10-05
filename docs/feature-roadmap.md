# TrainFuel feature roadmap

This is the development backlog for the responsive website MVP, followed by the later mobile phase. Product behavior comes from [the PRD](prd.md); relationships and database constraints come from [the DBML](schema.dbml). This roadmap organizes delivery without replacing those requirements.

## Current status and workflow

- **Complete — setup:** Django/DRF scaffold, UUID email-based user foundation, PostgreSQL development service, initial infrastructure migrations, health endpoint, minimal React/TypeScript app, repository docs, and project skills.
- **Preserved — design reference:** the original AI-generated UI is on `feature/generated-ui`. Its simulated sync, local storage, and sample screens do not count as completed product features.
- **Milestone 1:** implemented and pushed on `feature/milestone-1`; live Google/email checks require configuration. **Milestone 2:** implemented on isolated `feature/milestone-2`; review pending, live S3 not configured. Other terminals own Milestones 3 and 4. See [integration contracts](integration/milestone-2.md). Update status after acceptance checks pass and record the pull request.

Start each feature from the latest `dev`, use the branch name below, and open a pull request into `dev`. Fixes use `fix/<short-description>` from `dev`. Keep `main` as the clean setup baseline until a reviewed promotion is explicitly requested. Do not merge the generated design automatically.

Dependencies below are feature IDs. Read each milestone top to bottom as the recommended sequence; independent work may overlap after its dependencies are complete. A feature can be split into smaller branches when necessary, with the same feature ID recorded in their pull requests.

## Milestone 1 — Accounts and web foundation

| ID | Branch | Depends on | Deliverable | Status |
| --- | --- | --- | --- | --- |
| F01 | `feature/accounts-profile` | Existing setup | Email/password registration, login, recovery, logout, transactional profile creation, and onboarding for display name, timezone, units, language, cutting/bulking goal, and optional height. | Implemented on `feature/milestone-1`; review pending |
| F02 | `feature/google-sign-in` | F01 | Verified Google sign-in and explicit account linking to the existing account, with online-only recovery/linking behavior. | Implemented/tested with fixtures; live Google setup pending |
| F03 | `feature/web-shell` | F01 | Responsive navigation, authentication/onboarding screens, account settings, reusable accessible forms/dialogs, and translation/date/number helpers. Decide whether to adapt or redesign the generated UI before adopting its components. | Implemented on `feature/milestone-1`; review pending |

**Acceptance:** profile and account records belong to the authenticated user; passwords use Django's facilities; linking cannot merge identities through unverified email text. Switching accounts reveals no previous user's data. Forms work with keyboards and narrow/wide layouts. English/Arabic and RTL are confirmed. The active shell uses a new responsive design; the original generated UI stays on its reference branch.

## Milestone 2 — Offline, synchronization, and media foundations

These capabilities are built before domain features are declared complete. Extend them to each new domain as it is introduced; they are not a promise that future tables already synchronize.

| ID | Branch | Depends on | Deliverable | Status |
| --- | --- | --- | --- | --- |
| F04 | `feature/offline-storage` | F01, F03 | Account-partitioned IndexedDB, production cached shell, atomic durable profile saves/queue, client IDs, versioned storage and recovered drafts. Trusted-device established-session policy documented. | Implemented on `feature/milestone-2`; review pending |
| F05 | `feature/sync-engine` | F04 | Authorized replay, idempotency receipts, revisions, commit-ordered change feed, cursors/tombstones, retries and expired-cursor snapshot. Profile plus read-only media metadata; extension registry for later domains. | Implemented on `feature/milestone-2`; domain adapters required later |
| F06 | `feature/sync-conflict-center` | F03, F05 | Real pending/sync/attention states, manual/reconnect/foreground sync, explicit conflict choice with recovered drafts, and pending-work logout choices. | Implemented on `feature/milestone-2`; review pending |
| F07 | `feature/media-pipeline` | F01, F05 | Controlled private/local uploads, metadata-stripped originals/thumbnails, expiring owner-bound delivery, purpose/attachment checks, cleanup and separate catalog boundary. S3-compatible configuration included. | Implemented on `feature/milestone-2`; live S3/release rights checks pending |

**Acceptance:** local changes survive reload before replay; retrying a write does not duplicate it; cursors advance only after durable application; concurrent edits retain both versions; stale devices cannot resurrect deletions. Session expiry pauses sync without silently losing local data. Private metadata and files are inaccessible to another account or a catalog admin. Uploading bytes alone never accepts a domain photo. Rejected/failed uploads remain recoverable.

## Milestone 3 — Exercise catalog and training

| ID | Branch | Depends on | Deliverable | Status |
| --- | --- | --- | --- | --- |
| F08 | `feature/exercise-catalog-admin` | F03, F05, F07 | Shared exercises, ordered translated instructions, muscles/equipment/category, search/filtering, licensed image/GIF media, admin create/edit/archive, and metadata audit. | Planned |
| F09 | `feature/private-exercises` | F08 | Owned custom exercises with optional private media and separate owner-only HTTPS tutorial annotations for shared/custom exercises. | Planned |
| F10 | `feature/workout-folders` | F09 | Unlimited paginated folders, rename/duplicate/reorder/delete, repeated ordered exercise selections, and independently ordered weight/repetition prescriptions. | Planned |
| F11 | `feature/exercise-records` | F10 | Editable dated performed/reference records, individual sets, previous-lift history, optional folder context, and explicit copying of records into prescriptions. | Planned |
| F12 | `feature/offline-downloads` | F08, F10, F04, F06 | Explicit folder downloads, cached catalog metadata/media, completion/storage reporting, bounded cache management, and uncached/missing-media fallbacks. | Planned |

**Acceptance:** archived exercises remain readable in history but cannot be newly selected. Each user sees only their tutorial annotation. Repeated folder exercises and distinct planned sets persist accurately. Recording/editing sets never silently changes prescriptions or requires a workout-completion workflow. Folder deletion preserves lifting history. Reorder and set-edit conflicts are recoverable across devices; cached instructions work offline and missing media has an honest fallback.

## Milestone 4 — Manual nutrition and daily history

| ID | Branch | Depends on | Deliverable | Status |
| --- | --- | --- | --- | --- |
| F13 | `feature/nutrition-targets-days` | F03, F05, F06 | Manual calorie/macro targets with effective dates, independent daily snapshots, one active day per owner/local date, and Start New Day without clearing or locking history. | Planned |
| F14 | `feature/food-logging-dashboard` | F13 | Portion-based food entry, complete/incomplete drafts, optional source/notes, editable/copyable entries, and consumed/target/remaining counters for each nutrient. | Planned |
| F15 | `feature/nutrition-history` | F14 | Calendar/day selection, historical entry/date/target corrections, weekly summaries with explicit denominators, and nutrition-versus-target charts with numeric alternatives. | Planned |

**Acceptance:** entering 150 g and 30 g protein records 30 g protein. Adding 200 and 300 kcal against 2,500 shows 500 consumed and 2,000 remaining; 2,600 shows 100 over. Unknown nutrients are distinct from zero and make totals partial. Repeated Start New Day taps reuse today's log. Two offline devices starting the same date retain both sets of food entries on one server day. Moving an entry updates both dates; target/timezone changes do not silently rewrite history. Future food logs remain outside MVP.

## Milestone 5 — Weight, private photos, and reminders

| ID | Branch | Depends on | Deliverable | Status |
| --- | --- | --- | --- | --- |
| F16 | `feature/weight-progress` | F03, F05, F06 | Dated weight entry/correction/deletion, kilogram storage with display conversion, notes, weight charts, gaps for missing observations, and readable numeric history. | Planned |
| F17 | `feature/weekly-progress-photos` | F07, F06 | Weekly photo galleries, stored week assignments, optional labels/notes, editable capture dates/weeks, replacement/deletion, opt-in private browser caching, and offline upload staging. | Planned |
| F18 | `feature/photo-comparison` | F17, F16 | Two-week comparison, label matching/manual selection, recorded dates and optional weight summaries, responsive side-by-side/toggle navigation, and source-preserving zoom. | Planned |
| F19 | `feature/web-reminders` | F01, F03, F05 | Optional food/exercise/weight/photo reminder preferences, local time/day settings, permission/capability handling, and best-effort web notification scheduling. | Planned |

**Acceptance:** weight conversions never alter stored values. At most four active finalized photos fit an owner/week across devices; concurrent fifth uploads preserve rejected drafts. Moves into full weeks fail without losing the original; timezone changes never regroup old photos. Comparisons work without weight entries and make no body-composition claims. Notification denial leaves other features usable; disabled reminders stop and settings changes do not duplicate notifications. Private details never appear in notification text.

## Milestone 6 — Account lifecycle and website release

| ID | Branch | Depends on | Deliverable | Status |
| --- | --- | --- | --- | --- |
| F20 | `feature/account-privacy-lifecycle` | F12, F15, F18, F19 | Personal data export with separate photo opt-in, authenticated account deletion, tracked database/media cleanup, cache/reminder cleanup, and explicit handling of disconnected devices and pending work. | Planned |
| F21 | `feature/website-release-readiness` | F02, F11, F12, F15, F18, F19, F20 | Cross-journey browser tests, ownership/concurrency/recovery checks, accessibility/RTL checks as applicable, measured performance budgets, staging/production configuration, private telemetry controls, backups, and demonstrated restore. | Planned |

**Release gate:** all website MVP journeys and PRD section 11 scenarios pass. Media rights are resolved; actual retention/deletion behavior is documented; backup restoration is demonstrated. Offline restart/reconnect, logout/account switching, historical edits, rejected uploads, and private-media authorization are tested together. Background sync and browser-closed reminders are never represented as guaranteed delivery. The full domain schema is delivered incrementally through these features, not by treating DBML as executable SQL.

## Phase 2 — Mobile, after the website MVP

| ID | Branch | Depends on | Deliverable | Status |
| --- | --- | --- | --- | --- |
| M01 | `feature/mobile-app-foundation` | Website release | React Native Android/iOS shell against the existing API and account model, sharing appropriate types, validation, dates, and pure calculations. | Later |
| M02 | `feature/mobile-offline-logging` | M01 | Native persistent records/queues and the established sync contract for training, nutrition, history, and progress. | Later |
| M03 | `feature/mobile-media-reminders` | M02 | Protected encrypted private media, tested mobile capture/conversion, optional device-unlock protection, and local reminders. | Later |
| M04 | `feature/mobile-release-readiness` | M03 | Android/iOS journeys, device/lifecycle/permission tests, offline recovery, and cross-device web/mobile synchronization verification. | Later |

Schedule and estimate native work separately. The website release does not depend on React Native code or native checks.

## Decisions to settle before affected work

- **Before F08:** specify exercise translation fallback. English/Arabic scope is confirmed, and Milestone 1 uses a fresh design.
- **Before F01/F13/F16/F17:** retain or deliberately revise the PRD working defaults: kilograms, Monday–Sunday weeks, one tutorial URL per exercise, one weight measurement per date, and Start New Day opening today without locking history.
- **F07 storage confirmed:** private local development storage plus S3-compatible option; no public private-media URLs. Processing formats/limits are documented in [media API](media-api.md); licensed exercise-media sources remain a decision before F08/release.
- **Before F20/F21:** confirm backup retention (proposed 30 days), production hosting, and measurable performance budgets against an agreed device/network environment.

These are tracked decisions, not requests to implement additional features. Automatic nutrition calculation, food databases/barcodes, AI body analysis, social sharing/coaching, payments, wearables, and workout-completion flows remain excluded from the website MVP.

## Definition of done for each feature

1. Required schema/migrations, server rules, browser behavior, and applicable offline/sync integration are delivered together; ownership and indirect references are checked.
2. Acceptance checks above and relevant PRD scenarios pass, including failure/recovery cases. Add meaningful automated tests for the implemented behavior.
3. Backend checks, migration drift checks, and frontend typecheck/build pass for the affected parts; accessible responsive behavior and localization are checked where applicable.
4. No private payloads/secrets enter logs or commits. Destructive actions have an explicit recovery/confirmation path; missing data remains unknown rather than fabricated.
5. Documentation and this roadmap reflect actual implementation status, the pull request is reviewed into `dev`, and any remaining limitation is recorded. Prototype demos alone do not satisfy acceptance.

**Integration order:** review Milestone 1, then Milestone 2 into `dev`; integrate the Milestone 3 and 4 branches with their domain-specific offline adapters and acceptance checks.
