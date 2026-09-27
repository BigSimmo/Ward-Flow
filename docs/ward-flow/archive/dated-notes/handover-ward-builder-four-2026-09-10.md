# Ward Builder Four — handover, 2026-09-10

Worktree `D:/Worktrees/Database/ward-builder-four`, branch
`ward/invented-figure-markers-20260909` @ `3fa6a1ebfb`. **Tree clean, nothing uncommitted, nothing
pushed.** Handing over to Ward Lead and standing down.

---

## 1. What I own, and its state

**One guard, `tests/ward-provenance-sentences-carry-their-own-marker.test.ts`** — the owner's
2026-09-09 ruling that _every sentence disclosing an invented figure must be true read alone_.
**Folded by Ward Lead at `4a35634f96`; 8 of 8 green; I am off the file.**

| commit       | what                                                             | folded            |
| ------------ | ---------------------------------------------------------------- | ----------------- |
| `a61a63fe90` | the predicate becomes **claims, not topic words**                | ✅                |
| `f533667000` | the anti-vacuity floor becomes a **relative invariant**          | ✅                |
| `e953a12f3e` | the scan reads **every `<p>`**, not only the first               | ✅                |
| `bcf5bb684b` | the guard states its own **reach** and the 14 unexamined screens | ✅                |
| `50b1d3aab9` | the **five mutation arms**, with the before/after control        | ✅                |
| `c53bd98a22` | the measurement that started it                                  | ✅                |
| `c8105fdff8` | ledger request — the statistics predicate defect                 | 🔴 **NOT folded** |
| `3fa6a1ebfb` | ledger request — the residual holes                              | 🔴 **NOT folded** |

⚠️ **The last two are the only thing outstanding from me.** They are inbox JSON only, merge-safe,
and need `npm run issues:reconcile` on a dedicated branch — never in a product PR.

## 2. The finding worth carrying forward

**A substring test has no polarity.** The predicate accepted _"These figures are **not** invented —
they are the current state of the network"_ **by containing the word it denies.** Not a loose
setting: an inverted one, certifying the exact claim the ruling forbids.

**The fix is shape, not length.** Bind the disclosing word to its verb (`are invented`) or its noun
(`invented figures`) so a negator lands _inside_ the phrase and breaks the match. **Never a bare
word** — `prototype` alone carried none of the corpus and admitted three defects.

🔴 **And the trade everybody predicts does not exist.** The word list was defended as tolerance for
honest rewording; narrowing was priced at 6 → 11 honest sentences reddened. **Claim shapes cost
neither: 0 of 5 real sentences, 0 of 9 honest rewords, 0 of 18 defects.** The tolerance was never in
the bare words — it is in the verb list. **Do not re-open that argument from memory.**

## 3. Proof, so nobody re-derives it

Five arms on the real component, pristine copy outside the worktree, `cmp` after each —
`docs/ward-flow/provenance-guard-arms-2026-09-10.md`:

| arm                               | old guard          | now                              |
| --------------------------------- | ------------------ | -------------------------------- |
| bare figure in the first `<p>`    | RED                | RED                              |
| same figure in a **second `<p>`** | **GREEN**          | RED                              |
| prose in `<span>`                 | RED _on the floor_ | RED **on the rule, block named** |
| the disclosure **negated**        | **GREEN**          | RED                              |
| **semicolon** bystander           | **GREEN**          | RED                              |

## 4. 🔴 Limits — quote these with the guard, never the guard alone

- **Reach is 2 files of 76.** The statistics DOM guard covers the footnotes by a different
  mechanism; **everything else is unguarded by either.** The two are complementary — **neither is a
  duplicate of the other and neither should be deleted as one.**
- **Fourteen screens are UNEXAMINED, not compliant.** Unexamined, compliant-and-guarded,
  compliant-but-unguarded and defective are identical in a count.
- **`RETRACTED` is a list, not a shape**, and incomplete by construction. Labelled as such in the file.
- **A colon, an `and` and a comma each hide a bystander inside one clause** — shared with the
  statistics helper, and I do not believe they are fixable: splitting on them shreds honest prose.
  **Document, do not chase.** My own limits section names the colon and omits its siblings; that
  omission is mine and is queued in the ledger.

## 5. Owner decision, 2026-09-09/10

> **"leave the reach at 2, keep what you built"**

Recorded by Ward Lead at `2529b59e5d`, `owner-decisions-2026-09-09.md` §3.
⚠️ **Its true statement has a false implication:** it does **not** cancel the statistics repair,
which fixes a guard that certified a denial. Both hold at once.

## 6. Method notes that cost real time to learn

- **A quoted bash heredoc halves doubled backslashes.** A regex written that way reached Node as
  backspace characters and reddened everything, reporting a confident answer to no question. **Write
  regex-bearing scripts with a file tool.**
- **Mutate additively.** Replacing a paragraph shrank the corpus and tripped the floor as well as the
  rule — a red with two causes cannot say which caught the defect.
- **Verify a peer's fix claim**, especially one that confirms your own findings and praises them.
  Ward Builder Two's repair held; probing its _design_ then found five more.
- **Route owner questions through Ward Lead.** I asked Josh a question Ward Lead had already asked.
  Two chats, one question, two honest answers, and no way afterwards to tell which governs.
