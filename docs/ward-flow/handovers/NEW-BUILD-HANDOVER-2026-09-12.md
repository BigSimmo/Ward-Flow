# Ward Flow — handover · START HERE

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/README.md`.** Kept for history; do not follow. Current state is in `docs/ward-flow/STATUS.md`.

**Written 2026-09-12. True at ward line `ed57c76a72` and not after.** Every SHA, count and status
below is a claim about one tree at one moment. Two hours ago I told the owner a screen was "not
started" by reading a status line written the previous day — **it was built.** Re-derive before you
act on anything here.

---

# 1 · THE NEXT FOCUS, AND IT IS THE ONLY FOCUS

> ## 🔴 BUILD THE SCREENS TO MATCH THE MOCKUP DESIGN.
>
> ## KEEP THE BEHAVIOUR THAT ALREADY WORKS.
>
> **Owner, 2026-09-12:** _"the new build must match that design perfectly in the mockups and only
> tweak small behaviours and changes that are required for the build."_

**The engine is sound. The rules are sound. Thousands of tests pass. THE SCREENS DO NOT LOOK LIKE
THE DESIGN, and that is now the whole job.**

⚠️ **AND THERE IS AN OLDER RULE THAT SAYS THE OPPOSITE — DO NOT APPLY IT.** _"The screens win and
the drawings follow"_ was ruled for the OLD build, where a drawing had gone stale against something
already shipped. **For this work the drawing leads.** Where a mockup's VISUAL DESIGN and the built
screen disagree, the mockup wins. Where a mockup's STATEMENT ABOUT BEHAVIOUR disagrees with a
working, tested engine, the engine wins **and the deviation is written down with its reason.**

🔴 **NOTHING IN THIS REPOSITORY CAN SEE THAT A SCREEN DOES NOT LOOK LIKE ITS DRAWING.** 5,039 tests
passed for weeks over the gap described in §4. **A visual check must be part of the definition of
done for every screen, not a phase at the end.** The old plan had exactly such a step. It was never
run, and that is how this survived.

---

# 2 · WHERE EVERYTHING IS

### The design guide — saved outside the repository, 17 MB

```
C:\Users\joshs\Backups\ward-flow-design-guide-2026-09-12\
  mockups\          38 HTML files   every drawing — THE DESIGN
  design-system\    54 files        the design language, its CSS, its prototypes
  rules\            38 files        ledger, owner decisions, handovers, AGENTS.md, CLAUDE.md, old plan
