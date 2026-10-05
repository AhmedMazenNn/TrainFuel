---
name: trainfuel-private-media
description: Implement or review TrainFuel private progress photos and custom exercise media, including upload finalization, authorized delivery, weekly slot limits, local caching, and deletion cleanup. Use for media lifecycle or privacy changes.
---

# TrainFuel private media

Read [AGENTS.md](../../../AGENTS.md), PRD FR-03, FR-10, FR-13 and sections 9–11 in [the PRD](../../../docs/prd.md), and the `media_asset`, `exercise_media`, `media_upload`, `progress_week`, and `progress_photo` tables in [the DBML](../../../docs/schema.dbml).

On `feature/generated-ui`, the prototype stores photo data URLs with a 1.5 MB client limit. It has no real authorized storage pipeline. The PRD's 10 MB original limit, common mobile-format conversion, and 30-day backup retention are proposed defaults, not implemented guarantees.

## Upload and access boundaries

- Initiate uploads as an authenticated owner, stage bytes in controlled storage, validate/process them, and finalize attachment in an authorized transaction. Uploading bytes alone does not create an accepted progress photo.
- Validate actual image content, supported formats, size, dimensions, and orientation. Strip location/device metadata from processed uploads and preserve user-entered capture dates separately. Test conversions before promising common mobile capture format support.
- Store private originals and thumbnails in nonpublic storage using storage keys, not permanent delivery URLs. Authorize metadata, originals, thumbnails, comparisons, and downloads. Short-lived signed URLs are bearer access until expiry and must not enter logs or persistent public records.
- Check asset ownership and intended purpose at finalization. Prevent an active asset from being attached across incompatible exercise/photo records; table-local uniqueness alone does not establish cross-table exclusivity.
- Catalog administration never grants private media/gallery access. Separate shared licensed catalog media from owner-protected custom exercises and progress assets. Record source/license provenance before distributing shared exercise media.
- Keep image contents/URLs out of telemetry, crash reports, notification previews, and automatic exports. Photo export requires a separate explicit option. Do not claim end-to-end encryption without implementing it.

## Weekly photos and offline recovery

- Preserve explicit assigned week start and capture date; timezone changes do not regroup historical photos. Monday–Sunday is the working default. Photos do not require a weight entry or mandatory pose/label.
- Enforce at most four active finalized photos per owner/week using slots 1–4, active week/slot uniqueness, and transactional week locking. Replacements use their existing slot; moves recheck destination capacity and remain atomic. Deletions release server slots only after accepted deletion.
- Client limits reflect known state; server finalization is authoritative across devices. Preserve rejected local drafts and offer replacing an accepted photo, changing the week, or explicitly discarding the pending upload.
- Cache private web photos only with opt-in and bounded storage controls. Account isolation and careful cleanup are required; browser storage offers weaker shared-device isolation. Native protected/encrypted media storage is a later-phase requirement.
- Hide deleted photos immediately in the interface, propagate tombstones, and track cleanup of originals, derivatives, and abandoned/failed uploads. Document actual backup retention; do not promise instant erasure from backups or disconnected devices.

Compare two selected weeks using labels when available and manual selection otherwise. Use side-by-side images on wide screens and labeled swipe/toggle navigation on narrow screens. Zoom must not mutate sources; weight summaries and photographs must not imply proven body-fat or muscle changes.

## Acceptance checks

- Another account and a catalog admin cannot retrieve private metadata, originals, thumbnails, or downloads.
- Concurrent finalization accepts no more than four photos; the rejected fifth remains recoverable locally.
- Moving into a full week fails without losing the existing photo; replacement retains its slot; accepted deletion permits reuse.
- Invalid image content is rejected, orientation/conversion works for supported formats, and processed output removes location/device metadata.
- Upload failure, interruption, stale deletion replay, and orphan cleanup preserve the documented lifecycle.
- Opt-in caching, account switching, deletion, comparisons without weight entries, and narrow/wide layouts behave as specified.

Load [trainfuel-data-model](../trainfuel-data-model/SKILL.md) for constraints and [trainfuel-offline-sync](../trainfuel-offline-sync/SKILL.md) for staged files and replay.
