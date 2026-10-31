# Review handover: notifications and pop-ups pass (PR #1124)

**Audience:** a reviewer, human or agent, who was not in the chat that did this work. **Status:** a factual record of
completed work for independent review; it states what was done and why, and asks nothing to be built.
**Owner:** the author of branch `claude/notifications-popups-design-qarfyt` until PR #1124 merges or closes.
**Source revision:** branch head `cd4b8331a`, based on `main` at `b6aa5cde`. The companion summary is
[2026-10-31-notifications-and-popups.md](2026-10-31-notifications-and-popups.md).

A copy-and-paste prompt for opening a fresh review chat is at the end.

## 1. Where the work is

| Item           | Value                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Repository     | `BigSimmo/Ward-Flow` (prototype; synthetic data only)                                                                  |
| Branch         | `claude/notifications-popups-design-qarfyt`                                                                            |
| Pull request   | [#1124](https://github.com/BigSimmo/Ward-Flow/pull/1124), draft, base `main`, auto-merge not armed                     |
| Base           | `main` at `b6aa5cde` (Merge PR #1109)                                                                                  |
| Commits        | `addd3086`, `af2dad63`, `7405a244`, `5f440fc3`, `5b150020`, `b1bdff4e`, `cd4b8331`                                     |
| Size           | 76 files with this note: 12 added, 62 modified, 2 deleted, including 17 regenerated Help guide files in `public/help/` |
| Sign-out       | Single-user exception (`SKIP_SIGNOUT_GUARD=1`) at the owner's choice; no "Who is editing what" comment posted          |
| Merge, release | Not merged, not released, not deployed                                                                                 |

## 2. What was asked

The owner asked for a review of every notification and pop-up in Ward Flow, with better design, style,
behaviour and function, and useful smart features grounded in the repository.

The owner then chose these options:

- **Scope.** Polish the shared toast, banner and help-card layer. Move five screen-local toast systems onto the shared provider: Board, Ward page, Community, Delays and On-call. Fix stray z-index values and the duplicated bell count. Officer, Answer-view, discharge toasts and the roughly 20 hand-built modals were left for later.
- **Smart features.** All four were chosen: smart timers, a Recent list, stacking, and an Alt+N keyboard jump.
- **Ownership.** Use the single-user sign-out exception.
- **Publication.** Later turns approved deepening the shallow clone, pushing, and opening a draft PR.

## 3. What was there before (the findings that drove the work)

- **Two toast systems.**
  - The shared one: `ToastProvider`, `ToastView` and `useToast` in `src/components/wf/`.
  - Seven or more screen-local copies, each with its own state, timer (3.5s, 4s, 5s or never), corner, radius, shadow and glyph.
  - Board (`ward-board.tsx`, 3.5s) and Community (3.5s) also timed out refusals. Audit 24-7, rule CT-09, says a refusal must stay until closed.
- **No motion.** Shared toasts had no entry or exit motion, although `design/v9/design-system-v9.md` §6 sets 220ms in, 160ms out, and a 120ms fade under reduced motion.
- **Off-scale layers.**
  - `referrals/upload-forms-modal.tsx`: inline z-index 9999 and an rgba scrim, which put it above its own toasts.
  - `statistics-ed-third-edition.module.css`: an unused `.actionToast` at 99999.
  - `movement-horizon` and `bed-meeting-sheet`: `var(--z-modal, 1000)` fallbacks.
- **The ward Notices bell was counted twice.**
  - `ward-screen.tsx` worked out the badge and `ward-notification-center.tsx` worked out the panel's total, each on its own.
  - The panel listed buzzes the ward had acknowledged.
  - The panel called an arrived patient "late" (it checked the ETA without checking whether the journey was still open).
- **Help corner cards** (tour offer, What's new, screen hints):
  - They sat in the same bottom-right corner as the desktop toasts.
  - They used two different shadows.
  - None closed on Escape.
- **Double announcement.** The board's toast was a `role=status` region, and the same text was also sent to the shell live region (`announceToWardShell`), so screen readers heard it twice.
- **Small items.** `add-patient.tsx` hard-coded `8000` instead of `UNDO_TOAST_MS`.

## 4. What was done, by area

### 4.1 Shared toast layer (`src/components/wf/`)

| File                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toast-provider.tsx`      | `commit()` replaces direct `setToasts` calls. A closed card stays drawn with `leaving: true` for `toastExitMs()`, then a timer removes it; with no exit time it goes at once. `toastsRef` holds live toasts only. Records each departed toast in an in-memory `recent` list (newest first, at most 10, with an `undone` flag). New `testId` on `Toast` and `isShown(id)` on `ToastApi`. Focus-return selectors use `[data-wf-toast]`, and focus left on a leaving card counts as lost. `ToastRegion` gains an outer host (`data-wf-toast-host`) holding a tools row and the unchanged live region (`data-testid="toast-region"`, `role=status`). Folded layout applies inline `gridRow` and `--wf-toast-depth`. |
| `toast.tsx`               | `ToastView` gains `timeout` (a pausable clock via `useCountdown`) and `leaving` (sets `data-leaving`, `aria-hidden` and `inert`). `useUndoPause` is renamed `useToastPause` and covers timed toasts too. Timed toasts also pause while the tab is hidden; Undo windows do not. The control Alt+N lands on is marked `data-toast-primary`, in priority order: running Undo, then the action, the next step, then close.                                                                                                                                                                                                                                                                                          |
| `toast-timing.ts` (new)   | `timedToastMs` (6s plus 250ms per word over 12, capped at 12s), `toastExitMs` (reads `--wf-t-exit` from `:root`), `useDocumentHidden` and `useCountdown`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `toast-stack.ts` (new)    | `toastStackLayout(toasts, expanded)`. With 3 or more foldable (non-warning, non-leaving) toasts, all foldables share one grid row placed where the newest sits, with `depth` 0, 1, 2…; depth 3 and beyond is drawn transparent. Warning and danger keep their own rows.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `toast-recent.tsx` (new)  | `ToastRecent` chip, shown for `RECENT_CHIP_MS` (30s) after notices leave while none is live. It uses the existing `Popover` from `menu.tsx` on every width, with `useMinuteNow` for the "just now" and "N min ago" labels. "Clear list" button. Danger shows the warning glyph.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `toast-keyboard.ts` (new) | `useToastJumpKey(regionRef, hasRecent)`. Alt+N is matched on `event.code === "KeyN"` with no Ctrl, Meta or Shift, and is ignored in text fields. It focuses the newest live card's primary control (or the card itself), and goes back on a second Alt+N or on Escape (capture phase, `stopImmediatePropagation`). With nothing live it bumps `recentRequest`. Only the region holding the newest card answers.                                                                                                                                                                                                                                                                                                 |
| `overlay.module.css`      | Adds keyframes `wfToastIn`, `wfToastOut`, `wfToastFadeIn` and `wfToastFadeOut` (`forwards` only on the exit), the `.toastList` grid, the folded transforms using individual `translate` and `scale` properties, `.toastTools` and `.toastToolButton`, the Recent styles and reduced-motion overrides. A desktop rule moves the toast region left of an open `[data-wf-corner-card]`.                                                                                                                                                                                                                                                                                                                            |

### 4.2 Screen adapter and moved screens

- **`ward-management/ward-action-toast.ts`**
  - `useActionToast({ testId, tone })` returns a `Dispatch<SetStateAction<ActionToast | null>>`-shaped setter:
    - a string is a success (or `tone`) that closes itself;
    - `{ warning }` stays;
    - `null` closes this hook's last toast;
    - an update function sees this hook's last shown toast;
    - a new message replaces the hook's previous toast unless that one is a warning;
    - the same words are pushed onto the same card, which restarts its time.
  - `useTaggedToast(testId)` wraps the provider so pushes carry a test id. Used by the board's `useUndoableStep`.
  - Imports come through the approved `@/components/wf` barrel (the seam test enforces this).
- **Board** (`board/ward-board.tsx`, `ward-board-work-band.tsx`, `board.module.css`):
  - Local state, the 3.5s timer, the `BoardToastView` render and five `announceToWardShell` duplicates are removed.
  - `board/ward-board-toast.tsx` is deleted.
  - The file is now 1,477 lines, against the 1,500-line cap.
- **Ward page** (`ward/ward-screen.tsx`, `ward.module.css`): uses the adapter with test id `ward-action-toast`. `ward/ward-page-action-toast.tsx` is deleted.
- **Community** (`community-screen.tsx`, `community.module.css`): uses the adapter (tone `info`, test id `community-action-toast`). The timer, render, `#actionToast` and the unused `.clinicalToast` are removed.
- **Delays** (`delays-screen.tsx`, `delays.module.css`):
  - Test id `delays-notice`.
  - "Coordinator only" and "Escalation not confirmed…" are now warnings.
  - "Recording escalation…" is info and is replaced by the outcome.
- **On-call** (`on-call-screen.tsx`, `on-call.module.css`):
  - With no sheet open, `say()` pushes a shared toast (test id `ward-on-call-notice`).
  - Inside a sheet it keeps the inline `sheetNotice` line, because the page behind is inert. `inSheetRef` is synced in an effect.
  - "Copy is unavailable…" is now a warning.

### 4.3 Bell count

- New `ward/ward-alert-counts.ts`: `wardAlerts({ unitId, now, movements, notices, refreshRequests, allocatable, dismissedBuzzKeys, censusOverdue })`.
  - It returns the lists (`buzzes`, `overdueArrivals`, `missingClearances`, `unrecordedClearances`, `wardNotices`) and the counts (`act`, `check`, `coordinator`, `unreadNotices`, `total`).
  - "Late" means open, not arrived, and past ETA plus grace, using `isOpen` and `isArrivalLate` from `ward-derivations`.
- `ward-screen.tsx` uses `.counts.total` for the badge. `ward-notification-center.tsx` uses the same function for its lists and counts, and gains a `dismissedBuzzKeys` prop.
- `ward-screen-top-bar.tsx` passes the dismissed buzz keys through.

### 4.4 Help corner cards

- New `help/use-corner-card-escape.ts`: a window keydown handler in the bubble phase. It ignores the key when:
  - the event was already handled;
  - a sheet is open (`hasOpenSheet()`);
  - focus is in a text field;
  - a modal dialog or menu is in the DOM.
- `ward-tour-auto-start.tsx`, `ward-whats-new.tsx` and `help-content/ward-help-hints.tsx`:
  - use the hook (Escape works as "Not now" or "Got it");
  - carry `data-wf-corner-card`.
- Their modules:
  - What's new now uses `--wf-e3` instead of `--shadow-overlay`.
  - On a phone, each card fades (`opacity: 0; pointer-events: none`) while a live toast exists, unless the card holds focus.

### 4.5 Layering and odds and ends

- **Upload-forms modal.**
  - Its inline styles moved into its CSS module: `.scrim` on `--z-modal` with `--wf-scrim-strong`; `.panel` with `--wf-r-lg` and `--wf-e3`; `.head`.
  - It still uses the existing `useWardModalFocus`, not the shared `Dialog`.
- The `, 1000` fallbacks were dropped, and the dead 99999 class was deleted.
- `add-patient.tsx` uses `UNDO_TOAST_MS`.
- **Help content and docs:**
  - `help/ward-help-content.ts` gains an Alt+N row in `KEYBOARD_SHORTCUTS`. The same row went into `docs/ward-flow/desk-guides/interactions.md`, and `public/help/*` was regenerated with `scripts/build-help-cheat-sheets.mjs`.
  - `whats-new.json` gains one line; `2026-10-27-form-code-titles` was dropped to stay within the 20-entry limit.

### 4.6 Tests

- **New:**
  - `tests/wf-toast-smart-features.dom.test.tsx`: exit motion, timers, the hidden tab, the Undo window in a hidden tab, restart on repeat, folding, a warning never folding, focus expanding the stack, Recent order and cap, no storage writes, Alt+N there and back, Escape, and typing left alone.
  - `tests/ward-alert-counts.test.ts`.
  - `tests/ward-corner-card-escape.dom.test.tsx`.
  - `tests/helpers/with-toasts.tsx` (`renderWithToasts`), listed in `tests/helpers/README.md`.
- **Rewritten:**
  - `ward-action-toast-clears.dom.test.tsx`: a success clears itself; a warning survives 60s.
  - `ward-refusal-toast-tone.dom.test.tsx`.
- **Updated:**
  - Eight screen test files now render inside `renderWithToasts`.
  - `ward-board-leave-beds` now checks that the shell region does not repeat the toast. Its test name changed from "labels and announces…" to "labels … and announces it once".
  - `ward-builder-2-features` checks that the card sits inside a `role=status` region.
  - `ward-community-dossier-integrity` uses the new test id.
  - `ward-feedback-settlement` wraps its escalation test in a provider.
  - `ward-overlay-stacking.test.ts`: five deleted-class rows were swapped for three new layer rows, plus a new block asserting the five migrated modules keep no toast rule.

## 5. Decisions taken in the session, with reasons

1. **One announcer.** The board's duplicate `announceToWardShell` calls were removed. Those duplicates had patient names stripped, but the toast region already read the full text with the name, which H-0371 (D-83) allows. The shell region no longer repeats it.
2. **Undo windows do not pause in a hidden tab.** `tasks-acknowledge-visible.tsx` commits in `onExpire`; pausing could hold that save up indefinitely.
3. **The Recent chip is visible for only 30s**, on every width, to avoid sitting over content near the dock. Alt+N opens Recent at any time.
4. **Recent wording.** "This list is kept on this page only and clears when it reloads." The privacy-wording rule requires proof; a unit test spies on `Storage.prototype.setItem`.
5. **One test id per screen.** The adapter keeps each screen's existing test id (`ward-board-toast` and the rest) rather than moving tests to `toast`. Board Undo toasts from `useUndoableStep` now also carry `ward-board-toast` (via `useTaggedToast`), where they were previously `toast`.
6. **Replace, don't pile up.** Within one screen a new outcome replaces the previous success, so stacking appears only when different sources raise notices together.
7. **Exit time read at commit.** The exit time is read from the computed style when a toast closes. With no token stylesheet loaded (jsdom), cards leave at once, so about 100 existing toast tests kept their timing.

## 6. Differences from the approved plan

- **Recent on phone** uses the wf `Popover` (it flips upward through `usePanelFit`), not `PhoneSheet` as planned.
- **Bell count.** The panel calls `wardAlerts` itself and receives `dismissedBuzzKeys`; the planned precomputed `alerts` prop was not used.
- **Corner cards.** Their widths were not unified; they keep 22.5rem, 22rem and 23rem. Only the shadow and behaviour were unified.
- **`TOUR_AUTO_STARTED_EVENT`** was not moved into a shared module. Its two declarations are deliberate, with a code comment, to keep a first-load chunk small, and `ward-whats-new.dom.test.tsx` reads the source.
- **Test files.** The planned separate files (`wf-toast-motion`, `-smart-timers`, `-stack`, `-recent`, `-jump-key`, `ward-action-toast-adapter`) were merged into `wf-toast-smart-features.dom.test.tsx` and the rewritten `ward-action-toast-clears` test.
- **Multi-region Alt+N** (`5f440fc3`) was added after a browser script suggested a second region was swallowing the key. Checking found one region mounted; the real cause was a 30-second script wait. The change is defensive, not a proven fix.
- **What's new wording** differs slightly from the plan: "Notices pause while you point at them or look away. Alt+N jumps to the newest; Recent shows the last few."

## 7. Evidence

### Fresh in this session

- **Full `npm test`** (1,792 files) on the tree before `5b150020`:
  - 18,219 passed, 2 failed, 32 skipped.
  - The two failures were the seam test (an import from `wf/toast-provider`) and the printable Help guides (stale after the shortcut row).
  - Both were fixed in `5b150020` and re-run with six related files: 8 files, 56 tests, all pass.
  - The full suite was not re-run after `5b150020`.
- **`check:ward-expected-reds`** on the clean, committed tree at `5b150020`: 18 of 18 batches, 0 failures, exit 0.
- **Other gates, all exit 0:**
  - `check:diff-integrity`: 15 changed test files, 93 → 117 cases, against base `b6aa5cdef`.
  - Docs: `docs:check-scripts`, `docs:check-links`, `docs:check-index`, `docs:check-inventory`, `ward:organise:check` and `docs:maintain:check`.
  - `check:runtime` (Node 24.22.1, npm 11) and `check:installed-lock-parity`.
- **Typecheck.**
  - The project typecheck (`tsconfig.typecheck.json`) passed before the bell-count and corner-card commits.
  - Later commits passed the pre-commit hook's staged-file lint and typecheck.
  - ESLint with `--max-warnings 0` passed on all changed TypeScript files.
- **Browser** (local `next dev`, Chromium, Playwright scripts kept outside the repository):
  - Desktop 1440×900, light theme, on On-call and Settings: shared toast placement, the Undo line, Alt+N landing on Dismiss or Undo, the Recent chip, and the popover opening upward.
  - 390×844, dark theme, on Settings: two pills above the dock, then the Recent chip centred.

### Not run or not proven

- Full-repository `npm run lint` and `npm run typecheck` after the final commits. The push hook skipped them because another heavy run held the lock.
- `npm run build` and `scripts/check-script-budget.mjs` (the phone first-load JS limits in `script-budget.json`).
- Playwright journeys (`test:e2e:ward-journeys`) and the release-gate axe sweep.
- A folded stack seen live in a browser. It is proven by DOM tests only.
- Reduced-motion and forced-colours rendering.
- Manual screen-reader testing (VoiceOver, NVDA): the leaving-card `aria-hidden` and `inert`, and `aria-relevant="additions text"` with grid reflow.
- Hosted CI on PR #1124 had not reported when this note was written.

## 8. Points a reviewer may want to look at

These are known soft spots, listed as facts, not as instructions.

- **Commit `addd3086`** contains two deletions (`ward-board-toast.tsx`, `ward-page-action-toast.tsx`) whose importers changed only in `af2dad63`, so `addd3086` alone does not build. History was not rewritten.
- **Hover-expanded stack.** While hovered, `.toastList[data-hover-open="true"]` sets `pointer-events: auto` on the whole column, which blocks clicks on page content under the column's box until the pointer leaves.
- **Folded layout.** Folded cards are placed with inline `gridRow` and `grid-column: 1` overlap; folded depth uses individual `translate` and `scale` properties. Folding depends on the `+N more` and hover state in `ToastRegion`, which calls `setPinned(false)` during render when folding is no longer needed.
- **State set during render.**
  - `useCountdown` resets with a render-time `setRun`.
  - `ToastRecent` uses render-time `setShownFor` and `setHandledRequest`, and an animation-frame `trigger.click()` to open the popover from Alt+N.
- **Adapter behaviour changes.**
  - A screen that used to show successive successes in place (Board, Community) now replaces them on the shared region.
  - A screen warning followed by successes leaves the warning showing and adds the success alongside.
- **Longer timers.** Messages over 12 words now stay longer than 6s, so a few existing toasts with long text last up to 12s.
- **Escape.** `useCornerCardEscape` closes a card on any unhandled Escape anywhere on the page, not only when focus is in or near the card.
- **Corner cards and toasts.**
  - On a phone, a corner card is hidden while any live toast exists, unless it holds focus.
  - On desktop, the toast region's `right` offset assumes the card is at most `23rem` wide.
- **On-call** keeps two notice paths: the shared toast outside a sheet, and the inline `sheetNotice` inside one.
- **Bundle size.** The provider now loads `Popover`, `lucide-react`'s `History` icon and the new modules on every route. Bundle impact is unmeasured.
- **Alt+N inside sheets.** Escape handling in `toast-keyboard.ts` runs in the window capture phase and stops other handlers only when focus is inside a toast that Alt+N jumped to.
- **Test changes.** The renamed test in `ward-board-leave-beds` and the five swapped rows in `ward-overlay-stacking.test.ts` passed `check:diff-integrity`, but each is a behaviour assertion that changed.

## 9. How the work can be inspected

- **Diff:** `git diff b6aa5cde..cd4b8331a`, or the PR's "Files changed" tab.
- **Focused tests:** `node scripts/run-vitest.mjs run tests/wf-toast-smart-features.dom.test.tsx tests/ward-alert-counts.test.ts tests/ward-corner-card-escape.dom.test.tsx tests/ward-action-toast-clears.dom.test.tsx tests/ward-refusal-toast-tone.dom.test.tsx tests/ward-overlay-stacking.test.ts`
- **Running app:** `npm run ensure`, then:
  - Settings → Rules: press + and Save for an Undo toast; hover it; Alt+N; dismiss it; Recent.
  - On-call: star a line.
  - Phone width: switch row density.
- **Owner rules that bear on review:**
  - `AGENTS.md` and `docs/ward-flow/HOW-WE-WORK.md` §6 (tokens only, no hex; D-43 colour; 12px minimum; line caps; phone size limits).
  - `docs/ward-flow/decisions.md` (D-57 item 17, the only undo pattern; D-61 and D-62, Alerts; D-83, names).
  - `design/v9/design-system-v9.md` §6 (motion).

## 10. Handover prompt (copy and paste)

```text
I'm handing you a piece of finished work to review and assess. You didn't do this work, and I'm not
asking you to change anything yet. I'd like an independent view of it.

Repository: BigSimmo/Ward-Flow (a psychiatric bed-flow prototype for Western Australia; synthetic
data only, not clinical decision support). Follow the repository's AGENTS.md.
Branch: claude/notifications-popups-design-qarfyt, head cd4b8331a, based on main at b6aa5cde.
Pull request: #1124 (draft) — https://github.com/BigSimmo/Ward-Flow/pull/1124

What it is: a pass over Ward Flow's notifications and pop-ups. Five screens (Board, Ward page,
Community, Delays, On-call) had their own toast code; they now use the shared ToastProvider through a
new adapter, useActionToast. Board and Community used to time out refusals after 3.5 seconds; now
refusals stay until closed. The shared toasts gained v9 enter/exit motion, smart timers (pause on hover,
focus or a hidden tab; longer for long text), stacking with "+N more", a memory-only Recent list and an
Alt+N jump. Stray z-index values were fixed, the ward Notices badge and panel now count from one
function (wardAlerts), and the help corner cards close on Escape and keep clear of notices.

The full written record is in two files on the branch:
- docs/ward-flow/handover/2026-10-31-notifications-and-popups-review-handover.md (detailed: what was
  there before, every change by file, decisions and reasons, differences from the plan, evidence run
  and not run, and known soft spots)
- docs/ward-flow/handover/2026-10-31-notifications-and-popups.md (shorter summary)

Evidence as the authoring chat reported it: full unit suite run once (two failures, both caused by
the work, then fixed and re-run in isolation); check:ward-expected-reds passed on the committed tree;
diff-integrity and the docs gates passed; a browser look on desktop and 390px. Not run: full-repo lint
and typecheck after the last commits, the production build and phone script budget, Playwright
journeys, manual screen-reader testing.

Please read those files and the diff, then give me your assessment: whether the work does what it
says, whether the evidence supports its claims, anything that looks wrong, risky or against the
repository's owner rules, and how ready it is to merge. Please don't edit, commit or push.
```
