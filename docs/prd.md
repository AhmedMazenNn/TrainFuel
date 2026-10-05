# Fitness App — Product Requirements Document

Version: 1.3 · 5 October 2026 · Status: requirements baseline with explicitly marked implementation defaults

## 1. Vision
Launch a responsive website first, then add React Native apps for Android and iOS in a later phase that combine exercise guidance, organized workout prescriptions, editable per-set lifting records, manual nutrition tracking, and private body-progress tracking. Users should be able to record information without continuous internet access and synchronize it across devices later.

The product helps users remember exercise technique and previous weights, understand their recorded daily intake, and compare body changes over time. Body weight is one measurement; photographs provide a separate visual record. The app does not infer body-fat percentage or muscle gain from photographs.

## 2. Product scope and decisions
| Area | Requirement |
|---|---|
| Platforms | Phase 1: responsive website. Phase 2: React Native Android and iOS apps, added later |
| Languages | Confirmed: English and Arabic, including RTL |
| Authentication | Email/password and Google sign-in |
| Exercise catalog | Administrator-managed exercises with movement media and instructions |
| Custom exercises | Private user-created exercises with optional GIF/image uploads |
| Tutorial links | A private, optional video tutorial link for any shared or custom exercise; visible only to the user who added it |
| Organization | Unlimited workout folders; ordered exercises; per-set weight and reps; no rest timer required |
| Records | Every exercise set can be recorded and edited; no workout completion workflow |
| Nutrition | User-entered calorie/protein/carbohydrate/fat targets and food values |
| Day handling | Manual Start New Day action; permanent date-based history; past entries editable |
| Connectivity | Core personal data entry and reading work offline after initial online setup |
| Progress | Body-weight history, progress charts, reminders, and up to four private body photographs per week |
| Business | Free personal/testing project; no payments or subscriptions |

Proposed defaults throughout this document are engineering decisions to make the requirements implementable. They are not additional user-confirmed feature requests.

## 3. MVP and exclusions
The initial MVP is the responsive website only, with web administration, browser offline logging, synchronization status, conflict recovery, and private photo comparison. React Native Android and iOS apps are a later phase, outside initial release requirements.

Exclude automatic nutrition target estimation, shared food databases, barcode scanning, AI body analysis, social sharing, coaches, payments, wearable integrations, and marking workouts completed. Maintenance can be added later; confirmed goals are cutting and bulking. Do not require age, sex, or activity-level inputs for manual nutrition targets.

Offline synchronization and private media are part of MVP, so they must be implemented as foundations rather than bolted on after the interfaces are complete.

## 4. Users and main journeys
**Individual user:** owns folders, custom exercises, tutorial links, lifting records, nutrition entries, weight records, photographs, and reminder preferences.

**Catalog administrator:** manages shared exercises and their media. Catalog permissions do not grant product access to private progress photographs, personal tutorial links, or personal logs.

1. Sign in online, set timezone/unit preferences, choose a goal, and enter nutrition targets.
2. Browse exercises, inspect media and instructions, and organize exercises into folders.
3. Configure individual sets; revisit the exercise to inspect previous weights and record or correct sets.
4. Enter a food name, portion weight, and the nutrients for that portion; inspect daily totals.
5. Start today's log manually, preserving previous days; select any past day to correct entries.
6. Record body weight and add up to four photographs for a selected week.
7. Select two weeks and compare photographs and weight summaries privately.
8. Continue core entry while offline; review pending changes and synchronize when connectivity returns.

## 5. Functional requirements
### FR-01 — Accounts and profiles
Support email/password registration, login, logout, password recovery, and Google login. Registration, new-device login, password recovery, and account linking require internet. Verify identity before linking login methods; do not merge accounts based only on unverified email text.

Profile fields: display name, timezone, preferred weight unit, interface language, and selected goal. Proposed default unit: kilograms, with optional pounds. Height is optional. Offline access uses an already established local session and is distinct from server authentication. An expired server session permits local records to remain available under the device access policy but pauses sync until reauthentication. Remote revocation cannot instantly reach an offline device.

