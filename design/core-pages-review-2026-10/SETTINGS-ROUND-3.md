# Settings mock-up, round 3

_Updated 2026-10-30 - Settings round 3 built as a mock-up for Josh's review; Design owns._

**Status: mock-up only. No real `/ward-flow` screen has changed (D-74).** Built on branch
`claude/settings-mockup-improvements-9j8gcz` of `BigSimmo/Ward-Flow`, which starts from
`claude/core-pages-design-review-f5vf4g` at `9da375a1` (itself carrying `main` at `b6aa5cd`, the commit
these pages depict, per D-75). It was not merged with `claude/home-activity-mockup`, which conflicts
with the design branch in four files outside Settings.

## What Josh asked for

Suggestions, grounded in the repository and in the two mock-up chats, to improve the Settings page's
structure, design, usability and logic, including new smart and general settings. Josh then said
"Go ahead with all recommendations" (30 October 2026).

## Where to look

- `/mockups/ward-flow-redesign/settings` (coordinator), `/as-ward-settings` (nurse in charge),
  `/as-admin-home` (access admin) and `/as-executive-settings` (executive, new).
- Every change and its reason is in the viewer's build notes (`_preview/build-notes.ts`, entries
  `settings`, `as-ward-settings`, `as-admin-home`, `as-executive-settings`).

## What changed, and why

1. **Tabs by job.** Rules, Alerts, Display and profile, Help and data, Access. Help, the tour and
   Shortcuts were under Display; "Data and about" mixed rule files, developer switches, reference
   tables and About.
2. **Rules in four cards by job,** each rule showing what it reaches on today's records, read with
   the app's own checks. Warnings read recorded due times only (D-70). Rules with no single check
   (Morning bed numbers, forecast alerts) show no count rather than an invented one.
3. **Honest Surge.** Surge's wards-asked value equals the default, so it changes two rules; the card
   says so.
4. **Changed from default** on each rule, with Show changed only.
5. **One line for the last change** instead of the five-row Recent changes card; Full audit lives there
   only.
6. **Review before saving,** also used when a rules file is loaded. Download writes the saved rules
   only.
7. **Restore** lists all twelve rules (today's dialog says nine) and offers Rules only, or Rules and
   this browser with the seven browser settings named.
8. **Alerts readiness card** with one next step and a real test notification, beside the switches.
9. **Find a setting** covers rows it could not find, and only this desk's tabs.
10. **Who can change what** (read only) under Access, read from `EVENT_ROLE`.
11. **One component for every role,** with `ROLE BRANCH (ward)` and `ROLE BRANCH (admin)` marks; the
    nurse in charge and access admin copies were retired, and an executive view was added.
12. **Styling** uses this folder's own classes; the `[class*="_x__"]` overrides that the shareable copy
    dropped are gone. The profile card's Appearance row went (it repeated Display beside it).

## Questions for Josh

1. **Proposed browser settings:** keep, drop or change each of Open Ward Flow on, Theme follows the
   shift, and Text size? My recommendation: keep Text size and Open Ward Flow on; drop Theme follows
   the shift unless night staff ask for it (Glare and Dark already cover most needs).
2. **Review before saving:** keep it for every save, or only when three or more rules change?
   My recommendation: every save, because rules change every screen and each save is audited.
3. **Who can change what:** show it to every desk with an Access tab, or the access admin and
   statewide coordinator only? My recommendation: every desk with Access, since it explains why a
   control is read only.

## For the real build (after approval)

- One Settings file with role branches; the rule list (`settings-rule-catalogue.ts`) replaces the
  hand-written lists in `reset-baseline-modal.tsx`, `settings-search-index.ts` and `ruleDiffs`.
- The restore dialog's "nine rules" text and the Export/Import mismatch are real-app bugs today.
- The proposals need the app to read them (front door, theme, text scale) before they can ship (D-72).
