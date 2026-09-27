# A ratchet that has stopped ratcheting — proposal, 2026-09-06

**Status: RULED AND BUILT, 2026-09-06.** Ward Lead accepted `measured` + exact equality and rejected
their own scope-by-touched-files design; the ratchet in `tests/ward-status-colour-reach.test.ts` now
implements it. This document is kept as the argument, including the rejected design, because the
reason a design was rejected is the part that stops it being re-proposed.

Ward Lead asked for a design that makes a ratchet fail on _slack_ — a recorded ceiling sitting above
the measured count — scoped to the files a change touched, so it never fires on unrelated work.

**I am proposing something different, and this document argues against the scoped-by-touch version I
was asked for.** The property Ward Lead identified is right and worth closing. The scoping mechanism
is what I think is wrong, and there is a simpler one that removes the objection it was invented to
answer.

---

## 1. The failure message, written first

Ward Lead's instruction was that the message decides whether the gate survives, so it is written
before the logic and the logic is built to make it true.

```
  patients/add-patient.module.css measures 5, and its record says 8.
      You have improved this file. Record the new number:
        { file: "patients/add-patient.module.css", measured: 5, because: "..." }
      This is bookkeeping, not a fault. The record exists so the next person knows what
      is genuinely left here rather than inheriting a number nobody has re-derived.
```

That is the message as built, copied from the gate rather than paraphrased. It never says the file
is wrong, because the file is better. It states the measured figure, the recorded figure, and the
exact edit. **A gate whose message reads like an accusation on good work
gets widened; one that reads like bookkeeping gets obeyed.**

---

## 2. What is actually broken

`tests/ward-status-colour-reach.test.ts` records a per-file ceiling and fails when a file exceeds it.
It cannot fail when a file sits **below** it. So a ceiling held during someone else's work stays at
its held value forever after that work lands, and nothing reports it.

**Measured, not argued.** On 2026-09-06 three files carried 8, 7 and 2 after Ward Builder Four's work
had cleared all three to zero. Two genuine regressions were added to one of them and the suite
reported `3 passed`. **Seventeen clinical status colours could have lost their high-contrast handling
with nothing reported.** Fixed in `e712aca7c`; the mechanism that let it happen is not.

This is the same defect as an expected-red that has quietly stopped failing — which the reds gate
_does_ catch, by design, and this one does not.

---

## 3. Why I am not proposing scope-by-touched-files

The brief was: fail on slack, but only for files the change touched, so an unrelated improvement
elsewhere never blocks anybody. The reasoning is sound. **The implementation is where it breaks, and
it breaks into exactly the failure class we are trying to close.**

A vitest run has no legitimate notion of "the change". To get one it must read git — a base ref, a
diff, a fetch depth. That gives three bad outcomes:

- **On a full run of `main` there is no diff at all.** The slack check then does nothing, forever, in
  the one run everybody trusts. **A gate that silently no-ops under the most common invocation is the
  thing this proposal exists to abolish.**
- **In CI the answer depends on checkout depth**, so the check can pass because history was shallow
  rather than because the estate is clean. That is a green with no meaning.
- **The same test gives different verdicts in different environments**, which makes every future
  disagreement about it unresolvable.

⚠️ **The rule would only ever be wrong in silence — the property it was written to enforce.**

---

## 4. What I propose instead: record the measurement, not a permit

**Replace `ceiling: N` with `measured: N` and require exact equality.** Unlisted files keep their
implicit zero and behave exactly as today.

**This removes the objection that scope-by-touch was invented to answer, because slack can no longer
accumulate.** A number that must equal the measured count is never stale, so nobody can ever inherit
somebody else's staleness. Ward Lead's question — _what happens when a file is touched and the slack
is not the toucher's doing_ — **dissolves rather than being answered**: the only way to meet a
mismatch is to have changed the count yourself, in the change that changed it.

⚠️ **And it cannot be defeated by loosening, which a ceiling can.** Raising a ceiling hides new debt
and looks like maintenance. With an exact record there is nothing to loosen: **the only edit that
turns it green is writing the true number**, which is precisely the action we want. The gate has no
weak setting.

**It costs nothing to adopt today.** All five recorded entries already equal their measured counts —
`ward-tokens.module.css` 6, and the four others 0 — so the rule fires on nobody at the moment it
lands. There are 51 ward stylesheets and 5 records, so the surface that can ever produce this work is
one file in ten, and the work is one line.

**What it does cost, stated plainly:** anyone who changes the count in one of those files, in either
direction and for any reason including an unrelated refactor, must also update one line. That is a
real tax and I am not pretending otherwise. It is the smallest one I can find that still makes the
record unable to be wrong in silence.

---

## 4a. Coverage — proven by a count of files, never by a green suite

⚠️ **Ward Verifier's condition, and it is not negotiable: the success criterion is a COUNT OF FILES
in which a planted regression turned the gate red.** Never _"the records are exact and the suite is
green"_. **A blind parser plus perfect records is the most convincing green this gate could produce
and the least informative.**