Acceptance: both clients expose the same account records after sync; one account cannot retrieve another account's private objects; account switching never displays the previous account's local data.

### FR-02 — Shared exercise catalog
Fields: name, ordered instructions, primary/secondary muscles, equipment, category, optional technique notes, and GIF/image media. Support search by name and muscle/equipment filters. Administrator can add, edit, and archive exercises. Archived exercises cannot be newly selected but remain readable through historical references.

Cache metadata and user-selected exercise media for offline use. Provide an explicit Download for Offline action for a folder and show download completion and storage use. A catalog exercise not cached is unavailable offline with a clear message; do not promise that the entire online catalog is always on-device.

Acceptance: cached instructions remain readable offline; missing media displays a fallback; archived exercises do not break existing records.

### FR-03 — Private custom exercises and tutorial links
Users create, edit, and archive private exercises using the shared exercise field structure. GIF/image upload is optional; instructions remain useful without media. Store custom media privately.

Tutorial links belong to a separate user–exercise annotation, never to the shared exercise record. Proposed default: one replaceable optional video URL per user per exercise. Allow the link for both shared and custom exercises. Editing or deleting it changes only that user's annotation. MVP opens valid HTTPS links on demand; a link does not imply an offline video download. Do not fetch arbitrary URLs server-side or embed third-party content automatically.

Acceptance: another user viewing the same shared exercise cannot see the link or its existence; direct API access is denied; links and exercise descriptions remain available offline, while external video playback requires connectivity unless already supported by the external provider.

### FR-04 — Workout folders and per-set prescriptions
Users create, rename, duplicate, reorder, and delete folders. Each folder contains ordered exercise entries. Each exercise supports individually ordered planned sets with weight and reps; different sets may have different values. Folder deletion does not delete catalog exercises or lifting history. No product cap on folder count; paginate large collections.

Acceptance: a prescription such as 20 kg × 12, 22 kg × 10, and 22 kg × 8 is saved and displayed accurately on both clients after synchronization.

### FR-05 — Per-set exercise records
Record sets directly from an exercise or a folder without starting or completing a workout. Fields: exercise, date/time, set position, weight, repetitions, and optional notes. Retain dated history so a user can compare previous lifts. Planned sets and actual records are separate.

Support reference-only set values if users wish to note a weight without claiming it was performed. Keep the distinction simple in the editor and history. Do not introduce workout completion badges, session checklists, or mandatory completion status.

All entered values can be corrected, and records can be removed with recovery safeguards. Record changes do not automatically overwrite folder prescriptions. Users can explicitly copy recorded values into a prescription.

Acceptance: individual sets remain distinguishable; previous records are visible before entering a new one; editing a historical record updates its date's charts without changing other records.

### FR-06 — Manual nutrition targets
Users select cutting or bulking and enter daily calories, protein, carbohydrates, and fat targets. No automatic calculator or prescribed macro allocation. Store targets with effective dates and daily snapshots.

Default target changes affect today/future logs only as explicitly selected. A user may also correct a historical day's target through that day's editor; modifying it requires an explicit choice so historical comparisons never change silently.

Acceptance: target values are editable; negative values are rejected; historical logs retain their targets unless deliberately edited. Missing values are shown as unknown rather than assumed zero.

### FR-07 — Fully manual food entries
Each entry stores food/meal name, selected date, quantity in grams, calories, protein grams, carbohydrate grams, fat grams, and optional brand/source and notes. Users enter their own values because products and preparations differ.

**Confirmed input rule:** users enter food name, portion weight, calories, protein, carbohydrates, and fat. Nutrient values describe the complete portion eaten. Quantity is recorded for context and does not multiply those values. Example: if a user enters 150 g and 30 g protein, the recorded protein is 30 g. The form must say “Nutrition for this portion.” No per-100-g scaling or food-weight-based estimation is performed.

