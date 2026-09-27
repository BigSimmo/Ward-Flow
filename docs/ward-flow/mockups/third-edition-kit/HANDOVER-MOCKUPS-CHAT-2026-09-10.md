# Handover: the Ward Flow mockups chat

Written 10 September 2026 for a new chat whose job is to keep iterating the Ward Flow design system and
to build more mockups on it. Read this whole file first, then the standard, then Command. Everything
named here is in git on branch `claude/wardflow-design-review-43df97` (worktree
`.claude/worktrees/ward-flow-phase-5-resume-166ecb`); the Ward Lead folds that branch into the ward
master line `codex/task-ward-flow-live-state-20260831` by SHA.

## 1. What exists, and where

**The standard (third edition), three mirrors that must say the same thing:**

| File                                                      | What it is                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`       | The standard as a document. The source of truth when mirrors differ.               |
| `docs/ward-flow/mockups/design-system-third-edition.html` | The standard as a page, with live components and printed copies of the stylesheet. |
| `docs/ward-flow/mockups/ward-flow-digest.html`            | The reader's brief: the same rulings in fewer words.                               |

**The sixteen mockups**, all in `docs/ward-flow/mockups/`, all on the third edition, all in Geist:

| Page                            | File                                                 | Published copy                                                       |
| ------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| Command (the reference build)   | `command-third-edition.html`                         | https://claude.ai/code/artifact/da47c71f-f3af-4443-a0b9-b43f59d97361 |
| Delays                          | `delays-third-edition.html`                          | https://claude.ai/code/artifact/1559a5d1-518d-4e1f-909e-40b5fc477d0f |
| Movement                        | `movement-third-edition.html`                        | https://claude.ai/code/artifact/2d9d821d-bdd1-4572-b872-b3ebbb5acab5 |
| Capacity                        | `capacity-third-edition.html`                        | https://claude.ai/code/artifact/d5a85b5b-56b3-48d0-a9fc-0a0ec173bbfd |
| Ward                            | `ward-third-edition.html`                            | https://claude.ai/code/artifact/dbc9a5fc-423c-40d0-8c87-3e45e5c1b7b9 |
| Bed board                       | `bed-board-third-edition.html`                       | https://claude.ai/code/artifact/b626363a-836c-4122-b399-57dc2b633fc4 |
| Emergency department            | `emergency-department-third-edition.html`            | https://claude.ai/code/artifact/958a4a96-6591-4371-b214-6bc0e522f962 |
| Community team                  | `community-team-third-edition.html`                  | https://claude.ai/code/artifact/c4a6427d-3f4b-4f9a-987c-27ce25478c8a |
| Patient search                  | `patient-search-third-edition.html`                  | https://claude.ai/code/artifact/8389344f-00dd-400e-a138-de666af97e46 |
| Patient Now                     | `patient-now-third-edition.html`                     | https://claude.ai/code/artifact/414a696a-445c-41ac-9cf0-95fc2df2f8a2 |
| Search hub                      | `search-hub-third-edition.html`                      | https://claude.ai/code/artifact/f93fecf2-e33c-4476-ab5b-fbd9a3751dab |
| Raise a referral                | `raise-a-referral-third-edition.html`                | https://claude.ai/code/artifact/1d5c7766-943e-4df8-b5b5-d88518af3777 |
| Statistics                      | `statistics-third-edition.html`                      | https://claude.ai/code/artifact/9b561079-d0b7-4bc0-904b-30483be9ee41 |
| Ward statistics                 | `statistics-ward-third-edition.html`                 | https://claude.ai/code/artifact/a3dce3c0-45f1-460b-9d8b-647c42c94a2a |
| Community team statistics       | `statistics-community-third-edition.html`            | https://claude.ai/code/artifact/a14dc3e2-b054-4c29-b69a-14852d9f61f7 |
| Emergency department statistics | `statistics-emergency-department-third-edition.html` | https://claude.ai/code/artifact/7e8560bf-4126-4cd0-9c88-fa9b9f24e6da |

All sixteen in one page: https://claude.ai/code/artifact/09ff68ad-5526-49f0-a294-243d700016ea (also
`C:\Users\joshs\Downloads\ward-flow-all-mockups.html`). The published copies were made from the files;
the files are the source. Publishing from another chat without the artifact URL creates a new artifact
rather than updating one, so pass the URL above as `url` when republishing.

**The kit**, `docs/ward-flow/mockups/third-edition-kit/`:

| File                   | What it does                                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check.mjs`            | Whole-page sweep of one page at eight widths in both themes: contrast, the 12px floor, overflow, fonts loaded, reconciliation. Prints `ALL GREEN` or the red lines.                                      |
| `check-shell.mjs`      | Behaviour and shell checks: Escape order, service restore, modal drawers, the mark, closed-strip words, nothing clipped. Written against Command; two lines are Command-specific (see `AGENT-BRIEF.md`). |
| `check-standard.mjs`   | The standard's page against Command's stylesheet and its own printed copies.                                                                                                                             |
| `shots.mjs`            | Screenshots in both themes at 1x and 2x plus a light and dark pair.                                                                                                                                      |
| `run-all-checks.sh`    | Serial `check.mjs` over all sixteen pages plus check-shell and check-standard, into one output file.                                                                                                     |
| `shell-sweep.mjs`      | Text comparison of every page's shell against Command's: stylesheet, rail, bar, drawers, live region, reconciliation line, shell functions. Reports drift page by page.                                  |
| `fonts/`               | The Geist and Geist Mono files and the stylesheet the harness serves in place of Google Fonts, so runs are offline and repeatable.                                                                       |
| `check-output.txt`     | The 10 September run: ALL GREEN on all sixteen pages, check-shell and check-standard.                                                                                                                    |
| `AGENT-BRIEF.md`       | The brief to give one agent per page when building or perfecting a mockup. Use it as written.                                                                                                            |
| `HANDOVER.md`          | The kit's running status, with dated blocks for 8, 9 and 10 September.                                                                                                                                   |
| `RESUME-2026-09-09.md` | The record of the run that the owner's usage limit interrupted, closed.                                                                                                                                  |

