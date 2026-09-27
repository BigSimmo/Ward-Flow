# Build contract — Ward answer (`docs/ward-flow/mockups/ward-answer-third-edition.html`)

## 1. Does this screen already exist?

**Yes, in full — and the real one is far more capable than the drawing.**
`src/components/ward-management/ward/ward-screen.tsx` (2,426 lines), routed at
`src/app/mockups/ward-flow/ward/[unitId]/page.tsx` (`/mockups/ward-flow/ward/[unitId]`), reachable
from the nav switcher (`ward-role-switcher.tsx:195`). It is `"use client"`, reads `useWardFlow()`
live state, and dispatches real reducer events. Confirmed by grep, not "ward-screen.tsx" alone —
`officer-screen.tsx` is a different screen (transport officer) and was checked and ruled out.

Every phrase and control the drawing shows already exists in the built screen:

- `"Accept in principle"` — `ward-screen.tsx:123` (`ACCEPT_IN_PRINCIPLE` label) and `:2031` (dispatch).
- `"Decline"` + closed-list reason picker — `:494–504` (`toggleDecline`/`submitDecline`, dispatches `DECLINE`).
- `"Confirm beds"` / allocatable stepper — `:601–645` (`submitCapacity`, dispatches `CONFIRM_CAPACITY`).
- Refusal messages built from `stageCopy[movement.stage].label` (not raw identifiers) — `:83–92`
  (`referralAnswerBlocked`).

Additionally the built screen has controls the drawing never shows at all: `PULL_PATIENT`,
`CONFIRM_BED_RELEASE`, `RELEASE_BED`, `BLOCK_BED_RELEASE`, `CLEAR_BED_RELEASE_BLOCK`,
`END_LEAVE_BED` (bed-release lifecycle), an override register, and a suburb/team panel.

**Consequence for this brief:** the drawing is not a proposal for new functionality — it is a
restyled, narrowed re-drawing of a screen that is already live, wired, and reducer-backed. The
drawing's own comment (line 4853) says "Nothing on this screen mutates the invented data... exactly
as Hold a bed and Ask a ward do on their own screens" — that statement is true of the _drawing_ but
false of the _product_: the real screen mutates real state on every one of those actions today.

## 2. Sections (drawing, in order)

