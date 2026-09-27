# The provenance guard's five arms, run after the repair — 2026-09-10

Ward Builder Four, worktree `D:/Worktrees/Database/ward-builder-four`, branch
`ward/invented-figure-markers-20260909`. Never pushed.

**Every arm ran on the real component** (`src/components/ward-management/hub/hub-screen.tsx`,
54,163 bytes), **restored from a pristine copy held outside the worktree and verified with `cmp`
after each one** — not with a hash, which normalises line endings and can certify a restore that
did not happen.

Ward Lead's instruction was to re-run their three arms myself rather than take them, and to add the
two this exchange earned. All five are below with a **before/after control**, because a red on the
repaired guard proves the guard fires — it does not prove the hole was ever open.

---

## The result

| arm   | mutation                                                                              | guard at `870bcaccb3` | guard now                          |
| ----- | ------------------------------------------------------------------------------------- | --------------------- | ---------------------------------- |
| **A** | bare figure as the first sentence **inside** the first `<p>`                          | RED                   | **RED**                            |
| **B** | the same figure in a **second `<p>`** under the same heading                          | 🔴 **GREEN**          | **RED**                            |
| **C** | the block's prose wrapped in `<span>` instead of `<p>`                                | RED — _on the floor_  | **RED — on the rule, block named** |
| **D** | the disclosure **negated**: _"are not invented — they are the current state"_         | 🔴 **GREEN**          | **RED**                            |
| **E** | **semicolon bystander**: _"names are invented; there were 28 referrals this period."_ | 🔴 **GREEN**          | **RED**                            |

**Three holes were open and are now closed. One arm was already working. One changed the REASON it
reddens, which is the whole point of it.**

Each red names the offending sentence and no other:

```
hub/hub-screen.tsx · under "What is invented" · There were 28 referrals this period.
hub/hub-screen.tsx · under "What is invented" · These figures are not invented — they are the
                                                current state of the network this morning.
hub/hub-screen.tsx · under "What is invented" · The community team names are invented; there
                                                were 28 referrals this period.
```

---

## 🔴 Arm C is the one to read twice, and it is why the floor changed

**Before:** `paragraphAfter` returned null, the block stopped being scanned, `blocks` fell 3 → 2,
and a constant floor of `>= 3` went red. **That looks like the floor working and is not** — it is a
count crossing a constant. Ward Lead's warning, which generalises past this file: _add a fourth
provenance block and the identical mutation takes 4 → 3 and passes in silence. A constant floor
catches only the LAST unit that stops being measured._

**Now:** the walk counts headings **upstream** of the paragraph scan, so a heading that yields no
paragraph is reported **by name**:

```
✗ scans every provenance heading it finds — a block that goes dark is named, not absorbed
    hub/hub-screen.tsx · "What is invented"
```

That is detection rather than arithmetic, and it holds at any population size.

⚠️ **The constant floor on the heading walk itself is KEPT and is still the indicted shape.** The
heading walk is the outermost population; there is nothing upstream of it to be relative against.
**This does not close the floor problem generally** — every other anti-vacuity floor in this
programme is still a constant.

---

## ⚠️ A correction to my own first run of arms D and E

My first pass mutated by **replacing** the paragraph, which shrank the corpus from five sentences to
one and tripped the constant floor as well as the rule. **Two failures, one of them collateral.**
A red with two causes cannot say which one caught the defect.

Re-run **additively** — the honest sentences left in place, the defect appended — both give a clean
single-cause red naming exactly the injected sentence. **Only the additive run is evidence**, and
the first is recorded here because a discarded arm that nobody mentions looks like an arm that was
never run.

---

## What the arms do not prove

- **Not that `MARKER` is complete.** It is proved against 5 real sentences, 9 honest rewords and 18
  constructed defects. That is far past the four strings it had, and it is still a corpus somebody
  wrote.
- **Not that the retraction list is complete.** `RETRACTED` (_"any more"_, _"no longer"_, _"until
  recently"_, …) **is a list, not a shape, and is incomplete by construction.** It is labelled as
  such in the file. A sentence that withdraws its disclosure some other way still passes.
- **Not that a colon is safe.** Splitting clauses on `:` reddens a real compliant sentence in
  `hub-screen.tsx`, so it is deliberately not a boundary — which leaves a real hole:
  _"The names are invented: there were 28 referrals."_ passes. Stated, not hidden.
- 🔴 **Not that the ward screens are compliant.** The guard reaches **2 files of 76**. Fourteen
  screens are **UNEXAMINED, not compliant**.
