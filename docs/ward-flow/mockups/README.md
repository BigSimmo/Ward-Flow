# Ward Flow mockups — start here

> **WARD FLOW ENTRY POINT:** Start at [`docs/ward-flow/README.md`](../README.md).

The drawings of Ward Flow, and the standard they are drawn to. **The standard is 224 KB and is not
a landing page; this is.**

🔴 **Ward Flow is never pushed.** Both ward branches exist on this disk only. No push, no PR, no
remote. Never delete or move anything under `docs/ward-flow/` without asking the owner and saying
exactly what would be lost.

---

## The standard, in three mirrors that must agree

| Read this                                                              | When                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`WARD-FLOW-DESIGN-SYSTEM.md`](WARD-FLOW-DESIGN-SYSTEM.md)             | **The source of truth.** When the mirrors differ, this wins. |
| [`design-system-third-edition.html`](design-system-third-edition.html) | The same thing as a page, with live components.              |
| [`ward-flow-digest.html`](ward-flow-digest.html)                       | The reader's brief — the same rulings in fewer words.        |

**The sections worth knowing by number:** §5.6 the shell · §6 the components · §8 wording and
honesty about data · §9 the accessibility floor · §10 the definition of done · §11 the recipe and
the **Never** list · §13 the decisions taken · §14 the screens index.

---

## The sixteen pages

All on the third edition, all in Geist and Geist Mono, all passing the kit harness as at
10 September 2026. **Command is the reference build every other page copies from.**

