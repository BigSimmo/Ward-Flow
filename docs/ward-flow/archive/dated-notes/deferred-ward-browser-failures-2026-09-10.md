# The ward browser failures — DEFERRED by the owner, and what un-defers them

**Owner ruling, 2026-09-10:** _"send it to Ward Lead and defer fixing for now."_ **Nothing is to be
repaired on this.** Routed here by Ward Builder Two so the deferral has a written home rather than
living in one chat's memory.

⚠️ **A DEFERRAL IS NOT A CLOSURE, AND THIS ONE HAS AN UNANSWERED QUESTION INSIDE IT.** He deferred the
whole item instead of answering the design question in §3. **The question is unanswered, not settled.**

---

## 1 · Provenance — none of this is Ward Lead's or Ward Builder Two's

Every figure is **Ward Verifier's**, from the **first full run of the `chromium-mockups` project**:

    2026-09-10, at 8b4b96fa9c, dev server, workers=1, 10.9 minutes
    171 declared / 171 run -> 151 passed, 15 failed, 5 skipped, Playwright exit 1
    issues inbox  issueUlid 01M258SA9T268WXVRXA18W7J3Z

⚠️ **ONE RUN.** No claim in either direction about stability or flakiness. Repo policy still needs
three reproductions on one SHA before any quarantine. **Ward Builder Two re-read the two referral
spec sites in the tree and did NOT re-run Playwright** — nothing here claims the current tree
matches that run.

---

## 2 · Three ward failures across TWO spec files — not two in one

**Ward Builder Two's own record (`ward-builder-two-complete-record-2026-09-10.md` §11) says _"Two
Playwright failures in `ui-ward-referrals.spec.ts`"_ and they corrected it in the handover.** True
about that one file, and it read as the whole set. **Recorded here in the corrected form so the
narrower sentence does not survive in the relay.**

| #   | Where                            | What                                                                                                                                      |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `ui-ward-referrals.spec.ts:1056` | ~~🔴 four columns off-screen at 641px, expected 1 received 4~~ **RETRACTED TWICE — see §2a.** ONE column, clipped by ~17px, at 641px only |
| 2   | `ui-ward-referrals.spec.ts:414`  | Fixture assertion _"the seed's queued referrals, in the queue's own order"_ — expected 0, received 2                                      |
| 3   | `ui-ward-roles.spec.ts:559`      | `ward-ed-inbox-empty` not found for `peel-ed`                                                                                             |

⚠️ **2 AND 3 LOOK LIKE THE SEED HAVING MOVED UNDER STALE FIXTURES RATHER THAN UI DEFECTS — AND WHICH
SIDE IS RIGHT IS UNCONFIRMED. NOBODY HAS CHECKED.** _"Probably stale fixtures"_ must not harden into
_"not defects"_ in any onward relay. It is the reassuring claim, which is the one to re-check hardest.

### 2a · 🔴 The size of failure 1 was wrong, and so was its cause. Both retracted.

**Retracted 2026-09-10 by Ward Verifier, whose second retraction corrects their own first one.** The
struck-through wording above is kept rather than deleted, because the record of what circulated is
the point — this claim reached Ward Lead, all four builders and the owner before anybody checked it.

| Circulated                                                                                      | Measured                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Four** columns off-screen                                                                     | **ONE** column, clipped by ~17px. `- Expected - 1 / + Received + 4` are diff LINE counts, not column counts. The two received entries are **one column reported twice** — the guard collects `thead th` together with `tbody tr:first-child td`, so "Home region" the heading and "Perth Metropolitan" the cell beneath it have identical geometry |
| "expected 1"                                                                                    | The guard permits **ZERO** — `.toEqual([])` at spec line 1096                                                                                                                                                                                                                                                                                      |
| Broken across the narrow band                                                                   | **641px is the ONLY failing width.** The spec walks 641/700/760/820 and **aborts at the first failure**, so nobody had measured the other three. Re-run without `expect()` at all four: 641px gives 2 entries; 700/760/820 give zero; the decided table gives zero at all four                                                                     |
| "the predictable consequence of an APPROVED change", citing the 2026-09-07 board-columns ruling | 🔴 **WITHDRAWN. It was false and it was never checked.**                                                                                                                                                                                                                                                                                           |

⚠️ **THE POSITIVE CONTROL WAS RUN**: at 641px the re-measurement returned the spec's own two
entries verbatim, including 623 vs 606 — **so the instrument can say yes, and its three zeros carry
information** rather than being the silence of a broken probe.

**Recorded at `10c7414333` (the correction) and `9ed4f03020` (the confirmation run), on
`ward/phone-and-chrome-verify-20260908`. Ledger requests `7235af08`, `03f090b7` and `c8a3914a` are
cancelled in sequence; `297e9dcf` is the row that stands** — all left in the inbox, because requests
are immutable and the trace is meant to survive.

---

### 2b · Failure 2 is diagnosed, and the diagnosis says the SPEC is wrong, not the app

