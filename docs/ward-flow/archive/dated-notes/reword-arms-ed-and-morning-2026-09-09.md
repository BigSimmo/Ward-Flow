# Reword arms — the ED files and morning-page, 2026-09-09

Ward Builder Four. Branch `ward/reword-arms-long-tail-20260909`, cut from the master line at
`9744451ba6` (confirmed at the moment of cutting; two other SHAs were in circulation and both were
stale). Worktree `D:/Worktrees/Database/ward-builder-four`. Never pushed.

**Every arm was run on the REAL component and restored from a pristine copy held outside the
worktree, verified with `cmp` rather than a hash.**

---

## Result: 4 of 4 measurable sites were defective. None was sound.

| site          | file                     | defect                                                   | fixed |
| ------------- | ------------------------ | -------------------------------------------------------- | ----- |
| 213           | `ward-ed-screen`         | **too narrow** — reddened on an honest reword            | ✅    |
| 864           | `ward-ed-psychiatry-hub` | **too broad, both directions**                           | ✅    |
| 1084          | `ward-ed-psychiatry-hub` | **too broad** — scope deletable, guard green             | ✅    |
| 1758          | `ward-ed-psychiatry-hub` | **too broad, both directions** — the weakest of the four | ✅    |
| 460, 489, 604 | `ward-morning-page`      | **INERT — cannot be measured at all**                    | n/a   |

---

## 🔴 The general form, which is worth more than the four incidents

**`expectSays` is `some(spelling => text.includes(spelling))`, so the WEAKEST spelling sets the
guard's entire strength.** Every failure below is one instance of that.

A spelling that does not independently imply the whole claim admits a counterexample:

| spelling shape                              | what it cannot see       | measured counterexample                                                    |
| ------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| subject-free (`"not recorded"`, `"only"`)   | the subject changing     | `"Referral time not recorded"` satisfied a guard about **acceptance**      |
| absence-free (`"acceptance"`, `"referral"`) | the absence disappearing | `"referral time 14:20"` satisfied a guard about the time being **missing** |

**Both halves were present in two of the four sites, in opposite directions**, so those rows could
have stated a different clock's claim, or the exact opposite of their own, and stayed green. Only
deleting the line altogether reddened them.

⚠️ **A TIGHT QUERY DOES NOT RESCUE A SUBJECT-FREE SPELLING, AND I ASSUMED IT WOULD.** At site 213 I
reasoned that reading one row with `data-kind="examination"` asserted a line above meant `"not
recorded"` could not be satisfied by a bystander. **Measured anyway: `"Decline not recorded."`
written into that same element passed 25 of 25.** The defect can be written INTO the element the
query already trusts. My first repair introduced the defect it was fixing.

**Tolerance is bought by listing more FULL spellings, never by listing a fragment of one.**

---

## The arms, and why four are not enough

The standing method asks for reword + break. **That pair cannot see the defect above**, because a
break arm deletes the line and every spelling fails together.

| arm             | mutation                           | what it proves                     |
| --------------- | ---------------------------------- | ---------------------------------- |
| A untouched     | —                                  | the site executes at all           |
| B reword        | claim intact, wording changed      | not too narrow                     |
| C break         | the claim deleted                  | it protects something              |
| **D bystander** | **wrong subject, spelling kept**   | **not satisfiable by a neighbour** |
| **E hollow**    | **right subject, absence removed** | **the claim, not just its topic**  |

**D and E are the arms that found all three too-broad sites**, and D caught my own bad repair. C
passed on every site both before and after the fix, so a run of A/B/C would have recorded three
defective guards as sound.

---

## ⚠️ `ward-morning-page` is inert, and it is counted in every population figure in circulation

`tests/ward-morning-page.dom.test.tsx:112` is `describe.skip("MorningPage", …)` — one skip over the
whole file, from the owner's 2026-09-06 retirement of eleven unreachable screens.

    npx vitest run tests/ward-morning-page.dom.test.tsx
      Test Files  1 skipped (1)
      Tests       20 skipped (20)

**Its three `expectSays` sites execute never.** They are green, they are counted in the site totals,
and **no arm can be run on them** — a mutation returns green having proved nothing.

🔴 **Recorded as UNMEASURABLE, not as sound and not as outstanding**, because those three states are
the same shape in a count and only this sentence separates them. Ward Builder Two flagged this before
I spent a run discovering it.

---

## What I did not do

- **Nothing outside these three files.** The other eleven of the original eighteen are Ward Builder
  Two's and were finished (57 of 57) before I was dispatched; the statistics screens are dropped by
  the owner's instruction, relayed and awaiting his direct confirmation.
- **No ban was touched, because there is none in these three files** — verified,
  `expectNeverSaysAgain` count is 0 in all three. The standing repair rule is inverted for bans
  (narrowing a ban weakens it while every arm still passes), so this document is **not** a precedent
  for one.
- **Not pushed.** Master tip moved to `8040c71e46` during the work; merge rather than rebase.