Every script runs from the repository root, for example
`node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/<page>-third-edition.html platinum`.

## 2. The rulings that shape every page (all recorded in the standard's section 13)

1. **No coloured bar along any edge** of a row, candidate or card, brass included, and **no highlight
   along the top** of a panel or control. Owner, 9 September 2026. Status is carried by a word, a mark
   or a meter, never by an edge.
2. **The type floor is 12px** for HTML text (12, 13, 13.5, 14px for the four working steps; 16, 20,
   26px above). SVG text in the flow map may keep 10.5px and up.
3. **One modern family: Geist, with Geist Mono for figures**, replacing Source Serif 4, Source Sans 3 and
   JetBrains Mono. Owner ruling 9 September, chosen by the lead. Three tokens and one Google Fonts link
   carry it; no page names a font family itself. Geist is about a tenth wider than Source Sans 3, which is
   why the closed rail strip is 84px and the bar's laptop step tightens its padding and takes the title to
   t-5.
4. **Escape never clears the service.** Picking a person outside the chosen service moves the service to
   theirs and offers "Back to X". Drawers are modal dialogs with a focus trap. A rail press on an unbuilt
   screen opens the live tally. The prototype mark stays visible at every width.
5. **Every screen is the shell of section 5.6**: one rail, one one-row bar, three drawers, one primary
   action, panels with header strips. Patient search was moved into the shell on this rule.
6. **Honesty about data.** Every figure is invented and the page says so. Every count is derived from the
   page's data and reconciles. Zero reads "none"; an empty list says why. No verdict about a person. No
   risk or acuity score anywhere; Patient search refuses to give one. The third bed stage is "discharged",
   never "released". Eligibility gates are judgements overridable with a reason; no reason creates a bed.
   Delays and Movement are separate populations (open-only versus including closed).
7. **A disclosure sentence must be true read alone** (owner, 9 September, enforced in the app): "The bed
   figures are invented" discloses; "This prototype shows four beds" does not. The sixteen pages currently
   read "Synthetic snapshot at <time>, figures reconcile"; the owner's approved wording for the Command
   drawing is "Invented figures, reconciled with each other" and it is an open question whether the third
   edition adopts it (one shared string in the shell script if so).

## 3. How a new mockup is built

1. Read the standard's section 11 (the recipe and the Never list) and section 14 (the screens index; a
   new screen gets an entry there first, or the gap is reported to the owner).
2. Copy `command-third-edition.html`: its head, tokens, whole stylesheet, shell markup and shell script.
   Change only the named page parts (current rail link, tally figures, primary action, storage key,
   title, heading). Put the page's own rules below the shared stylesheet under a comment naming the
   screen, token only.
