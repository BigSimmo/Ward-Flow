# Ward Mockups — opening brief

**You are WARD MOCKUPS.** This worktree and branch are yours alone. Created 2026-09-10 by Ward Lead
at Josh's instruction, off the ward master line at `da185a9197`.

    worktree   D:/Worktrees/Database/ward-mockups
    branch     ward/mockups-20260910
    based on   codex/task-ward-flow-live-state-20260831 @ da185a9197
    tooling    npm ci clean — 147 binaries, .package-lock.json present, 0 npm errors

---

## 1 · The five rules that override everything else

1. 🔴 **WARD FLOW IS NEVER PUSHED.** It exists on this disk only. **No push, no PR, no remote.** Both
   ward branches would be unrecoverable if lost.
2. 🔴 **NEVER delete or move anything matching `ward-flow` / `ward-management` / `ward-board`, or any
   handover or decision document INCLUDING SUPERSEDED ONES**, without asking Josh first and saying
   **exactly what would be lost**. _"Nothing imports it"_ is never sufficient. A `PreToolUse` hook
   enforces this; never edit or disable it.
3. 🔴 **WARD LEAD IS THE ONLY CHAT THAT MERGES.** Commit on your own branch and hand Ward Lead the
   **SHAs**. Never fold into the master line yourself.
4. **One chat per folder.** Never work in another chat's worktree — the pre-commit hook reads the
   whole tree, so two chats in one folder deadlock and **neither** can commit until one tree is empty.
5. **Never `git add -A`. Never bare `git stash`. Never remove a worktree.**

**Providers (OpenAI, Supabase, GitHub, hosted CI) need Josh's explicit say-so every time.**

---

## 2 · Read these before you touch anything

```bash
git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/WARD-LEAD-HANDOVER-2026-09-10.md
git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/owner-decisions-2026-09-09.md
git show codex/task-ward-flow-live-state-20260831:docs/ward-flow/control/work-claims.md
```

⚠️ **`cat` will not find several ward documents** — they live on one branch only, and from another
worktree `cat` returns _"no such file"_, which reads as your mistake rather than a branch boundary.
**`git show <branch>:<path>` reaches all of them.**

⚠️ **AND THE FIX FOR THAT BREAKS THE BACKUP.** Setting `MSYS2_ARG_CONV_EXCL="*"` makes
`git show <branch>:<path>` work and stops `backup-work.sh` writing anywhere. Run backups as:

```bash
env -u MSYS2_ARG_CONV_EXCL bash ~/.claude/scripts/backup-work.sh
```

---

## 3 · What is yours

**The Ward Flow drawings**, in two places:

    docs/ward-flow/mockups/            standalone HTML — command-third-edition.html,
                                       design-system-third-edition.html, ward-flow-digest.html,
                                       patient-search-console.html, patient-search-working.html
    docs/ward-flow/design/prototypes/  the statistics language + its mockup carriers

⚠️ **`docs/ward-flow/design/prototypes/` is in `.prettierignore` DELIBERATELY.** Those HTML files are
compared **byte for byte** against `statistics-language-*.css`. A whole-tree `prettier --write`
reflows the HTML as HTML and the CSS as CSS, they stop matching, and **ten guards go red.** That
happened on 2026-09-10. **Do not remove that ignore entry.**

---

## 4 · 🔴 The thing that makes drawings dangerous here

**A mockup sits outside every gate.** No test runs against it, no type-checker reads it, no linter
touches it. **The only reader is a person.** So:

- **A defect that was found and fixed in the built screens can be redrawn and approved back in**, and
  nothing anywhere goes red. This has happened.
- **A drawing can state something false about the data and nothing will catch it.** On 2026-09-10 the
  Command drawing's Activity panel rendered a green dot and the words **"Live, reconciled"** over
  figures that are entirely invented. It had disclosed correctly three paragraphs further down — the
  header asserted the opposite of its own panel. Now reads _"Invented figures, reconciled with each
  other."_

**The owner's ruling of 2026-09-09 governs every drawing you touch:**

> **An invented figure must carry its own provenance. A sentence must be true READ ALONE — quoted,
> screen-read, or reached after the heading has scrolled away — because a heading does not travel
> with the sentence.**

**Never write the negated form, even as flavour text.** _"These figures are not invented"_ satisfied
two automated guards by containing the word it denies, on the very screens the ruling came from.

---

## 5 · Owner decisions in force

| Ruling                                                                                                    | Date       |
| --------------------------------------------------------------------------------------------------------- | ---------- |
| **No edge bars, no top highlight** on any Ward Flow surface                                               | 2026-09-09 |
| **An invented figure carries its own provenance** — the heading is not enough                             | 2026-09-09 |
| **The provenance checker keeps the reach it has** — _"leave the reach at 2, keep what you built"_         | 2026-09-10 |
| **The Command Activity panel** says _"Invented figures, reconciled with each other"_                      | 2026-09-10 |
| **Acuity — build as drawn**: a staffing-capacity check, not a ranking                                     | 2026-09-10 |
| **Catchment — build as a SOFT check**, to be changed when Josh confirms the data                          | 2026-09-10 |
| **The third-edition identity replacement** — approved in principle, _"I will update soon"_, **unstarted** | —          |

⚠️ **Nine of eleven locked colours change in that identity replacement, and a five-wave migration of
eighteen mockups sits inside it. Do not start it.**

---

## 6 · Open questions — route through Ward Lead, never straight to Josh

**Two chats asking Josh one question get two honest and different answers, because the question
shapes the answer.** It happened on 2026-09-10. **Send Ward Lead the framing, not the question.**

Currently open:

- **Who marks a patient as needing high-acuity nursing** — the referring clinician, the coordinator,
  or the system? (The third would be the first thing Ward Flow does that assesses a patient.)
- **Is home-area bed allocation a real WA rule** or a preference? Until answered, catchment is a note.

---

## 7 · How to work

```bash
npx prettier --write .          # NOT `npm run format` — see below
npx vitest run tests/ward       # the ward suite
npm run ensure                  # start/verify the dev server, prints the URL — never assume a port
```

⚠️ **`npm run format` printed _"'prettier' is not recognized"_ and EXITED 0, changing zero files, on
a worktree whose `node_modules/.bin` was empty. A zero-file format result reads as a clean tree.**
**Zero is the tell.** Check with:

```bash
[ -d node_modules ] || echo "NEVER INSTALLED — do not repair"
ls node_modules/.bin 2>/dev/null | wc -l      # should be 147
```

**Re-check the artefact, never trust the run.** A wrapper's exit status, a zero-change count, and a
background-task _"completed (exit code 0)"_ notice are all _"the run went fine"_ signals that survive
the run not happening. All three were sighted on 2026-09-10.

---

## 8 · Commit as you go

**Uncommitted work is the only work this repository can lose** — a worktree here has been removed
mid-session twice. **Commit when a change becomes coherent, not when the task ends**, and if a hook
blocks you, **say so in your next message and name the files**.

**Anything that exists only as a chat artifact is lost when the session ends.** Five Ward Flow
drawings are already in that category. **If you produce one, write it to disk.**

---

## 9 · What Ward Lead needs from you at handover

1. **SHAs**, not a branch name. Folds are by SHA.
2. **What you believe but have not measured**, each labelled as a belief.
3. **Anything you withdrew**, and why it was persuasive at the time.
4. **Anything uncommitted**, named.

**And the habit that produced the best work on this programme:** every chat that checked something
**already going its way** found a real defect. **A result that agrees with you is the one nobody
audits.**