| Page                            | File                                                                                                       | Published                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Command** (the reference)     | [`command-third-edition.html`](command-third-edition.html)                                                 | [artifact](https://claude.ai/code/artifact/da47c71f-f3af-4443-a0b9-b43f59d97361) |
| Delays                          | [`delays-third-edition.html`](delays-third-edition.html)                                                   | [artifact](https://claude.ai/code/artifact/1559a5d1-518d-4e1f-909e-40b5fc477d0f) |
| Movement                        | [`movement-third-edition.html`](movement-third-edition.html)                                               | [artifact](https://claude.ai/code/artifact/2d9d821d-bdd1-4572-b872-b3ebbb5acab5) |
| Capacity                        | [`capacity-third-edition.html`](capacity-third-edition.html)                                               | [artifact](https://claude.ai/code/artifact/d5a85b5b-56b3-48d0-a9fc-0a0ec173bbfd) |
| Ward                            | [`ward-third-edition.html`](ward-third-edition.html)                                                       | [artifact](https://claude.ai/code/artifact/dbc9a5fc-423c-40d0-8c87-3e45e5c1b7b9) |
| Bed board                       | [`bed-board-third-edition.html`](bed-board-third-edition.html)                                             | [artifact](https://claude.ai/code/artifact/b626363a-836c-4122-b399-57dc2b633fc4) |
| Emergency department            | [`emergency-department-third-edition.html`](emergency-department-third-edition.html)                       | [artifact](https://claude.ai/code/artifact/958a4a96-6591-4371-b214-6bc0e522f962) |
| Community team                  | [`community-team-third-edition.html`](community-team-third-edition.html)                                   | [artifact](https://claude.ai/code/artifact/c4a6427d-3f4b-4f9a-987c-27ce25478c8a) |
| Patient search                  | [`patient-search-third-edition.html`](patient-search-third-edition.html)                                   | [artifact](https://claude.ai/code/artifact/8389344f-00dd-400e-a138-de666af97e46) |
| Patient Now                     | [`patient-now-third-edition.html`](patient-now-third-edition.html)                                         | [artifact](https://claude.ai/code/artifact/414a696a-445c-41ac-9cf0-95fc2df2f8a2) |
| Search hub                      | [`search-hub-third-edition.html`](search-hub-third-edition.html)                                           | [artifact](https://claude.ai/code/artifact/f93fecf2-e33c-4476-ab5b-fbd9a3751dab) |
| Raise a referral                | [`raise-a-referral-third-edition.html`](raise-a-referral-third-edition.html)                               | [artifact](https://claude.ai/code/artifact/1d5c7766-943e-4df8-b5b5-d88518af3777) |
| Statistics                      | [`statistics-third-edition.html`](statistics-third-edition.html)                                           | [artifact](https://claude.ai/code/artifact/9b561079-d0b7-4bc0-904b-30483be9ee41) |
| Ward statistics                 | [`statistics-ward-third-edition.html`](statistics-ward-third-edition.html)                                 | [artifact](https://claude.ai/code/artifact/a3dce3c0-45f1-460b-9d8b-647c42c94a2a) |
| Community team statistics       | [`statistics-community-third-edition.html`](statistics-community-third-edition.html)                       | [artifact](https://claude.ai/code/artifact/a14dc3e2-b054-4c29-b69a-14852d9f61f7) |
| Emergency department statistics | [`statistics-emergency-department-third-edition.html`](statistics-emergency-department-third-edition.html) | [artifact](https://claude.ai/code/artifact/7e8560bf-4126-4cd0-9c88-fa9b9f24e6da) |

**All sixteen on one page:**
[artifact](https://claude.ai/code/artifact/09ff68ad-5526-49f0-a294-243d700016ea)

⚠️ **Republishing uses the artifact URL above as `url`.** Publishing without it creates a second
artifact rather than updating the one the owner has open.

**Earlier drawings, kept:** `patient-search-console.html`, `patient-search-working.html`. The
eighteen pre-third-edition mockups named in the standard's §13 are **superseded — do not migrate
them again.**

### Reference only, not a design source — marked 2026-09-17

`docs/ward-flow/archive/dated-notes/owner-answers-2026-09-17.md` item 42: "The five extra drawings are reference only;
the ED 'third edition' is the ED drawing." **`emergency-department-third-edition.html` is confirmed
as the ED drawing** — it is the one already registered at `/ed/[edId]` in `SCREEN-VERIFICATION.md`.
The five reference-only files, none of them a design source for any screen — do not build against
them:

- `patient-search-console.html`
- `patient-search-working.html`
- `sovereign-chrome-and-drawers-perfected.html`
- `sovereign-sidebar-ultimate.html`
- `settings-perfected-third-edition.html` — **reference only, confirmed 17 Sept 2026, round 2.**
  `docs/ward-flow/archive/dated-notes/owner-answers-2026-09-17.md` R2-15 said to keep the Gemini rebuild of Settings if it
  is the most up-to-date one. **Which of the two Settings files is Gemini's rebuild is now recorded:
  `settings-third-edition.html` is Gemini's rebuild, not this file.** Confirmed by git date — the
  Gemini rebuild commit for `settings-third-edition.html` (`f0e5ea88f9`, 16 September 2026) is newer
  than the previously approved version (`1ef9ed3975`, 12 September), and `settings-third-edition.html`
  is the file already routed at `/mockups/ward-flow/settings` and indexed as the built Settings
  drawing (see `SCREEN-VERIFICATION.md`). `settings-perfected-third-edition.html` was not updated by
  the same 17 September commits and stays reference only. The Settings screen's headings (Domain 3 and
  Domain 5) were brought in line with `settings-third-edition.html` in `460c5a4e9c`. Detail:
  `docs/ward-flow/STATUS.md` "What is built" and `docs/ward-flow-task-ledger.md` §7.8.

## The eleven added on 11 September 2026

Built one agent per page on [`third-edition-kit/AGENT-BRIEF.md`](third-edition-kit/AGENT-BRIEF.md),
each proved with `check.mjs` ALL GREEN at eight widths in both themes, and each re-run by the lead
rather than taken from its report.

| Page                 | File                                                                             | Published                                                                        |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Handover             | [`handover-third-edition.html`](handover-third-edition.html)                     | [artifact](https://claude.ai/code/artifact/1e3acf4c-5fc2-41a7-aafe-c83482af9c4d) |
| Add a patient        | [`add-a-patient-third-edition.html`](add-a-patient-third-edition.html)           | [artifact](https://claude.ai/code/artifact/426662dd-2a9f-4705-9402-0a14bae72aca) |
| Referrals            | [`referrals-third-edition.html`](referrals-third-edition.html)                   | [artifact](https://claude.ai/code/artifact/dd39fdf9-fdf6-43d0-91f3-2d9b967efab4) |
| Governance           | [`governance-third-edition.html`](governance-third-edition.html)                 | [artifact](https://claude.ai/code/artifact/89fa49a7-a787-43cc-88e8-457440e9d665) |
| Out of area          | [`out-of-area-third-edition.html`](out-of-area-third-edition.html)               | [artifact](https://claude.ai/code/artifact/ac185925-f9a8-42d5-9157-646781ad73a9) |
| Service statistics   | [`statistics-service-third-edition.html`](statistics-service-third-edition.html) | [artifact](https://claude.ai/code/artifact/a367e3e1-dc7c-4aab-93c6-4cc507aee6bb) |
| Transport officer    | [`transport-officer-third-edition.html`](transport-officer-third-edition.html)   | [artifact](https://claude.ai/code/artifact/8796e427-6a55-443d-b56f-60cce3fbf225) |
| Alerts               | [`alerts-third-edition.html`](alerts-third-edition.html)                         | [artifact](https://claude.ai/code/artifact/b4d30eb8-2323-4fe6-b4bd-26e3dc6db6e5) |
| Settings             | [`settings-third-edition.html`](settings-third-edition.html)                     | [artifact](https://claude.ai/code/artifact/50c25925-0b76-4984-a6e9-775524b42d9e) |
| On-call and contacts | [`on-call-third-edition.html`](on-call-third-edition.html)                       | [artifact](https://claude.ai/code/artifact/e7f73f49-f9aa-4563-a8f0-e6dc54adf20a) |
| Sign in and role     | [`sign-in-third-edition.html`](sign-in-third-edition.html)                       | [artifact](https://claude.ai/code/artifact/6192ad32-d269-4489-befa-ceb84265dc2e) |

⚠️ **Republishing any of these uses its URL above as `url`.** Publishing without it creates a second
artifact rather than updating the one the owner has open.

🔴 **Two of the eleven are deliberately unlike the rest.** **Sign in** carries no rail and no bar,
because a rail that reads _"Signed in as Bed coordinator"_ cannot appear before anybody has signed in;
it also contains no input element of any kind, so it can never become somewhere a real password is
typed. **Transport officer** is designed for a phone beside a van and holds up at desk width in the
same file.

**Four of the eleven have no entry in the standard's §14 screens index** and are recorded as gaps
rather than added to it by a builder.

---

## The seven added on 11 September 2026

Built the same way, each proved with both harnesses and each re-run by the lead rather than taken
from its agent's report.

🔴 **None of these has an artifact URL yet.** Publishing was refused in the session that drew them,
so the files are the only copy. **Do not treat the missing links as an oversight to be quietly
filled by publishing fresh artifacts** — anything published without going through this table gains
a second URL for a page the owner may already have open somewhere else.

| Page                | File                                                                               | Published |
| ------------------- | ---------------------------------------------------------------------------------- | --------- |
| Network             | [`network-third-edition.html`](network-third-edition.html)                         | not yet   |
| Wards               | [`wards-third-edition.html`](wards-third-edition.html)                             | not yet   |
| Discharges          | [`discharges-third-edition.html`](discharges-third-edition.html)                   | not yet   |
| Statistics overview | [`statistics-overview-third-edition.html`](statistics-overview-third-edition.html) | not yet   |
| Statistics compare  | [`statistics-compare-third-edition.html`](statistics-compare-third-edition.html)   | not yet   |
| Legal forms         | [`legal-forms-third-edition.html`](legal-forms-third-edition.html)                 | not yet   |
| Ward answer         | [`ward-answer-third-edition.html`](ward-answer-third-edition.html)                 | not yet   |

**Four pages published earlier changed materially on 11 September and their artifacts are behind
the files:** Governance gained the access record as a second tab; Settings gained the Thresholds
section; Patient Now gained the Legal panel; Alerts had a one-handed phone pass. **Republish each
to its own URL from the table above — never without one.**

⚠️ **Every page in every table above also gained a shared-layer fix on 11 September** that no
artifact carries yet: the Service selector's popover opened 125px off the left edge of the window
at every width below 1001px, on all 33 pages, since the shell was written. **So every published
artifact is currently the broken version on a phone.**

### Undrawn screen status

- **`/movements` (`MovementsScreen`)** is drawn as [`movement-third-edition.html`](movement-third-edition.html) and verified.
- **`/community` (`CommunityIndex`)** acts as the statewide team gateway and has no dedicated standalone drawing (renders dynamically from registered WA mental health teams).

---

## Proving a page

Every command runs **from the repository root**, not from this folder.

```bash
npx prettier --write docs/ward-flow/mockups/<page>-third-edition.html
node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/<page>-third-edition.html platinum
node docs/ward-flow/mockups/third-edition-kit/check-shell.mjs docs/ward-flow/mockups/<page>-third-edition.html platinum
```

`check.mjs` sweeps eight widths (1920, 1600, 1440, 1280, 1200, 1100, 390, 320) in both themes:
fonts loaded, no unloaded weight, console clean, no sideways overflow, the 12px HTML and 10.5px SVG
type floor, 4.5:1 contrast on every visible text element (3:1 at 24px, or 18.66px bold), the
appearance control's first click, and a focus ring on the third Tab stop. It prints **`ALL GREEN`**
or the red lines.

Drift of any page's shell from Command's:

```bash
node docs/ward-flow/mockups/third-edition-kit/shell-sweep.mjs
```

Every page must read `SAME SHELL`.

⚠️ **A claim without its output is not a pass.** Paste the deciding line. On this machine
`npm run format` has printed _"prettier is not recognized"_ and **exited 0 having changed nothing** —
a zero-change result and a clean tree look identical. Run `npx prettier` directly.

⚠️ **Prettier crashes on several of these files.** Format one file at a time, never the whole tree.

⚠️ **`run-all-checks.sh` has a hard-coded `cd`** to a different worktree
(`.claude/worktrees/ward-flow-phase-5-resume-166ecb`). It will fail here. Run the individual `node`
commands above instead.

⚠️ **`docs/ward-flow/design/prototypes/` is in `.prettierignore` deliberately** — those files are
compared byte for byte against `statistics-language-*.css`, and a whole-tree format pass reddened
ten guards on 2026-09-10. Do not remove that entry.

---

## Building a new page

1. Read the standard's **§11** (the recipe and the Never list) and **§14** (the screens index). A
   screen with no §14 entry is **reported to the owner as a gap, never added to the standard by an
   agent**.
2. Copy `command-third-edition.html` — its head, tokens, whole stylesheet, shell markup and shell
   script. **Copy; never re-derive.** Change only the named page parts: title, heading, the
   appearance storage key (`ward-flow-<page>-appearance`), the current rail link, the four
   live-tally figures, and the primary action.
3. Page rules go **below** the shared stylesheet under a banner naming the screen. Tokens only.
4. 🔴 **Do not define `window.__commandCheck`.** `check.mjs` requires it absent on any non-Command
   page. Name the page's own check array for the page, as search-hub uses `window.__hubCheck`.
5. Prove it, look at it in both themes, then commit the one file with an explicit path.

**Shared-layer changes are made on Command and applied to every page by script — never on one
page.** A page edited alone drifts, and `shell-sweep.mjs` is what catches it.

Give one agent one page, on
[`third-edition-kit/AGENT-BRIEF.md`](third-edition-kit/AGENT-BRIEF.md). Use it as written.

---

## The rules that govern every drawing

**A mockup sits outside every gate.** No test runs against it, no type-checker reads it, no linter
touches it. **The only reader is a person.** So a defect fixed in the built screens can be redrawn
and approved back in, and nothing anywhere goes red. That has happened here.

- **No coloured bar along any edge** of a row, candidate or card, brass included, and **no highlight
  along the top** of a panel or control. Owner, 9 September 2026.
- **An invented figure carries its own provenance.** Owner, 9 September 2026: _"the number should
  always carry that it's invented"_. **A sentence must be true READ ALONE** — quoted, screen-read,
  or reached after the heading has scrolled away, because a heading does not travel with the
  sentence.
- 🔴 **Never write the negated form.** _"These figures are not invented"_ satisfied two automated
  guards by containing the word it denies, on the very screens that ruling came from.
- **The Activity line carries its own provenance, never liveness:**
  `Invented figures, reconciled with each other, as at <time>`. Owner ruling, 10 September 2026 (§7).
  `check-shell.mjs` asserts that sentence and rejects any beginning "Live".
- **No verdict about a person.** No invented phone number, address, record number or real-seeming
  name. Hospital sites and health services are real WA names from the repository's own tables.
- **The third bed stage is "discharged", never "released".** Owner, 30 August 2026.
- **Eligibility gates are judgements, overridable with a recorded reason.** No reason creates a bed.

---

## Where the rest lives

| Need                                | Read                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The owner's rulings, dated          | [`../archive/dated-notes/owner-decisions-2026-09-09.md`](../archive/dated-notes/owner-decisions-2026-09-09.md)            |
| What every chat is working on       | gone — `docs/ward-flow/control/work-claims.md` was deleted with WLQ-33; use [`../STATUS.md`](../STATUS.md) and the ledger |
| How a branch is folded, and by whom | [`../archive/dated-notes/HOW-TO-FOLD-2026-09-10.md`](../archive/dated-notes/HOW-TO-FOLD-2026-09-10.md)                    |
| The kit's own status and open items | [`third-edition-kit/HANDOVER.md`](third-edition-kit/HANDOVER.md)                                                          |
| The handover written for this chat  | [`third-edition-kit/HANDOVER-MOCKUPS-CHAT-2026-09-10.md`](third-edition-kit/HANDOVER-MOCKUPS-CHAT-2026-09-10.md)          |

**Ward Lead is the only chat that folds.** Commit on your own branch and hand it the SHAs.