3. Build the body from section 6's components: rows, cards, strips, tabs with counts, facts lists, the
   stepper, the figure band, the table, the chart with a stated scale.
4. Prove it with the harness, look at the 1600 and 390 screenshots, and work through section 10's
   definition of done line by line.
5. Commit the one file with an explicit path. Never `git add -A`. Republish with the artifact URL.

To build several pages at once: one agent per page on `AGENT-BRIEF.md`, Fable or Opus for design judgement
(Sonnet for mechanical ports), each owning one file, none committing; the lead commits after reading each
report, then runs `run-all-checks.sh` and `shell-sweep.mjs`. Subagent reasoning effort is inherited live
from the parent chat, per turn, so the chat's own setting governs their cost while they run. Twenty is
the concurrent-agent ceiling. Sixteen Fable agents on High for about an hour used most of a Pro Max
window on 9 September; budget for that.

Shared-layer changes (anything in the stylesheet's shared block or the shell script) are never made on
one page: make them on Command, then apply to every page by exact substring replace in a script, then
re-run the serial checks. The five pages that are full HTML documents (Ward, Search hub, Raise a referral,
Ward statistics, Emergency department statistics) are indented four spaces deeper by Prettier, so compare
shells ignoring whitespace, and put a page rule at the end of the main stylesheet, not the head's reset
block.

## 4. Open decisions for the owner (not settled; do not decide them for him)

1. Seven built pages have no entry in the standard's section 14 screens index: Delays, Bed board, Search
   hub, Patient Now, Ward statistics, Community team statistics, Emergency department statistics. Each
   marks a parent rail link meanwhile (Delays marks Command, Bed board marks Capacity, Search hub and
   Patient Now mark Patient search, the statistics sub-pages mark Statistics).
2. Search hub versus Patient search: the hub is a directory of places; rename it or fold its search into
   Patient search.
3. Patient Now versus Movement: Patient Now is the person's record across presentations; Movement is one
   movement's events and decisions. Confirm or redraw.
4. Where a page's own primary action sits when the bar's New referral is fixed (Capacity's Hold a bed,
   Statistics' Export, Movement's Record a decision).
5. The bar's collapse ladder assumes a one-word title; long-titled pages carry their own steps. A shorter
   bar name on those pages, or a standard step, would remove the special cases.
6. The rail's brass bar beside the current item, the flow map's ED-node side bars, and the brand stripe:
   keep or remove.
7. The Activity line wording (section 2, item 7 above).
8. Fourteen untracked `undefined-*.png` screenshots at the worktree root, left by an agent, await the
   owner's word to delete. The stale kit fragments `shell/shell.css` and `shell-docs.css` likewise.

## 5. Rules of the house that bind this chat

- Ward Flow is never pushed; both ward branches exist on this disk only. Never delete or move anything
  matching ward-flow, any handover or decision document, any worktree or the backups without asking the
  owner and saying what would be lost. A hook denies these mechanically.
- Commit as you go, with explicit paths. Never `git add -A`, never bare `git stash`. Before turning to
  anything else, commit or say what is uncommitted.
- Ledger changes only through `npm run issues:add|update|done` (immutable inbox requests), never by
  editing `docs/outstanding-issues.md`.
- Provider boundary: no GitHub, OpenAI, Supabase or CI interaction without the owner's explicit word.
- The Ward Lead chat is the only chat that folds or merges; send it the tip SHA when a branch is quiet.
  Messages to it can sit undelivered while it is busy, so put anything it must have into a committed file
  too.
- Talk to Josh in plain English, answer first, one recommendation, and offer detail rather than dumping it.

## 6. Prompt to paste into the new chat

> You are the Ward Flow mockups chat. Read
> `docs/ward-flow/mockups/third-edition-kit/HANDOVER-MOCKUPS-CHAT-2026-09-10.md` first, then the standard
> `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md`, then `docs/ward-flow/mockups/command-third-edition.html`.
> The sixteen mockups in `docs/ward-flow/mockups/` are current and pass the kit harness; the standard's
> section 13 records every ruling. Your job is to keep iterating the design system and to build new mockups
> on it, one agent per page on `third-edition-kit/AGENT-BRIEF.md`, proving each with the harness and
> committing each file with an explicit path. Work in your own worktree on a branch off this one, never push,
> never delete ward-flow files without asking, and tell the Ward Lead chat the tip SHA when the branch is
> quiet. Start by telling me, in plain English, what you have read and what you propose to build first.