```

### In the repository

| What                                        | Where                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **The mockups**                             | `docs/ward-flow/mockups/*.html`                                                                       |
| **The design language**                     | `docs/ward-flow/design/prototypes/` · and `mockups/design-system-third-edition.html`                  |
| **The ledger** (decisions, refusals, risks) | `docs/ward-flow-ledger.md`                                                                            |
| **Owner decisions**                         | `docs/ward-flow/owner-*.md` — 21 files                                                                |
| **Handovers**                               | `docs/ward-flow/handovers/`                                                                           |
| **The old build plan**                      | `docs/ward-flow/plans/2026-09-11-third-edition-build-master-plan-v2.md` ⚠️ its status lines are STALE |
| **The screens**                             | `src/components/ward-management/`                                                                     |
| **The routes**                              | `src/app/mockups/ward-flow/` — 40 routes                                                              |

🔴 **`docs/ward-flow/design/prototypes/` IS IN `.prettierignore` DELIBERATELY** — those files are
compared byte-for-byte against CSS. A whole-tree format pass reddened ten guards on 2026-09-10.

⚠️ **OPEN A MOCKUP IN A REAL BROWSER, NOT A STATIC SNAPSHOT.** Each one builds its own navigation
**with JavaScript** — the `<nav class="rail open" id="rail">` element is EMPTY in the file. Viewed
without scripts it looks like a completely different design. **I drew a wrong conclusion from
exactly that and reported it to the owner.**

---

# 3 · THE MOCKUPS — 35 third-edition screens, all 2026-09-12

**The sixteen with a build contract**

| Screen               | Mockup file                                          | Built at       |
| -------------------- | ---------------------------------------------------- | -------------- |
| Command              | `command-third-edition.html`                         | `coordinator/` |
| Delays               | `delays-third-edition.html`                          | `delays/`      |
| Movement             | `movement-third-edition.html`                        | `movements/`   |
| Capacity             | `capacity-third-edition.html`                        | `capacity/`    |
| Ward                 | `ward-third-edition.html`                            | `ward/`        |
| All wards            | `wards-third-edition.html`                           | `wards/`       |
| Bed board            | `bed-board-third-edition.html`                       | `board/`       |
| Emergency department | `emergency-department-third-edition.html`            | `ed/`          |
| Community team       | `community-team-third-edition.html`                  | `community/`   |
| Patient search       | `patient-search-third-edition.html`                  | `search/`      |
| Patient              | `patient-now-third-edition.html`                     | `patients/`    |
| Search hub           | `search-hub-third-edition.html`                      | `hub/`         |
| Raise a referral     | `raise-a-referral-third-edition.html`                | `referrals/`   |
| Statistics overview  | `statistics-overview-third-edition.html`             | `statistics/`  |
| Ward statistics      | `statistics-ward-third-edition.html`                 | `statistics/`  |
| Community statistics | `statistics-community-third-edition.html`            | `statistics/`  |
| ED statistics        | `statistics-emergency-department-third-edition.html` | `statistics/`  |

**Nineteen more, drawn and never given a build contract**

`network` · `governance` · `handover` · `discharges` · `out-of-area` · `on-call` · `alerts` ·
`transport-officer` · `legal-forms` · `add-a-patient` · `referrals` · `sign-in` · `settings` ·
`statistics-service` · `statistics-compare` · `statistics` · `ward-answer` ·
**`design-system-third-edition.html` — THE DESIGN LANGUAGE, READ THIS FIRST** · `ward-flow-digest`

**Three earlier drafts, not third edition** — `patient-search-console.html`,
`patient-search-working.html` (2026-09-06). Reference only; do not build from them.

⚠️ **THE DRAWINGS CONTAIN FALSE CLAIMS ABOUT THE CODE** — four reviewers found about fifty. Nothing
type-checks a mockup. **Design: authoritative. Statements about behaviour: claims to verify.**
🔴 Five drawings' provenance sentences also fail an owner ruling — the marker binds to the SENTENCE,
never the heading above it.

---

# 4 · WHERE THE LOOK ACTUALLY IS — the stocktake, 2026-09-12

**Measured by four agents reading each mockup beside its built screen. NOTHING IS UNBUILT. Every one
of the sixteen exists and is routed.** The gap is inside the screens.

| #    | Screen               | Verdict                                             | Gap            |
| ---- | -------------------- | --------------------------------------------------- | -------------- |
| 6.1  | Command              | **CLOSE** — most faithful of all                    | hours          |
| 6.2  | Delays               | **CLOSE** — all six regions present                 | hours          |
| 6.11 | Search hub           | **CLOSE**                                           | hours          |
| 6.13 | Statistics overview  | **CLOSE** — all six panels, same order, same titles | hours          |
| —    | Statistics compare   | **CLOSE** — best match found                        | hours          |
| 6.6  | Bed board            | **CLOSE**                                           | half a day     |
| 6.8  | Community team       | **CLOSE**                                           | half a day     |
| 6.4  | Capacity             | **PARTIAL**                                         | half a day     |
| 6.16 | ED statistics        | **PARTIAL**                                         | half a day–day |
| 6.3  | Movement             | **PARTIAL**                                         | a day or more  |
| 6.5  | Ward                 | **PARTIAL**                                         | a day or more  |
| 6.7  | Emergency department | **PARTIAL**                                         | a day or more  |
| 6.9  | Patient search       | **PARTIAL**                                         | a day or more  |
| 6.10 | Patient              | **PARTIAL**                                         | a day or more  |
| 6.12 | Raise a referral     | **PARTIAL**                                         | a day or more  |
| 6.14 | Ward statistics      | **PARTIAL**                                         | a day or more  |
| 6.15 | Community statistics | **PARTIAL — the weakest**                           | a day or more  |

**Rough total: eight to twelve days.** Treat as soft — two estimates ran short today.

🔴 **THE TWO SCREENS RECORDED AS "COMPLETE AND BROWSER-VERIFIED" ARE NOT.** Search hub is genuinely
close. **Patient search is PARTIAL.** A claim in a document is not evidence.

## 4.1 · The discrepancy, and it is one pattern repeated

**① THE DESIGN SAYS CARDS AND BANDS. THE BUILD MADE TABLES.**
The clearest case is Capacity, whose mockup carries its own note: _"This was a five column table of
sentences. It is a band now."_ **The build made it a five-column table** — it implemented the exact
thing the design had deliberately moved away from. Same shape on Statistics overview (a KPI tile
band became a label/value list), Patient search (a row-button list became an HTML table), and the
access record (a table became a list).

**② TABBED PANELS BECAME STACKED SECTIONS.**
Bed board's one three-way tab → three always-visible blocks. ED's "four readings of the same
department" → four stacked sections. **ED statistics lost its department tab strip entirely**, so
changing department means leaving the page instead of switching in place.

**③ DISCLOSURE FOOTERS ARE MISSING.** Several screens have no _"what is invented and what is real"_
footer. **Capacity has none at all.** 🔴 This is the clinical disclosure, not decoration.

**④ WHOLE PANELS ABSENT.** Movement's signature "Today's traffic" diagram — **zero SVG elements in
the file**. Ward's per-bed table, "Worth your attention", "Beds on the way out", "Today's return".
Community statistics is missing six of ten sections. Ward statistics collapsed nine cards into four
panels with eight topics buried as prose subheadings.

**⑤ ONE SCREEN IS UNREACHABLE.** `ed-home.tsx` exists, is imported by nothing, and has no route. A
coordinator cannot reach the emergency-department index.

**⑥ THE SHARED HEADER IS MISSING THREE CONTROLS** on every screen — the service-scope menu, the
Activity drawer and the Tools drawer are in every mockup header and absent from
`ward-chrome-header.tsx`.

✅ **THE NAVIGATION SHAPE IS NOT A PROBLEM.** Mockups and build both use a left rail plus a top
bar. **Fix the insides of the screens, not the chrome.**

## 4.2 · The plan

1. **Read `design-system-third-edition.html` first.** Everything else is an application of it.
2. **Take the CLOSE seven first** — hours each, and they teach the pattern cheaply.
3. **For each screen: open the mockup in a real browser beside the running screen.** Match panel
   order, panel type (card/band vs table), and every panel's presence.
4. **Do not change behaviour to match a drawing.** If a drawing contradicts a working engine, keep
   the engine and record the deviation.
5. **A screen is not done until somebody has looked at it beside its mockup** at the widths the old
   plan named — 390, 820, 1440, light and dark.
6. **Restore every missing disclosure footer.** Treat it as clinical, not cosmetic.

---

# 5 · WHAT HAS BEEN DONE

**The engine, and it is the valuable part.** Bed matching, eligibility with overridable and absolute
gates, referrals, movements, transport, discharges, the legal-forms model, the ledger, the seeded
network of 23 wards across four services. **451 test files, 5,039 tests passing, zero failing.**

**Today specifically:** every lane's work folded into one line; the text-size ratchet re-pinned with
each of its five prose changes named; the specialling gate made overridable to the owner's ruling
with the bed gate proved still absolute; a stale P1 headline corrected; invisible characters cleared
from four files; a ledger guard that had never been watched refuse given its first proof; a
misleading machine-wide session counter fixed; three dead role leases released; the backup verified
by artefact rather than by its own report.

**What is NOT done:** the design. §4.

---

# 6 · THE RULES THAT CARRY ACROSS

### Safety of the work

- **Ward Flow is never pushed.** Both branches exist on one disk only.
- **Never delete or move** anything matching `ward-flow` / `ward-management` / `ward-board`, any
  handover or decision document **including superseded ones**, any worktree, either ward branch, the
  memory store or the backups — **ask first, and say exactly what would be lost.** _"Nothing imports
  it"_ is never sufficient. A hook enforces it; `CLAUDE_ALLOW_PROTECTED_DELETE=1` must be the **very
  first token** of an approved command, never by editing the hook.
- **Back up before any fold or merge:** `bash ~/.claude/scripts/backup-work.sh`. 🔴 It failed
  silently once today. **Verify the artefact:** `git bundle verify <path>` must say _"records a
  complete history"_.
- **Never `git add -A`.** Never bare `git stash`. **Never two committers in one worktree.**
- **Commit messages go through a file** — `git commit -F`. Backticks in an inline string execute.
- **No OpenAI / Supabase / GitHub / CI without explicit confirmation.** `git fetch` is provider-backed.

### "Fold into main" means the LOCAL ward line. Permanently.

⚠️ `origin/main` holds **TEN migrations the ward line lacks**, four of them fail-closed clinical
retrieval guards. A merge preserves them; **a force-push or branch replacement does not.** The rule
is _"whatever touches main must never be a replacement."_

### Two ledgers is the design

Ward Flow work goes in `docs/ward-flow-ledger.md`. The main project's `docs/outstanding-issues.md` is
**disregarded here.** 🔴 **Do not tidy them into one.**

### Verification

- **Never read the exit code. Read the runner's own summary.** A pipe returns the pipe's status; a
  run that died before starting reports identically to a failed suite.
- `node scripts/run-ward-tests.mjs` discovers **by filename**. Its key line is **`files handed in`
  equalling `files that ran`** — a dropped file is UNKNOWN, never passing.
- `npx tsc -p tsconfig.typecheck.json --noEmit` — never bare `tsc`.
- **Never run two suites at once** — the mutation harness rewrites its own file and restores it.

### Subagents

**Sonnet is the default; Opus needs a written argument.** State the tier on every dispatch and every
relayed finding. End every brief with _"if you reach a decision this brief does not cover, stop and
hand it back."_

---

# 7 · THE OWNER'S RULINGS THAT BIND

|                             | Ruling                                                                                                                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sex and gender**          | TWO fields. Sex is recorded and fixed; **GENDER determines the bed.** Two values. A trans woman is a woman here. _"Not yet recorded"_ is a third STATE, never a third gender, and **must never default to sex.** |
| **The gender gate**         | Built, tested, **and not wired in** — movements/referrals do not reliably resolve to a patient. **That decision is open.**                                                                                       |
| **Authorisation gate**      | **Overridable** — a formed patient sometimes must go to an unauthorised location under pressure; uncommon.                                                                                                       |
| **Specialling / staffing**  | **Overridable** as of 2026-09-12, same reasoning.                                                                                                                                                                |
| **Allocatable bed**         | 🔴 **ABSOLUTE.** _"No reason typed into a form creates a bed."_                                                                                                                                                  |
| **What an override is for** | It does not permit the placement — that happens anyway under pressure. **It protects the RECORD.**                                                                                                               |
| **Text size**               | No new text below 12px. 🔴 **In a fresh build nothing is grandfathered.**                                                                                                                                        |
| **Legal forms**             | An involuntary inpatient **can** hold a 1A (a 1B changes the exam location); an un-examined patient **can** hold a 3B. **Both legitimate — do not "correct" them.**                                              |
| **Other**                   | No edge bars, no top highlight · _discharged_, not released · no two-hour tile · morning board folded into Capacity                                                                                              |

---

# 8 · CLINICALLY LOAD-BEARING — must not be lost

1. 🔴 **The safety caveats must be at least as legible as the figures they qualify.** _"A nought here
   is a measured answer"_, _"breached can never mean a Mental Health Act deadline"_, _"these three
   must never be summed"_ currently render **below** the legibility floor while their figures do not.
2. **"Breached" can never mean a missed Mental Health Act deadline** — `legalForm.dueAt` exists only
   for transport and transfer orders. A heading cannot carry that; a sentence under the table must.
3. **130 bare bed-count chips and triage tiers at 10px** on the network screen — deferred, never
   judged by a clinician for legibility.
4. **The synthetic-prototype disclosure on every screen.** See §4.1③ — several are missing.
5. **Aboriginal cultural safety review: unstarted, and cannot be done by this team.**
6. **Eligibility proof:** the engine enforces it, but no reducer-level test shows a JUDGEMENT gate
   refusing on a pair where only that gate fails.

---

# 9 · HOW THIS WAS MISSED — so it is not repeated

**Every individual claim was true. Nothing was careless.**

| What happened                                                                         | Why nothing caught it                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Built to the drawings' CONTENT, not their DESIGN                                      | No test can see a layout                            |
| A build plan's status lines read as current                                           | They were a day old; work had landed since          |
| A mockup judged from a static snapshot                                                | Its navigation is built by JavaScript and never ran |
| A guard against counting a mention as a use, **built by counting a mention as a use** | It passed its own tests                             |
| A de-duplication that **left a duplicate**                                            | Two paths computing one figure produce no conflict  |
| A check reported clean by an instrument **incapable of detecting the thing**          | Silence reads exactly like a clean result           |

🔴 **NOT ONE AUTHOR FOUND THEIR OWN.** Every one was found by somebody else's instrument. Several had
written the rule down first — one twice, in the same file, hours earlier.

✅ **A WRITTEN DIAGNOSIS DOES NOT SWEEP.** It is not a thing you apply to yourself; it is a thing
somebody else has to run at you.

✅ **A FINDING IS A CLAIM**, and inherits every failure mode a claim has while arriving with the
authority of having been FOUND.

⚠️ **Messages between chats silently fail** — three of eight never arrived while the sender's record
said "sent". **Write handovers into the branch, not the channel.**
