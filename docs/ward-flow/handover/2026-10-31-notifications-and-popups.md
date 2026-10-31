# Handover: notifications and pop-ups pass (30–31 October 2026)

**Audience:** Josh and the next agent picking this up. **Status:** complete on branch
`claude/notifications-popups-design-qarfyt`, not merged or released. **Owner:** this branch's
author until merged. Source revision: the commits listed under [Branch and commits](#branch-and-commits).

## In one paragraph

Every notice in Ward Flow now comes from one shared toast system that moves, pauses and is read
aloud the same way on every desk. Five screens (Board, Ward page, Community, Delays, On-call) had
their own home-made toasts. Board and Community also let refusals vanish after 3.5 seconds, which
breaks CT-09. These now go through the shared system, so refusals stay until closed. Four new
features were added: smart timers, a Recent list, stacking with "+N more", and an Alt+N shortcut.
Five stray layering and counting bugs were fixed. The unit suite passes; the evidence and what is
still unverified are below.

## What staff will notice

| Area              | Before                                                                                         | Now                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Toast motion      | Appeared and vanished with no movement                                                         | Rises in over 220ms, leaves over 160ms (v9 design system §6). A 120ms fade under reduced motion                      |
| Toast timing      | A fixed 6s, or 3.5–5s on some screens. Refusals vanished on Board and Community                | 6s for a short message, up to 12s for a long one. Pauses on hover, focus or a hidden tab. Refusals stay until closed |
| Screen toasts     | Five screens drew their own, each with its own corner, size, shadow and glyph                  | One look everywhere: glass card on desktop, dark pill above the dock on a phone                                      |
| Several at once   | Up to five cards stacked in a tall column                                                      | Three or more self-closing notices fold behind the newest, with "+N more". Warnings never fold                       |
| Missed a notice   | Gone for good                                                                                  | A "Recent" chip appears for 30s after notices leave. It lists the last 10 of this visit, in memory only              |
| Keyboard          | No way to reach Undo without tabbing through the page                                          | Alt+N (Option+N on a Mac) jumps to the newest notice's button, and back. With none showing, it opens Recent          |
| Help corner cards | The tour offer, What's new and hints sat under the toasts, used two shadows and ignored Escape | Notices stand to their left on desktop. On a phone the card steps back while a notice shows. Escape closes them      |
| Ward Notices bell | The badge and the panel counted separately and could disagree                                  | One rule counts both. The panel no longer lists acknowledged buzzes or calls an arrived patient late                 |
| Screen readers    | The board read each outcome twice (its toast plus the shell live region)                       | Read once, by the shared toast region                                                                                |

## How each part works

**Shared toast system** (`src/components/wf/`)

- `toast-provider.tsx`:
  - Keeps the live toasts. A closed card stays for the exit time with `data-leaving`, `inert` and `aria-hidden`, then is removed. With no token stylesheet loaded (unit tests) it is removed at once, so existing tests keep their timing.
  - Adds `testId`, `isShown(id)` and the in-memory `recent` list.
  - Lays out the tools row (with "+N more" and Recent) outside the live region, so neither control is announced.
- `toast.tsx`:
  - `ToastView` gains `timeout` (a pausable clock) and `leaving`.
  - It marks the control Alt+N should reach with `data-toast-primary`: Undo, then the action, the next step, then close.
- `toast-timing.ts`: `timedToastMs`, `toastExitMs`, `useDocumentHidden` and `useCountdown`.
- `toast-stack.ts`: `toastStackLayout` places cards in grid rows. Folded cards share a row and get a `--wf-toast-depth`. Warnings and danger keep their own rows.
- `toast-recent.tsx`: the Recent chip and popover. It reuses the wf `Popover`, which flips up by itself, and `useMinuteNow`. It holds no callbacks, so an expired Undo is never offered again.
- `toast-keyboard.ts`: Alt+N and Escape. It matches on `event.code` (Option+N on a Mac is a dead key) and skips text fields. Only the region holding the newest notice answers.
- `overlay.module.css`:
  - Motion keyframes, with no fill-mode on entry so the glass blur still works.
  - The stack grid and the tools row.
  - The rule that moves notices beside an open corner card.

**Screen adapter** (`src/components/ward-management/ward-action-toast.ts`)

- `useActionToast({ testId, tone })` returns a setter shaped like `useState`'s, so screens keep their call sites. Each kind of value behaves as follows:
  - a string: a success that closes itself;
  - `{ warning }`: stays until closed;
  - `null`: closes this screen's last toast;
  - an update function: replaces this screen's own toast. The ward page uses this to turn "not confirmed" into success.
- A new message replaces the screen's previous one, except that a warning is never pushed out by a success.
- `useTaggedToast(testId)` passes the board's test id to `useUndoableStep`, so its Undo toasts carry the same name.

**Ward Notices count** (`src/components/ward-management/ward/ward-alert-counts.ts`)

- `wardAlerts(...)` returns the lists and the counts.
- `ward-screen.tsx` uses it for the badge, and `ward-notification-center.tsx` uses it for the panel.
- Acknowledged buzz keys reach the panel through `ward-screen-top-bar.tsx`.

**Help corner cards** (`help/use-corner-card-escape.ts`)

- Escape works as "Not now" or "Got it" once any open dialog, sheet or menu has had the key.
- Each card carries `data-wf-corner-card`.

**Layering fixes**

- The record document dialog (`referrals/upload-forms-modal.*`) sat at z-index 9999, above its own toasts. It is now on `--z-modal` and uses tokens.
- `movement-horizon` and `bed-meeting-sheet` lost their `1000` fallback.
- A dead `.actionToast` with z-index 99999 was removed from the statistics CSS.

## Decisions taken (change them if you disagree)

1. **Read once.** The board's duplicate `announceToWardShell` calls are removed, so the shared toast region is the only one that announces. Patient names are still read, as H-0371 allows, from the toast region only.
2. **Undo windows do not pause in a hidden tab.** `tasks-acknowledge-visible.tsx` saves when the window ends, and pausing could hold that save up. Ordinary timed notices do pause.
3. **The Recent chip shows for 30 seconds** after the last notice leaves, then hides. Alt+N opens Recent at any time.
4. **Recent wording.** The list says it "is kept on this page only and clears when it reloads". A unit test proves nothing reaches `Storage.setItem`, as the privacy-wording rule requires.
5. **On-call inside a sheet** keeps its inline notice line, because the page behind a sheet is inert. Outside a sheet it uses the shared toast.
6. **What's new.** Added the line "Notices pause while you point at them…". Dropped the unreferenced `2026-10-27-form-code-titles` to stay at the 20-entry limit.

## Evidence

**Verified in this session**

- **Full unit suite** (`npm test`, all 1,792 files): 18,219 tests passed, 2 failed, 32 skipped.
  - Both failures were caused by this work: the Ward Flow seam test and the printable Help guides.
  - Both were fixed in `5b150020` and pass on re-run, with the related help tests: 8 files, 56 tests.
- **New tests:**
  - `wf-toast-smart-features.dom.test.tsx`: exit motion, timers, stacking, Recent and Alt+N.
  - `ward-action-toast-clears.dom.test.tsx` and `ward-refusal-toast-tone.dom.test.tsx`, rewritten for the adapter.
  - `ward-alert-counts.test.ts` and `ward-corner-card-escape.dom.test.tsx`.
  - Guard rows in `ward-overlay-stacking.test.ts`.
- **Gates that passed:**
  - `check:diff-integrity`: 93 → 117 test cases, no lost tests.
  - `docs:check-scripts`, `docs:check-links`, `docs:check-index` and `docs:check-inventory`.
  - `check:runtime` and `check:installed-lock-parity`.
  - `check:ward-expected-reds` on the committed tree at `5b150020`: 18 of 18 batches, 0 failures.
  - `ward:organise:check` and `docs:maintain:check`.
  - Typecheck (`tsconfig.typecheck.json`) and lint on every changed file. The pre-commit hook passed on each commit.
- **Browser look** (local dev server, Chromium):
  - Desktop light on Settings and On-call: toast motion, the Undo line, Alt+N reaching Undo, and the Recent chip and popover opening upward.
  - 390px dark on Settings: pills above the dock, and the Recent chip centred after they leave.

**Not verified, or still open**

- **Full-repository checks:** `npm run lint` and `npm run typecheck` were run only per changed file. The push hook skipped its own run because the expected-reds check held the run lock. CI on the PR runs both.
- **Not run:**
  - `npm run build` and the phone script budget (`scripts/check-script-budget.mjs`). The provider adds roughly 3–5 KB to every route. If a route goes over its limit, lazy-load the Recent panel before raising any limit.
  - Playwright journeys (`npm run test:e2e:ward-journeys`).
- **Folded stack in a real browser:** never seen. No single screen raises three outcomes at once, since each screen replaces its own last message. Stacking is proven by DOM tests only. It shows when several sources fire together, such as an Undo toast plus a PWA update notice plus a screen outcome.
- **Screen readers:** not tested by hand (VoiceOver, NVDA). Closing cards are `aria-hidden` and `inert`, so they should not be re-read.
- **History:** the first commit (`addd3086`) also took in the two file deletions that `af2dad63` depends on, so `addd3086` does not build on its own. The branch head builds and tests clean. History was not rewritten.
- **Sign-out:** commits used the single-user sign-out exception (`SKIP_SIGNOUT_GUARD=1`), at Josh's choice. No "Who is editing what" comment was posted.

## Left for a later pass

- The Officer, Answer-view and discharge "ready to leave" toasts still use their own code. The Officer screen also has its own Undo button, against D-57 item 17. Move them with `useActionToast` or `useUndoableStep`.
- About 20 hand-built modals (bed dossier, patient-now, community modals, board confirms and others) still have their own scrim, radius and z-index. Move them onto the shared `Dialog`.
- `TOUR_AUTO_STARTED_EVENT` is still declared twice. That copy is deliberate, kept to protect a first-load chunk, and `ward-whats-new.dom.test.tsx` checks it.
- Three places still use `window.confirm`: `use-dirty-state-guard.ts` twice and `ward-tasks-drawer.tsx` once.

## How to try it

1. Run `npm run ensure` and open the printed URL.
2. On **Settings → Rules**, press + on any value and Save twice. The Undo toast rises in; hover it and the line pauses. Press **Alt+N** to land on Undo, then Alt+N or Escape to go back. Dismiss it; **Recent** appears bottom right.
3. On **On-call**, star a line. "Added to My list" uses the shared toast.
4. On a phone width, switch Row density on Settings. The pills sit above the dock and Recent appears in the centre after they leave.

## Branch and commits

Branch `claude/notifications-popups-design-qarfyt` on `BigSimmo/Ward-Flow`, based on `main` at `b6aa5cde`.

| Commit     | What                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| `addd3086` | Shared toast motion, smart timers, stacking, Recent and Alt+N                          |
| `af2dad63` | Screen toasts onto the shared region; layering fixes; one bell count                   |
| `7405a244` | Help corner cards: Escape, clear of notices, one shadow; add-patient Undo time         |
| `5f440fc3` | Alt+N answered only by the region holding the newest notice                            |
| `5b150020` | Adapter imports through the approved `@/components/wf` barrel; Help guides regenerated |
