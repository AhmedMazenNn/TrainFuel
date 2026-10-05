---
name: trainfuel-web
description: Build or change TrainFuel's React website interfaces, editors, localization, and accessibility using the existing frontend structure. Use for web presentation and client domain behavior; native apps belong to a later phase.
---

# TrainFuel web development

## Ground the change

Read the root [AGENTS.md](../../../AGENTS.md) and the affected functional requirements in [the PRD](../../../docs/prd.md). Sections 5, 7, and 11 define screen behavior and acceptance. The baseline frontend is a minimal scaffold. On `feature/generated-ui`, inspect the relevant prototype page, context, types, utilities, adapter, and translations before adopting or editing them.

Work in `frontend/` using its root package manifest. The generated reference lives in `frontend/prototype/` on its separate feature branch. When adopting that design, reuse useful React Router, context, component, and Tailwind boundaries; the baseline does not include these libraries. Put reusable calculations in pure utilities, persistence behind adapters, and rendering in components. Do not treat prototype camelCase types as an established server contract.

## Domain behavior

- Nutrition editors must say that nutrients describe the complete portion. Quantity never scales values; missing nutrients remain unknown and explicit zero remains valid. Show partial totals, consumed/target counters, and over-target intake without clamping or blocking logging.
- Preserve explicit day selection, idempotent Start New Day behavior, historical target snapshots, and both dates' totals when moving an entry. Missing days are not observed zero-intake days; weekly averages identify their denominator.
- Keep prescriptions separate from actual/reference set records. Show previous records before new entry; copying records to prescriptions is explicit. Do not add mandatory sessions or completion state.
- Show chart gaps for missing observations, clear units, and numeric alternatives. Preserve stored values when changing display units.
- Expose durable local-save, pending-sync, synced, and attention states honestly. Current sync timers are a prototype; load [trainfuel-offline-sync](../trainfuel-offline-sync/SKILL.md) for persistence or synchronization work.
- Load [trainfuel-private-media](../trainfuel-private-media/SKILL.md) for real uploads or photo storage/access. A local photo count and data URL are insufficient production enforcement.

## Presentation and localization

When adopting the prototype, use its `PreferencesContext` translation, number, and date helpers and translation dictionaries. Preserve English and Arabic copy and layout while recording bilingual scope as a PRD assumption. The existing English translation fallback is a UI convention; shared exercise translation fallback needs an explicit policy when that catalog is implemented. User-entered text stays as entered.

Verify layouts in both directions and at narrow/wide widths. Reuse dialogs and fields with labels, validation messages, keyboard navigation, focus handling, and readable contrast. Respect reduced motion for animation/GIF presentation. Notification denial and missing offline media must leave other journeys usable.

## Acceptance checks

Run frontend build and TypeScript checks as documented in AGENTS.md. The baseline has no lint script; the prototype has its own lint command. Exercise the changed journey and relevant scenarios:

- 150 g with 30 g protein records 30 g protein; meals of 200 and 300 kcal against 2,500 show 500 consumed and 2,000 remaining.
- Unknown versus zero nutrients, incomplete drafts, over-target intake, empty days, and historical date/target corrections render accurately.
- Recording/editing sets leaves prescriptions unchanged; removing a folder preserves history.
- English/Arabic, RTL, keyboard dialogs, narrow/wide layouts, and chart numeric alternatives remain usable.

Report prototype limitations separately from tested behavior; do not claim server synchronization, ownership enforcement, or guaranteed browser reminders from UI demonstrations.