Allow incomplete drafts with clearly marked missing nutrient values. Completed entries require the four nutrition values; zero is a valid explicitly entered value. Dashboard totals based on incomplete entries are labeled partial. No food database, lookup, or automatic estimates are required. Copying a previous entry is a convenience default, with all values editable before saving.

Acceptance: edits, deletions, and additions recalculate daily totals; quantities must be positive; nutrient values must be nonnegative; stored calorie values are not replaced by an inferred macro total.

### FR-08 — Daily dashboard, manual new day, and history
The primary nutrition experience is a daily consumed-versus-goal counter. Display the selected date and separate calories, protein, carbohydrate, and fat counters as consumed / daily target, with remaining totals and entry completeness.

Confirmed example: a 2,500 kcal daily target and a 200 kcal meal show **200 / 2,500 kcal**, with 2,300 kcal remaining. Adding another 300 kcal shows **500 / 2,500 kcal**. Protein, carbohydrates, and fat accumulate independently using the same rule. Food weight is informational and never scales entered values. Above-target intake remains visible: 2,600 / 2,500 kcal means 100 kcal over. Never clamp totals or block further logging. Remaining = target minus recorded consumption. If negative, show the amount over target. A day without entries means “No entries recorded,” not evidence of zero intake.

**Proposed day default:** Start New Day opens or creates today's local-date log. One log per user per local date. Repeated taps reopen the same day. The action never clears data and does not lock yesterday. After midnight, prompt the user to start today; adding to a previous date requires an explicit date selection.

Users can edit all information they entered on any past day, including entry dates and historical targets. Date changes move an entry rather than duplicate it and update both daily totals. Changing profile timezone does not retroactively move historical data. Store an explicit local date plus event timestamps.

History includes calendar/date selection, daily entry details, and weekly summaries with missing days distinguished from logged days. Weekly averages identify their denominator and exclude unlogged days by default. Future food logs are outside MVP; plans and target schedules are separate.

Acceptance: manual rollover, repeated taps, midnight, offline day creation, and historical corrections preserve records and produce correct totals.

### FR-09 — Body-weight history and progress charts
Users add dated weight measurements with optional notes, then edit or delete them. Proposed default: one measurement per date, with explicit replacement/correction; measurements are optional and photos can be uploaded without them. Normalize stored weights for consistent unit conversion.

Provide weight-over-time and nutrition-versus-target charts. Exercise history may show weight/reps trends while preserving individual sets; do not infer comparable exercise performance across different techniques. Chart gaps represent missing measurements. Show units and dates, and provide readable numeric alternatives.

Acceptance: changing display units does not alter stored values; corrections update charts; missing observations are never fabricated.

### FR-10 — Private weekly body photographs
Users may upload **up to four active photographs per week**, across all their devices. Each photo has an owner, capture date, explicit week association, optional label (for example front, side, back, or other), optional note, upload state, and storage reference. Images are optional; no angles or poses are mandatory.

Proposed week definition: Monday–Sunday using the user's configured timezone. Store the week-start date at assignment time so changing timezone does not unexpectedly regroup existing photographs. Permit uploads/corrections for past weeks. Users can edit capture date, label, notes, and week assignment; a move rechecks the destination limit. Replacing a photo consumes its existing slot; deleting releases a slot after the server accepts the deletion. There is no total historical cap of four photographs.

Show a weekly gallery and a comparison view for two selected weeks. Display images side by side on wide screens and with labeled swipe/toggle navigation on narrow screens. Match labels when possible; allow users to choose images manually. Show recorded capture dates and available weight measurements without implying that scale changes or photographs prove a particular body-composition change. Permit zoom while keeping the source image unchanged.