**Measured 2026-09-06, after the exact-equality change:**

    files planted:               51
    gate went red AND named it:  51
    gate did not name it:         0
    restore mismatches:           0

**"Named it" is doing real work in that number.** The check was not merely that the suite failed —
it was that the gate's own output carried the line `<file> measures N, and its record says M`, so
the planted use was **counted**, not just coincidentally present while something else failed. Each
file was restored from `git show HEAD:` and its blob hash compared before moving on.

⚠️ **Three limits, stated rather than glossed, because each of them is a way this 51/51 could be
narrower than it sounds:**

1. **THE CLEAN ESTATE IS PARTLY HELD UP BY THE FORMAT GATE, NOT BY THIS ONE.** The parser missed any
   `var()` with leading whitespace — `var( --danger-text)` was invisible, `var(--danger-text )` was
   found — and the reason there were zero live instances is that **Prettier rewrites both the spaced
   and the multi-line form back to `var(--x)`**, confirmed by running it. The hole is now fixed, so
   nothing is hidden today. But `SKIP_FORMAT_GUARD=1` exists and `AGENTS.md` records that an agent
   pushing from its own environment bypasses the pre-push hook entirely. **A gate whose coverage
   rests on another gate with a documented bypass must say so, or the next person reads 51/51 as
   unconditional.**
2. **IT SCORES EACH FILE'S OWN TEXT AND FOLLOWS NO `composes:`.** Ward CSS has **92** of them.
   _"Zero uses in this file"_ and _"no class here renders a raw status colour"_ are different claims
   and this gate only makes the first. Measured on the recorded files: add-patient 0, person 0,
   ed 1 — and ed's is `wardTokens`, the bridge — **so the limit does not bite on anything recorded**,
   but it is a real edge and it is written down rather than discovered in six weeks.
3. **COVERAGE IS OVER SHAPES, NOT OVER THE LANGUAGE.** `var()` inside `calc()`, inside a
   custom-property definition, and behind `@supports` are untested. **The honest claim is "51 of 51
   files, on the shapes tested" — never "the parser is sound".**

## 5. Anti-vacuity, in the shape Ward Lead asked for

The instrument must **refuse to answer** rather than answer a different question. The measuring script
used throughout this work reproduces a committed fixture with a known answer — prose mentioning a
token, a live reaching use, an aliased use, and a token hidden in a nested fallback — and exits
non-zero without printing if it does not match. That shape carries over:

- Floor the **population walked** and the **windows/uses actually examined**, never the findings. A
  scanner that reads nothing reports a clean estate.
- Keep a control in both directions: a synthetic violation must be **found**, and the legitimate
  idiom next to it must **not** fire.
- When a record is dropped or its number changed, the commit must show the control re-run, not merely
  the count falling. **A falling count and a detector that stopped detecting produce the same
  output.**

---

## 6. The general form, which is bigger than this gate

Ward Lead's framing: _the problem is not one gate, it is every record that can only be wrong in
silence._ Evidence found while writing this, in `docs/ward-flow/parked-debt-2026-09-04.md`:

| Record                 | Says                             | Actually                             |
| ---------------------- | -------------------------------- | ------------------------------------ |
| `--text-link`          | `ward.module.css:126`            | `:143`                               |
| `--focus-ring`         | `board.module.css:587,1048,1307` | `:599,1060,1319`                     |
| `--success-bg-hover`   | `:646` → `var(--success-bg)`     | `:672` → `var(--ward-success-soft)`  |
| `--ward-surface-hover` | `modes.module.css:524`           | `:525`                               |
| `--wd-tap-target`      | `ward.module.css:124`            | **not present anywhere in the code** |

**Five of five wrong.** The last is the table's loudest entry — a bold warning with a measured on-page
claim — and the debt it describes was fixed in `98f758e27`. It is still carried as open in three
documents, one of them an unchecked task box reading _"Step 4: Fix `--wd-tap-target`"_. Somebody
working that plan goes looking for a declaration that is not there.

**The generalisable rule: a record that names a code location must be checkable against the code, and
the check must be able to fail.** A line number in prose is a claim with no gate. The cheapest version
is not a line number at all — name the symbol and let a test assert the symbol's presence or absence,
so the record breaks loudly when the code moves instead of drifting quietly.

⚠️ **That file is a dated snapshot of one night's measurements, so its rows must not be corrected in
place** — that would falsify the record rather than update it. It needs a ruling: a dated status
column, or a superseding register that is gated. **I have not touched it.**

---

## 7. What I am asking for

1. **Rule on `measured` + exact equality replacing `ceiling`**, and on my argument against
   scope-by-touched-files. If you still want the scoped version, say so and I will build it — but I
   would want the silent-no-op-on-`main` problem answered first, because I do not know how to.
2. **Rule on the parked-debt register**: dated status column, superseding gated register, or leave.
3. The `-border` family — 68 uses, 25 files, no alias — is now known to be this exact failure mode
   live in four places. That needs the owner, not us.
