# Help redesign — review handover (record of the work)

_Updated 2026-10-31 - review handover of the Help redesign (PR #1119); Documentation owns._

This is a record of work done in one Claude Code session on 30–31 October 2026, written for a reader who was not
there. It describes what was done, the choices made and the evidence gathered. It does not ask the reader to do
anything. A copy-paste prompt for opening a new chat is at the end.

The companion handover, [`help-redesign-2026-10-30.md`](help-redesign-2026-10-30.md), explains the finished feature
for staff and developers. This file is the account of how it was made.

## Identifiers

| Item                | Value                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Repository          | `BigSimmo/Ward-Flow`                                                                                    |
| Branch              | `claude/help-menu-design-review-a1isgp`                                                                 |
| Pull request        | [#1119](https://github.com/BigSimmo/Ward-Flow/pull/1119), draft, not merged                             |
| Base                | `b6aa5cdef` (main after #1109, the previous Help expansion)                                             |
| Head when written   | `63dbee7d4`, plus the commit that adds this file                                                        |
| Related PR          | [#1118](https://github.com/BigSimmo/Ward-Flow/pull/1118), the redesign mock-ups; one commit `9b953f1f2` |
| Decision recorded   | D-90 in `docs/ward-flow/decisions.md`                                                                   |
| Screenshot page     | Linked in a comment on #1119; private to Josh unless he shares it                                       |
| Scale of the change | 42 files (8 added, 34 changed), about +2,185 / −761 lines, before the two handover files                |

## The request

Josh asked, on 30 October: "Please can you review the overall design and style of the help menu and how it is setup.
This includes on all screen types/devices. Please review the mockup for 1118 and the artifact for the up to date design
of the help. Please then perfect, add anything recommended, restyle or structure if required, and make any
improvements at all you think for the help menu as well as all the components of help… This also includes how the
help tutorial works. Also I would like the help menu to have or extend the option where you have common tasks or
questions specifically for the app and when clicked on there is launched the interactive help part that highlights
where it is with steps etc."

Design inputs: the Help, tour and shortcuts mock-ups in #1118 (`src/components/ward-redesign/pop-help`, `pop-tour`,
`pop-shortcuts`, with their notes in `src/app/mockups/ward-flow-redesign/_preview/build-notes.ts` on that branch),
and the "Ward Flow Core Pages" artifact (its `PAGES.p_help`).

Three questions were put to Josh, and he chose the recommended answer each time (recorded as D-90):

1. Build the real Help now, rather than update the mock-up first. This is an exception to the D-74 mock-up-first rule,
   for Help only.
2. Switch the `help-ask` flag (Ask a question and Show me) on in every environment. It was developer-only.
3. Put the common tasks in a new first tab, "How do I…".

Later in the session Josh asked for: a draft PR with a handover; a review against #1118 with fixes pushed to the
appropriate PR; a screenshot page; this record and a prompt.

## What existed before

On `b6aa5cdef`, Help was a right-hand drawer with four tabs (Your desk, This screen, Glossary, What's new), a search
overlay, an Ask box tucked inside a Reference disclosure, and Take the tour. `ward-help-howto.ts` held 33 written
tasks; 23 had "Show me" steps (1–3 each). Those tasks could only be reached by typing a search or question, and Show me
was off outside development.

## What was built

A summary; the companion handover has the detail.

- A new first tab, How do I…, listing the desk's own tasks (this screen's first, then fixed groups), each opening to
  its answer with Show me and Go there (`help/ward-help-task-list.tsx`).
- Show me on 31 of 33 tasks, with deeper walkthroughs, phone stand-in controls, a "computer only" mark for tasks a
  phone screen cannot show, and an offer only where the desk may open the screen.
- One spotlight engine shared by the tour and Show me (`help/ward-spotlight.ts`).
- The Help drawer restructured (one search box, five tabs, Reference and the tour and shortcuts at the foot), the tour
  card and the shortcuts sheet restyled to #1118's round-2 notes.
- Tests: two new unit test files, one new browser spec (`tests/ui-ward-help-show-me.spec.ts`), and updates to tests
  that pinned the old layout.

## Commit log (oldest first)

1. `6d915c578` Help: How do I… common tasks with Show me, shared spotlight, tour and shortcuts redesign
2. `2b0e5f561` Format the Help redesign files
3. `309428df9` Update Help tests for How do I…, the single search box and Show me everywhere
4. `15cdf2a5e` Give Show me phone stand-ins found by the browser sweep
5. `bae47e2cc` Tell a phone which tasks are done on a computer
6. `20ad8c626` Add a browser check that each desk's Show me lights its first control
7. `85b4e16fa` Offer Show me only on screens the desk can open
8. `a562f9aae` Light the phone's Sign off for Handover's Before you sign step
9. `3367e7e94` Let a how-to name more than one screen; TV opens the ward's own page
10. `4ef7476f2` Bring Help, tour and shortcuts to #1118's round 2, and fix two CI breaks
11. `63dbee7d4` Add the Help redesign handover, and refresh the latest-decision fact

On #1118: `9b953f1f2` Keep the Help mock-up building whichever of #1118 and #1119 merges first.

## Judgement calls made during the work

These were decided in the session, some without a specific instruction from Josh:

- **The header ? still opens This screen.** The first plan had it open How do I…; it was kept on This screen because
  of Josh's 24 October note that it means "Help for this screen". Only the side-menu and phone-menu Help open How do I….
- **The empty Ask box was removed** from Reference, following the #1118 note that search already finds how-to
  answers. A question typed into the header search still opens Help with its answers.
- **Phone rows are 44px**, following #1118's round 2; an earlier commit used 48px.
- **Show me is offered only where the desk may open the screen**, so the executive and admin desks get the downtime
  answer without Show me.
- **`computerOnly`** marks Print handover, the TV views and the downtime pack: on a phone they read "On a computer".
- **A how-to's `go` may name several places**, tried in order; used for TV (Capacity, then the desk's home).
- **Text-matched stand-ins** were used where no test id exists on the phone control ("Act now", "To decide",
  "Decisions", "Pulled").
- **#1118 round 2 adopted** for the tour (no first-card Back, focus-blue spotlight, quiet Skip, 32px Close), Help
  (Reference position, plain screen heading, no dots, footer What's new link) and shortcuts (short labels).
- **The welcome card's "This takes about N minutes" line** is removed at display, not from the step data, so the steps
  test that checks the estimate still holds.
- **What's new** gained one line; the oldest line was dropped to keep the list at its cap of 20.
- **Mental Health Act times and Undo** have no Show me (times are shown only as typed, D-70; Undo has no single
  control).
- **Decision number D-90** was used because #1118 claims D-89; on this branch the log runs D-88, then D-90.
- **#1118 was changed** with one commit, at Josh's request, so its Help mock-up keeps building after #1119.

## Process notes

- The container had Node 22; the repository requires Node 24, so Node 24 was downloaded (checksum verified) into the
  home folder.
- The clone was shallow, which blocked the push guard. History was fetched with `git fetch --unshallow` after Josh
  said yes (Ward Flow rule 3).
- File claims were written to a container-local sign-out log. The first commit passed without the log's
  "## Active sign-outs" heading because the shallow clone skipped that check; the heading was added once the history
  was complete. Claims and releases were also posted on issue #688.
- A stale heavy-run lock, left by a test run lost in a session restart, silently refused `npm run typecheck`. Some
  "typecheck passed" readings before 31 October therefore did not run; one hid a real type error in Help search, found
  by merging #1118 in a scratch copy and fixed in `4ef7476f2`. After the lock was cleared the full typecheck ran and
  passed.
- One clean-up command stopped a process by an old process number that had been reused by the session's own browser
  check; it was restarted. No other agent's process was involved.
- The screenshots and the sweep scripts live in the session's scratch folder, not in the repository.

## Evidence

All runs were local, on synthetic data.

**Fresh and passing at `4ef7476f2` and `63dbee7d4`:** typecheck; lint; knip (no new unused items);
`check:ward-text-size`; printable guides `--check`; `docs:maintain:check`; 33 Help, tour, Show me, shortcuts, flags and
What's new unit test files (322 tests) plus 3 added for round 2; doc-facts and decision-log tests (12 files, 279
tests); a full typecheck of #1118 alone and of #1118 with #1119 merged in.

**Browser:** `tests/ui-ward-help-show-me.spec.ts` 10/10 (5 desks, desktop and phone) and
`tests/ui-ward-tour-targets.spec.ts` 16/16, against the local development server. A sweep ran every desk's Show me
tasks (7 desks) on desktop and phone; Help was looked at at 1440, 1024, 768 and 390 px, light and dark.

**Re-runs:** three browser cases failed on a first run. Two passed once the spec waited longer for a page opening for
the first time; one (the ED phone tour) was a slow first page load and passed on re-run. The ward desk's TV task was a
real gap, fixed in `3367e7e94`.

**Not run:** `verify:pr-local`; the phone script-budget build; a production build; hosted CI was not observed.

## Uncertainties the session itself noted

- Hosted CI has not been seen for #1119.
- The phone script budget was not measured. Help is lazy-loaded, so no change is expected, but this is unproven.
- The browser specs ran against the dev server, not a production build.
- The Show me spec asserts only each task's first step; later steps often need the person to open a record first.
- Text-matched targets are less stable than test ids if on-screen wording changes.
- The spotlight colour change applies to the tour everywhere, not only Help.
- Phone stand-ins light a summary or tab, not the exact row the desktop step lights.

## Where the work can be seen

- The PR diff: <https://github.com/BigSimmo/Ward-Flow/pull/1119/files>
- Key files: `src/components/ward-management/help/` (`ward-spotlight.ts`, `ward-help-task-list.tsx`,
  `ward-help-href.ts`, `ward-help-howto.ts`, `ward-help-sheet.tsx`, `ward-tour.tsx`, `ward-show-me.tsx`,
  `ward-shortcuts-sheet.tsx`, `ward-help-content.ts`), `ward-feature-flags.ts`, `shell/ward-phone-page-dock.module.css`.
- Tests: `tests/ward-help-tasks.dom.test.tsx`, `tests/ward-show-me.dom.test.tsx`, `tests/ui-ward-help-show-me.spec.ts`,
  `tests/ui-ward-tour-targets.spec.ts`.
- Records: D-90 in `docs/ward-flow/decisions.md`; the What's new line in `help/whats-new.json`; the companion handover.
- The #1118 notes the design follows: `src/app/mockups/ward-flow-redesign/_preview/build-notes.ts` and
  `review-notes.json` on branch `claude/core-pages-design-review-f5vf4g`.

## Prompt for a new chat

Copy everything inside the box into a new chat.

```text
I'm handing you context on work done in another Claude Code session. This message is context only: please don't
change anything, run anything or post anything yet. I'll tell you what I want once you've read it.

Project: Ward Flow, repository BigSimmo/Ward-Flow (a psychiatric bed-flow prototype on synthetic data only).
The work: a redesign of the in-app Help menu, a new "How do I…" tab of common tasks that each launch a "Show me"
walkthrough which lights the real on-screen controls step by step, and a restyled tour and keyboard shortcuts sheet.

Where it is:
- Draft pull request #1119, branch claude/help-menu-design-review-a1isgp (not merged, not live).
- Record of how the work was done: docs/ward-flow/handover/help-redesign-2026-10-30-review-handover.md
- Explanation of the finished feature: docs/ward-flow/handover/help-redesign-2026-10-30.md
- Owner decision: D-90 in docs/ward-flow/decisions.md
- Related draft pull request #1118 (the redesign mock-ups the design follows), which received one small
  compatibility commit, 9b953f1f2.

Please read those two handover files and wait for my instructions.
```