Privacy design:
- Owner-only API permissions apply to originals, thumbnails, metadata, comparison views, and downloads.
- Store private files in nonpublic object storage; opaque filenames are an additional measure, not authorization.
- Issue short-lived authorized media access; signed URLs can be used by anyone possessing them until expiry, so they must not be logged or treated as permanent public links.
- Do not include photos or photo URLs in analytics, crash reports, notification previews, shared catalog content, or automatic exports.
- Remove location/device metadata from processed uploads; preserve the user-entered capture date separately. Validate actual image content, orientation, format, dimensions, and size. Proposed limit: 10 MB per original; support JPEG/PNG and conversion of common mobile capture formats through a tested pipeline.
- Cache private images only when requested or needed locally. Encrypt the mobile private-media store; a device unlock prompt for the progress gallery is a recommended local privacy setting. Web offline private-photo caching is opt-in because browser storage provides weaker isolation on shared devices.
- No sharing feature and no image analysis in MVP. Application staff receive no gallery access by default. Infrastructure operators may technically access stored data under controlled operations; the product must not claim end-to-end encryption unless it is separately implemented.

Offline uploads are staged on-device and clearly labeled Pending. The client enforces its known week limit; the server enforces the authoritative limit transactionally. If two offline devices collectively exceed four photos, preserve rejected local photos, explain the conflict, and let the user replace an existing image, change the week, or discard the pending upload. Never silently delete or exceed the server limit.

Acceptance: a fifth active photo is rejected without losing its local draft; two-device races cannot exceed four; another account cannot access thumbnails or originals; historical comparison works without a weight entry; corrected week assignments enforce limits; deletion hides the item immediately and removes original/derived files through tracked cleanup. Backup copies expire under a documented retention period, proposed at 30 days, rather than claiming instant erasure from every backup.

### FR-11 — Reminders
Provide optional, user-configurable reminders for food logging, exercise logging, weight measurement, and weekly photographs. Users choose categories, local times/days, and can disable each reminder. Ask notification permission only when enabling a reminder.

Schedule mobile reminders locally so configured reminders can fire offline, subject to operating-system behavior and permissions. Web reminders are best-effort with separate permission/capability handling; email/SMS and guaranteed browser-closed delivery are outside MVP. Never put body images, nutrient values, or private notes in notification text. Adjust future reminder schedules when timezone changes without altering historical dates.

Acceptance: disabled reminders stop; denied permissions do not block other features; notifications do not duplicate after synchronization or settings changes.

### FR-12 — Editing, deletion, and error recovery
“All entered details are editable” includes profile values, targets, food entries/dates, folder prescriptions, custom exercises, tutorial links, set records, weight records, and photo details. It does not grant users permission to edit the shared catalog.

Use draft autosave, input validation, clear local/sync status, an undo or confirmation path for destructive removal, and optimistic concurrency. Pending upload failures remain recoverable. An editable interface improves error recovery; reliable queues, retries, transactions, and backups provide system fault tolerance.

### FR-13 — Administration
Web-only administration for shared exercises, media, archiving, and catalog quality. Store attribution/license provenance for sourced exercise GIFs. Online discovery is planned but a final media source is not selected; confirm rights before distributing catalog media. Administrative actions are auditable. No shared food catalog or private-photo browsing interface is included.

## 6. Offline and synchronization contract
The initial release implements this contract on the website. Native storage, device-unlock prompts, mobile notifications, and mobile lifecycle requirements apply to the later React Native phase.
After initial online sign-in and data download, users can view cached exercises/folders/history; edit prescriptions and records; enter targets, food, and weight; start daily logs; add private tutorial URLs; and stage custom media/progress photos. New login, account linking/recovery, uncached catalog content, external tutorial playback, and server upload completion require internet.

Both clients persist local changes before reporting a successful local save. Distinguish Saved on this device, Pending sync, Synced, and Needs attention. Data entered offline is not yet backed up remotely, and clearing browser storage/uninstalling can remove unsynced changes; communicate this in the relevant export/logout/storage flow.

Proposed implementation: mobile local structured database and private file cache; web persistent browser database and cache. Use a durable operation queue with client-generated identifiers, operation idempotency keys, entity versions, and server change cursors. Each server-accepted mutation is transactional. Compute local totals for immediate feedback and reconcile with authoritative server totals after sync.