**Ward Verifier, reproduced twice on two SHAs** (`8b4b96fa9c` full suite; `10c7414333` spec only —
5 declared / 3 passed / 2 failed / 0 skipped, exit 1 **read directly rather than through a pipe**).

    spec line 324   SEEDED_QUEUED_IDS   4 ids   RF-001, RF-009, RF-005, RF-011
    the app                             6 ids   RF-001, RF-009, RF-005, RF-015, RF-014, RF-011

**`RF-015` and `RF-014` entered the seed at `f51f7d3639` (2026-09-07), owner-authorised** — _"add a
couple"_ — as the two ED **expects**; without them the Expects list renders empty on every
department. That commit updated `tests/ward-referral-model.test.ts` and **not** the browser spec, so
the unit pin at its line 1225 already holds the same six in the same order. **The seed and the unit
pin agree with each other; only the browser spec disagrees.** `f51f7d3639` is an ancestor of the
master line — checked with `merge-base --is-ancestor` against a known-folded control.

⚠️ **THIRD INSTANCE OF A HAZARD THE SPEC DOCUMENTS AGAINST ITSELF.** Its doc comment requires
the set to hold **every** seeded queued referral, _"not merely enough of them"_, and the comment
directly below it records `RF-011` doing exactly this on 2026-09-03.

**And the second reader Ward Verifier flagged as unchecked — I checked it rather than inheriting it
as done.** Spec line 743 is `queuedCardIds(page).find((id) => !SEEDED_QUEUED_IDS.has(id))`, used to
pick out the referral the spec itself raised. With the stale four-id set, `RF-015` counts as "not
seeded", **so that line can select a seeded card instead of the raised one**, and the assertion
beneath it would be about the wrong card. **Extending the set makes that line correct rather than
riskier** — which is what Ward Verifier suspected and correctly declined to claim.

🔴 **AND IT IS STILL NOT BEING FIXED. A DIAGNOSIS IS NOT PERMISSION.** The owner deferred
this whole item. Whoever un-defers it: extend `SEEDED_QUEUED_IDS` to the model pin's six in that
order, then **run it** — nobody has run the spec with the set extended, so no fix here is proven.

---

## 3 · Failure 1 puts a design question to the owner — and the framing it arrived in was wrong

⚠️ 🔴 **READ §2a FIRST. THE CAUSAL STORY IN THIS SECTION IS WITHDRAWN, AND SO IS THE SIZE.**
This section is where anyone routing failure 1 lands, because of its heading — so the withdrawn
wording is struck through **here as well as in §2a**, rather than left reading as current. An
unmarked second copy is exactly how a retraction fails to travel. **The question at the end of this
section survives the retraction unchanged.**

`docs/ward-flow/design/owner-ruling-2026-09-07-board-columns.md` **approved five new columns** —
Presentation, Review status, Plan, Bed number, Legal form expiry. **The ruling approved the columns;
nobody ruled on their reachability at narrow widths.** ~~The four now off-screen are the predictable
consequence of an approved change.~~ 🔴 **WITHDRAWN, BOTH HALVES — see §2a.** It is
**ONE** column, clipped by ~17px, at **641px only**; and the causal claim was **false and was never
checked**.

**The guard was written for this exact defect, on this exact board, after it survived a design pass
once already.** Columns present in the DOM and unreachable on screen is precisely what it exists to
catch.

⚠️ **THE QUESTION SURVIVES THE RETRACTION ANYWAY.** One column clipped by 17px at a
single width is a far smaller thing than four columns gone — but the choice it puts to him is the
same choice, and it is still his.

**The question he deferred rather than answered — at narrow widths, either:**

1. **drop or stack** the five approved columns, or
2. **accept sideways scrolling** and make the table **visibly show that it scrolls**.

**Nobody may pick one of these as part of a repair.** It is his.

---

## 4 · What un-defers this

A deferral conditioned on nothing has nobody to lift it. **This one lifts when any of these becomes
true:**

- **He answers the §3 question** — then failure 1 becomes ordinary work.
- **Ward Flow moves towards a real coordinator using it.** A column a coordinator cannot see is a
  clinical-safety item, not a layout nit, the moment the data is real.
- **Anyone touches the queued board's columns again** — the same guard will red and whoever hits it
  needs to find this page rather than re-derive it.

---

## 5 · Two things unrouted, and neither is deferred by that ruling

- 🔴 **Twelve of the fifteen failures are OUTSIDE Ward Flow and have no owner yet:**
  `ui-caring-contact-mockup` (4), `ui-tools-collapse` (3), `ui-tools-task-directory` (2),
  `ui-sidebar-live-mockup` (2), `ui-answer-chat-perfected-mockup` (1). **The owner's deferral was
  about the ward failures. It does not cover these, and nothing should read it as covering them.**
- **Six of twelve ward browser specs sample no width at all in the 641–1000px band** — the band a
  scroll threshold does its damage in. See `WARD-LEAD-HANDOVER-2026-09-10.md` §12 for the per-spec
  measurement and for the fact that **the first measurement of it was itself wrong in the same shape
  as the thing it measured.**

⚠️ **AND THIS SUITE IS SELECTED BY NEITHER `verify:ui` PATH.** `test:e2e:pr` takes `--project=chromium`
plus the seeded project and grep-inverts `@mockup`. **So these failures may be weeks old. Nothing here
asserts a recent regression, and nobody has bisected.**