Header (title "Ward answer", search, service-scope menu, Activity/Tasks/Tools drawers, "New
referral" menu — explicitly "Not wired in this prototype" — "Confirm beds" shortcut button) →
**Bed request** panel (one request at a time, stepper, gates list, decline picker) → **Confirm your
beds** panel (allocatable stepper + Confirm beds) → **Recent answers** panel (this shift's log).
4 panels total (1 primary + 3 supporting), plus header chrome.

## 3–4. Data and actions per section — versus the model and the reducer

| Section               | Data                                                                                                  | In model?                                                                                           | Action(s)                        | Event                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| Bed request card      | request fields (cohort, security, sex, specialling, highAcuity, legalStatus, tier, elapsed, override) | Yes — `Movement`/`Unit` fields, `ward-model.ts`                                                     | Accept in principle              | `ACCEPT_IN_PRINCIPLE` (exists, `ward-flow-events.ts:249`)                                  |
| "                     | gates, pass/fail, override note                                                                       | Yes — `ward-eligibility.ts` per the file's own header comment                                       | Decline → choose reason → Record | `DECLINE` (exists, `:265`)                                                                 |
| "                     | —                                                                                                     | —                                                                                                   | Previous/Next (paging)           | UI-only; no event needed                                                                   |
| Confirm your beds     | beds, lockedBeds, allocatable, empty, blocked, derived available/held/occupied                        | Yes — `unitCapacity()` in `ward-derivations.ts`, exactly as the file documents                      | Confirm beds (stepper + submit)  | `CONFIRM_CAPACITY` (exists, `:296`)                                                        |
| Recent answers        | decision log this shift                                                                               | Not checked against a real log field — the drawing's `ANSWERED` array is invented (drawing says so) | none                             | n/a                                                                                        |
| Header — New referral | —                                                                                                     | —                                                                                                   | Raise from ED / from CMHT        | drawing marks this **"Not wired in this prototype"** itself — not this brief's job to wire |

**No action in the drawing lacks a reducer event.** Every button that does something real
(Accept, Decline, Confirm beds) already has a live, dispatched `WardFlowEvent`. The only
unwired control is "New referral," and the drawing itself declines to claim it works.

## 5. Owner decisions that bind this screen

- **O-16.8 / O-17.5(a,b)** — refusal messages must use `stageCopy`'s existing stage labels, never a
  raw identifier, and the rewording is of the sentence around the label only. The **built** screen
  already complies (`referralAnswerBlocked`, `:83–92`, reads `stageCopy[movement.stage].label`). The
  **drawing** never renders a stage-blocked refusal sentence at all (its `REQUESTS` are invented and
  never in a blocked stage), so it cannot be checked against this ruling either way — flag, don't
  assume compliance from the drawing alone.
- **Rule 6 / owner, 9 Sept 2026** — no coloured bar along any row/candidate/card edge, no panel top
  highlight. The drawing's own stylesheet states this rule and appears to follow it on the
  "Bed request"/"Confirm beds"/"Recent answers" panels actually rendered in the body; the `.edCard`
  pressure-strip CSS elsewhere in the shared stylesheet is not used by this page's markup (no
  `.edList` element appears in the body I read) — do not treat unused shared CSS as evidence either
  way.
- **PD-6, 2026-08-30** — decline reason is a closed list, never free text. Both the drawing and the
  built screen already enforce this (`DECLINE_REASONS`).

I did not find a decision naming "Ward answer" by that title, so nothing beyond the above three
was found to contradict or bind it specifically.

## 6. Catchers

- Accept in principle: a test that dispatches `ACCEPT_IN_PRINCIPLE` for an eligible movement and
  asserts the movement's `acceptedUnitId` is set; a second dispatch for an already-accepted
  movement asserts a `Rejection` naming the stage, not a raw id.
- Decline: a test that dispatches `DECLINE` without a reason and asserts refusal (already covered
  by the "record" button's `aria-disabled` when no reason chosen); with a reason, asserts the
  movement stage/decline log updates and the reason is one of `DECLINE_REASONS`.
- Confirm beds: a test that dispatches `CONFIRM_CAPACITY` and asserts `unit.allocatable.value` and
  `confirmedAt` change, and that `unitCapacity()`'s derived available/held/blocked/occupied move
  together (never independently typed).
- Refusal wording: the existing stage-label guard from O-17.5(b) — "a guard that FAILS on a raw
  identifier in any refusal message" — is the named catcher for O-16.8; I did not locate this guard
  file, so cannot confirm it exists yet. Flag rather than assume.
- Recent answers: no catcher nameable — the drawing's log is invented and the built screen's
  equivalent (if any) was not located in this reading; say so rather than assume one exists.

## The limits of my reading

I read the mockup's head/style block in full and its body markup and JS engine in the ranges shown
above (roughly lines 1–1668 structural/CSS scan, then 4655–5980 for markup and behaviour); I did not
read the remainder of the 7,498-line file (activity/tasks/tools drawer rendering, the rail, and the
flow-diagram renderer past line ~5980), so a data need or action hidden only in that unread span
could exist and is not covered above. I read `ward-screen.tsx` by targeted grep and two ~120-line
windows, not end to end, so I cannot rule out other refusal paths or gate behaviours in its
untouched ~2,200 lines. I read `ward-model.ts` only for the specific fields the drawing names, not
the whole file. I read `owner-decisions-2026-09-1x.md` only via grep hits and their surrounding
~40–50 lines, not the full document, so a binding decision using different wording than what I
searched for could exist and would be missed. I did not open `ward-eligibility.ts`,
`ward-referrals.ts`, or `ward-referral-visibility.ts` directly — the gate/eligibility claims above
rest on the mockup's own citations to those files plus the `Unit`/`Movement` fields I did confirm in
`ward-model.ts`, not on reading the eligibility logic itself. I did not search for a "guard that
fails on a raw identifier" test file by name beyond the grep above, so O-17.5(b)'s catcher's
existence is unverified, not denied.

If this brief's premise needs revisiting — e.g., whether "build" here should instead mean
reconciling the drawing's third-edition visual language onto the already-live `ward-screen.tsx`
rather than building new functionality — that is a decision this brief does not cover, and it is
handed back rather than assumed.