Conflict rules:
- New independent records merge by identifier; retries never create duplicates.
- Daily logs merge using owner + local date, retaining both devices' food entries.
- Same-record concurrent edits surface a comparison and require a user choice; do not silently use device-clock last-write-wins.
- Deletion uses tombstones so stale devices cannot resurrect deleted records. An edit against a deleted entity is held for review and can be recovered as a new draft.
- Folder order conflicts keep both revisions available and request a choice.
- Photo slots are allocated on the server at accepted upload finalization; rejected uploads keep their local drafts.

Synchronize on reconnect/app foreground and on an explicit Sync action. Background synchronization is best-effort. Partition local stores by account. On logout with pending work, offer sync, retain locally under protected account storage, or explicit discard; never silently wipe unsynced records or expose them to the next user. Server authorization is rechecked for every replayed write.

## 7. Screens and localization
Deliver these screens on the responsive website first; adapt them for React Native later.
Authentication/recovery; onboarding/profile; daily dashboard; exercise catalog/detail; private exercise editor; folder list/editor; per-set record editor/history; food editor; day/weekly nutrition history; weight history/charts; weekly photo gallery/upload/comparison; reminder settings; offline download management; sync/conflict center; account/privacy settings; web administration.

Provide English and Arabic copy, correct RTL layout, locale-aware dates/numbers, consistent units, and accessible charts. Shared exercise names/instructions need language fields and a stated fallback for missing translations; user-entered content stays in the language entered.

## 8. Logical data model
| Entity | Purpose / important constraint |
|---|---|
| User / Profile | Authentication identity, timezone, units, language, goal |
| Exercise / ExerciseMedia | Shared or owned custom exercise; private custom media |
| UserExerciseAnnotation | Owner + exercise; private tutorial URL/notes |
| WorkoutFolder / WorkoutExercise / PlannedSet | Owned folder, ordered exercises, per-set prescriptions |
| ExerciseRecord / RecordedSet | Dated editable performance or reference sets |
| NutritionTargetVersion | Effective targets with retained history |
| NutritionDay | Unique owner + local date; editable target snapshot |
| FoodEntry | Portion weight and manually entered portion nutrient totals |
| WeightEntry | Owner/date, normalized weight, note |
| ProgressWeek / ProgressPhoto | Owner + stored week start; maximum four active finalized photos |
| ReminderPreference | Category, local schedule, enabled state |
| SyncOperation / ChangeRecord | Idempotency, revision, change cursor, tombstones |
| MediaUpload | Pending/accepted/failed states and orphan cleanup |

Use decimals for weights/nutrients, timezone-aware event timestamps, and explicit local dates/week identifiers. Historical meaning must survive changes to targets, catalog entries, units, and timezone. Preserve food nutrient snapshots and prescription/record separation.

## 9. Engineering boundaries
Retain the draft's proposed React/TypeScript website, React Native/TypeScript mobile clients, and shared Django/DRF/PostgreSQL backend as an implementation starting point rather than a mandated framework specification. Use a modular monolith with accounts, exercises, workouts, nutrition, progress, reminders, media, and sync boundaries. Share API types, validation rules, date logic, and pure calculations where appropriate; keep platform persistence and presentation adapters separate.

Keep nutrition and exercise business rules on the server and reproducible locally for offline operation. Separate public catalog assets from owner-protected media. Use authenticated upload initiation, controlled upload/finalization, scoped media delivery, and cleanup jobs for failed/orphaned media. Uploading bytes alone must not create an accepted progress-photo record.

