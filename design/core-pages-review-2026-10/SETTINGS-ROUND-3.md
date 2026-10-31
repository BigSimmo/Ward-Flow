# Settings mock-up, round 3

_Updated 2026-10-31 - handover moved to SETTINGS-HANDOVER.md; draft PR #1122; Design owns._

**Status: mock-up only. No real `/ward-flow` screen has changed (D-74).** Built on branch
`claude/settings-mockup-improvements-9j8gcz` of `BigSimmo/Ward-Flow`, which starts from
`claude/core-pages-design-review-f5vf4g` at `9da375a1` (itself carrying `main` at `b6aa5cd`, the commit
these pages depict, per D-75). It was not merged with `claude/home-activity-mockup`, which conflicts
with the design branch in four files outside Settings.

## Handover

The full handover (where it stands, every change explained, Josh's decisions, files, checks, open
items and how to pick it up) is in [SETTINGS-HANDOVER.md](SETTINGS-HANDOVER.md). Draft PR
[#1122](https://github.com/BigSimmo/Ward-Flow/pull/1122); review page
https://claude.ai/artifact/DYY3QFivR4pKS6LkPFNpL3.

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
10. **Who can change what** (read only) under Access. Its rules row reads `EVENT_ROLE`; the other rows
    are written text matching today's Access screen and D-66, D-80 and D-86.
11. **One component for every role,** with `ROLE BRANCH (ward)` and `ROLE BRANCH (admin)` marks; the
    nurse in charge and access admin copies were retired, and an executive view was added.
12. **Styling** uses this folder's own classes; the `[class*="_x__"]` overrides that the shareable copy
    dropped are gone. The profile card's Appearance row went (it repeated Display beside it).

## Josh's answers (31 October)

Josh answered "Yes to all recommendations" to the three questions below. These answer the mock-up's
questions; they are not approval to build into the real app, which still needs Josh's explicit approval
of the mock-up (D-74).

1. **Proposed browser settings:** keep Open Ward Flow on and Text size (shown under "New for this browser · Agreed 31 Oct");
   Theme follows the shift is dropped and removed from the mock-up.
2. **Review before saving:** on every save. Already drawn that way.
3. **Who can change what:** on every desk with an Access tab. Already drawn that way.

## For the real build (after approval)

- One Settings file with role branches; the rule list (`settings-rule-catalogue.ts`) replaces the
  hand-written lists in `reset-baseline-modal.tsx`, `settings-search-index.ts` and `ruleDiffs`.
- The restore dialog's "nine rules" text and the Export/Import mismatch are real-app bugs today.
- The two agreed browser settings need the app to read them (the front door for Open Ward Flow on, the
  text scale for Text size) before they can ship (D-72).
