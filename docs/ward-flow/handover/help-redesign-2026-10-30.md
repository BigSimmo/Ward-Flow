# Help redesign: How do I…, Show me, tour and shortcuts — handover

_Updated 2026-10-31 - Help redesign handover for PR #1119; Documentation owns._

## Where it stands

- **Built, not live.** The work is real app code on branch `claude/help-menu-design-review-a1isgp`, in draft
  pull request [#1119](https://github.com/BigSimmo/Ward-Flow/pull/1119). Staff see nothing until Josh merges it;
  the live site then picks it up at the next daily release (6 am Perth).
- **Merging needs Josh's yes.** Merging does not switch Show me on in demo or production: D-91 and D-92 keep it off there.
- **Screenshots** of the built Help (desktop, phone, dark mode, 31 October, synthetic data) are on a private page
  linked from a comment on #1119. Only Josh can open it unless he shares it.
- **Open question for Josh:** is "How do I…" the right name for the first tab? Recommendation: keep it, because it
  matches how staff ask.

## What Josh asked for

On 30 October Josh asked for the Help menu to be reviewed on every screen size against the #1118 mock-ups and the
"Ward Flow Core Pages" artifact, then perfected, with "common tasks or questions specifically for the app and when
clicked on there is launched the interactive help part that highlights where it is with steps".

He then answered three questions, recorded as **D-90** in `docs/ward-flow/decisions.md`:

1. Build the real Help now, as an exception to the mock-up-first rule (D-74) for Help only.
2. Switch Show me and Ask on everywhere (the `help-ask` switch was developer-only). Later changed: D-91 and D-92 keep it on in development only.
3. Put the common tasks in a new first tab, "How do I…".

## What staff will see

- **How do I…, a new first tab.** The side-menu and phone-menu Help buttons open it. It lists the desk's own common
  tasks: those done on the screen in view first ("On this screen"), then the rest in fixed groups (Beds and
  referrals, Transport, Handover and reports, Finding your way, Settings and display). Grouping only, never ranking.
  Each task folds open to a short answer with **Show me** and **Go there**.
- **Show me** opens the screen the task is done on and lights each control in turn, with a card saying what to do.
  It points; it never presses anything. 31 of the 33 tasks have it. Mental Health Act times (shown only as typed,
  D-70) and Undo (no single control) have the written answer only.
- **Phone-aware.** Where a phone draws a different control, Show me lights that one (Handover's phone summary and Sign
  off, Home's Act now and To decide counts, the Referrals phone cards, the ward's Decisions tab). Print handover, the
  TV views and the downtime pack have no phone button, so on a phone they read "On a computer" and say why.
- **Desk-aware.** Show me is offered only for screens the desk can open. A task done in more than one place tries each
  in order: the TV task opens Capacity, or a ward's own page with its own Open on TV.
- **One search box**, "Search Help, or ask". The second, empty Ask box inside Reference has gone. Before anything is
  typed it suggests three of the desk's tasks with Show me. A question typed into the header search still opens Help
  with its answers.
- **This screen**: the screen's name and purpose as plain text, its main actions, "Show me how" for its own tasks,
  and its questions folding open one at a time. The header **?** still opens This screen (Josh, 24 October).
- **Your desk**: headed with the desk name; each job you do most has Show me beside its Go to link.
- **Foot of every view**: Reference, then Take the tour and Keyboard shortcuts (a phone gets the tour only). The
  footer date is a "What's new" link on a computer.
- **Tour card** (round 2 of #1118): progress bar and "Step n of N" under the header (beside Close on the welcome
  card, which drops its repeated "This takes about" line); Close is a 32px icon; Skip tour is a quiet button on the
  left, Back and Next on the right; no Back on the first card; the spotlight is the focus blue, not amber; a step
  whose control is not on screen says so; the last step links to the task list.
- **Keyboard shortcuts sheet**: three columns (Find, Open, Move around), each key beside a short label. Help's full
  sentence stays as the spoken description and the hover title.

## Fixes found on the way

- The Show me card was pinned to the top-left corner because the tour's styles overrode its placement.
- The phone dock was hidden under Show me, so dock controls could never be lit.
- A control the page drew again, or one that appeared late, was never looked for again.
- "Accept or decline a referral" looked for a button, but Decide is a link, so it lit nothing.
- The ED tour's form step lit an almost invisible screen-reader element instead of the visible chip.
- The tour offer, hints and What's new card sat behind the phone dock between 641 and 768 px wide.
- Found while checking against #1118: a type error in Help search, and an unused exported type (knip). Both would have
  failed hosted CI. A stale run lock from a session restart had been silently refusing the local typecheck; it was
  cleared and the typecheck now runs.

## How it works (for the next developer)

All paths are under `src/components/ward-management/help/` unless stated.

| File                                                              | Job                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ward-spotlight.ts`                                               | The one spotlight engine for the tour and Show me: find a control, bring it into view, light it, place the card by transform beside it, and look again when the control is redrawn or arrives late. `SPOT_NOT_HERE` is the "not on screen" line. |
| `ward-help-task-list.tsx`                                         | How do I… (`WardHelpTasks`), the shared task row `HowToRow` (also used by the Ask box), `tasksForDesk`, and `showMeAvailable` (steps exist, the device draws them, and the desk may open the screen).                                            |
| `ward-help-href.ts`                                               | `howToHref`: where a task is done, as a link this desk may follow. `go` may name several places; the first the desk may open wins.                                                                                                               |
| `ward-help-howto.ts`                                              | The 33 tasks: `topic`, `answer`, `desks`, `go`, `showMe` steps and `computerOnly`. Each step's `target` may list a desktop control then its phone stand-in. `canShowMe` checks the device.                                                       |
| `ward-help-sheet.tsx`                                             | The Help drawer: header, search, the five tabs, the foot row and the footer link.                                                                                                                                                                |
| `ward-show-me.tsx`, `ward-tour.tsx`                               | The two players. Both use `ward-spotlight.ts` and `ward-tour.module.css`. Show me's card id `ward-show-me-card` keeps the phone dock visible (`shell/ward-phone-page-dock.module.css`).                                                          |
| `ward-shortcuts-sheet.tsx`, `ward-help-content.ts`                | The shortcuts sheet, reading `KEYBOARD_SHORTCUTS` (each with `short` and `group`; `action` stays word for word with `desk-guides/interactions.md`).                                                                                              |
| `ward-help-events.ts`, `ward-help-host.tsx`, `ward-help-link.tsx` | Opening Help (`HelpView` gains `"tasks"`; `openWardHelp(view, task)` can open a task), and the rail and phone-menu Help buttons, which open How do I….                                                                                           |
| `ward-feature-flags.ts` (one folder up)                           | `help-ask` is on in development only (D-91, D-92).                                                                                                                                                                                               |

**Adding a task with Show me:** add an entry to `HOW_TOS` with a `topic`, an answer under 330 characters, its `desks`
and `go`, then `showMe` steps. Targets use `data-testid`, `id`, `data-setting` or visible text, never a class name;
give a phone stand-in where the phone draws a different control, or mark the task `computerOnly`. Wording: "pulled",
never "held" (D-81); no ranking words. Then:

- `tests/ward-help-howto.test.ts` checks every target's test id still exists in the source.
- `tests/ui-ward-help-show-me.spec.ts` (browser, `@mockup`) checks each desk's first steps light; add the task to its
  `LIT` list once you have seen it light.

## Relationship to #1118 (the redesign mock-ups)

- #1119 follows #1118's round-2 notes for Help, the tour and the shortcuts (listed above).
- #1118's Help mock-up imported two things #1119 moves. Commit `9b953f1f2` on #1118 gives the mock-up its own copies,
  so the two PRs build in either merge order (checked with a full typecheck of each alone and of both combined).
- **Whichever merges second** has two text conflicts: keep both decision entries in `docs/ward-flow/decisions.md`
  (D-89, then D-90), then rerun `node scripts/ward-flow/owner-rulings-index.mjs` for `OWNER-RULINGS.md` and `npm run docs:facts:write` for
  `docs/FACTS.md` (its latest-decision fact).

## Evidence

Local runs on 30–31 October, on synthetic data:

- **Pass:** typecheck; lint; knip (no new unused items); `check:ward-text-size`; printable guides `--check`; the Help,
  tour, Show me, shortcuts, flags and What's new unit tests (33 files, 322 tests) plus 3 added for round 2.
- **Pass, browser:** `tests/ui-ward-help-show-me.spec.ts` 10/10 (5 desks × desktop and phone) and
  `tests/ui-ward-tour-targets.spec.ts` 16/16, against the local dev server. Three cases failed on a first run and
  passed on re-run: two waited too little for a cold page (the wait was lengthened) and one was the ED phone page loading
  slowly; the ward desk's TV task was a real gap, fixed by letting a task name more than one screen.
- **Browser sweep:** every desk's Show me tasks (coordinator, ward, ED, officer, bed manager, executive, admin) on
  desktop and phone. Help checked by eye at 1440, 1024, 768 and 390 px, light and dark; no sideways scroll.
- **Not run:** `verify:pr-local`; the phone script-budget build (Help stays lazy-loaded, so no change is expected, but
  it is not measured); hosted CI was not watched.

## Known limits

- Show me points but never acts, so a later step often needs the person to open a record first (for example the
  movement before Pull the bed). The card says when a control is not on screen yet.
- The executive and admin desks cannot open Handover, so the downtime pack has a written answer only for them.
- Statistics' Export step is computer-only; the phone lights the first step only.

## Next steps

1. Josh reviews #1119 (the screenshot page is linked in its comments) and answers the tab-name question.
2. Josh presses Merge when happy. The Help redesign goes live at the next 6 am release. Show me stays off on demo and live (D-91, D-92).
3. If hosted CI flags the phone script budget, follow D-82 (diagnose, trim, then raise by at most 5 KB with the reason).
4. Whichever of #1118 and #1119 merges second resolves the two text conflicts as above.