## 10. Quality and release requirements
- Privacy: ownership checks on every API and media path; no sensitive fields in telemetry; no cross-account cache leakage. Encrypt traffic and server storage; mobile private local storage uses protected encryption keys.
- Reliability: retries do not duplicate entries; sync conflicts do not destroy data; editing history updates relevant aggregates; photo limits hold under concurrency.
- Accessibility: readable contrast, keyboard navigation on web, screen-reader labels, chart numeric alternatives, and reduced-motion handling for GIFs.
- Performance: paginated history/catalog, lazy media, and bounded cache with explicit private-photo retention controls. Set measurable response/load budgets against an agreed device/network test environment before release.
- Operations: separate staging/production, error monitoring, database/media backups, demonstrated restore, documented retention and deletion cleanup.
- Account lifecycle: deletion requires online authentication and removes server personal records/media through tracked jobs; logout/deletion clears this device's caches and cancels reminders. Other offline devices cannot be wiped until they reconnect. Provide personal data export with a separate explicit option for photographs.

## 11. Acceptance and validation matrix
| Scenario | Required outcome |
|---|---|
| Offline food entry, app restart, reconnect | Entry persists locally then syncs once; correct totals |
| Two offline devices start the same date | One server day; both sets of entries preserved |
| Same set edited on two devices | Conflict visible; neither revision silently lost |
| Historical food date/target corrected | Appropriate day totals and comparisons updated |
| Same exercise, two users add tutorial links | Each sees only their own link |
| Direct access to another user's private media | Denied for metadata, original, and thumbnail |
| Four photos plus a concurrent fifth upload | At most four accepted; rejected draft preserved |
| Week reassignment into a full week | No silent move; user resolves destination limit |
| Profile timezone changed | Future schedule adapts; historical days/weeks stable |
| Photo deleted while another device is offline | Hidden locally; stale reconnect cannot resurrect it |
| Logout/account switching | Private caches do not appear under another account |
| Notification permission denied | Other features work; clear reminder capability state |
| English/Arabic | Main journeys usable in both directions/locales |

Initial release requires core website journeys, browser offline/recovery tests, and responsive layout checks to pass. The later mobile release additionally requires Android/iOS journeys and native-specific tests to pass. Each release requires security/ownership and synchronization tests to pass; private-media handling and backup restoration to be verified; and catalog media rights to be resolved. The PRD defines required tests; it does not claim that software has been built or tested.

## 12. Delivery plan
### Phase 1 — Responsive website and shared backend
1. Agree web screens, date/week rules, media limits, and retention defaults.
2. Build accounts, shared data/API foundations, browser persistence, offline queues, and synchronization.
3. Deliver exercise catalog, private exercises/media/tutorial links, folders, and per-set records on web.
4. Deliver manual nutrition targets, food logging, daily rollover, editable history, and charts on web.
5. Deliver weight tracking, private weekly photos/comparison, and browser-supported reminders.
6. Verify responsive layouts, privacy, offline recovery, concurrency, and website release criteria; release the website.

### Phase 2 — React Native apps, added later
1. Build Android and iOS clients against the existing shared backend and account/data model.
2. Adapt the web journeys and implement native persistence, protected media, offline queues, and synchronization.
3. Implement mobile local reminders, optional device-unlock protection, and mobile capture/upload handling.
4. Verify cross-platform synchronization, Android/iOS acceptance criteria, and mobile release readiness.

Design reusable API contracts and business rules now. Initial website delivery must not depend on a React Native codebase, native builds, or mobile release checks. Estimate and schedule the mobile phase separately when it begins.

## 13. Pilot success measures
Track first folder creation, first set record, first food log, weekly returning users, logging time, sync success/failure, duplicate/conflict rates, and photo upload reliability. Do not send image contents, tutorial URLs, nutrient values, or personal notes to analytics. For a personal pilot, correctness and recoverability matter more than growth targets.

## 14. Remaining clarification and adjustable defaults
English and Arabic interface support, including RTL, is confirmed. Android and iOS remain the later native phase.
Nutrition entry is confirmed: enter the portion's calories and macros directly, record weight separately, and add each value to its daily consumed / target counter.

Other working defaults: Monday–Sunday weeks, one replaceable private tutorial URL per exercise, one editable body-weight measurement per day, Start New Day opens today without locking history, 10 MB original photo limit, and a proposed 30-day backup retention period. These can be changed without reopening the confirmed product scope.
