# The 69-request backlog: what is still true, measured before applying any of it

**Ward Verifier, 2026-09-12, at the owner's instruction — _"check against the current state to
ensure many of these are not stale and already fixed or no longer relevant."_**

**Method: four agents (Sonnet, extraction — the catcher is the cited code condition), each given six
records, every claim checked against the ward line at `57ca0ed793` and NEVER against this worktree,
which is 181 commits behind. Three chats produced false "still broken" answers from that exact
mistake today.** ✅ **Every agent was required to report a CONTROL — a search that DID find
something — so an absence could not be a broken probe. All four did.**

---

## THE POPULATION IS NOT 69 NEW ISSUES

    add      24     ← the only ones that can be stale; all 24 triaged below
    done     31     bookkeeping: closures of issues already resolved
    cancel   10     withdrawals
    update    4     amendments
    ------------
    total    69

---

## THE 24, RECONCILED

    STILL-OUTSTANDING   11      the condition still holds, decisive line quoted
    APPEARS-FIXED        7      no longer holds; fix commit named and spot-checked
    OWNER-BLOCKED        3      no code change settles it — the owner decides
    CANNOT-TELL          3      needs hosted-CI or live-site access nobody here has
    -----------------------
                        24      ✅ reconciles

🔴 **SEVEN OF TWENTY-FOUR — 29% — would have been created as open issues describing work already
done.** ✅ **Each fix commit was named by the agent and re-checked by me against the line.**

---

## 🔴 THE FOUR-RECORD CLUSTER — one event, four records, two carrying a FALSE count

**`03f090b7` · `7235af08` · `297e9dcf` · `c8a3914a` all describe ONE run of the ward mockups suite,
all created 2026-09-10, each with its own issue identifier.**

⚠️ **Applied as recorded they create FOUR issues for one event.** 🔴 **And two of them state a figure
that a third explicitly retracts. `297e9dcf` carries the correction in its own text:**

> _"COUNT CORRECTION, CARRIED SO IT CANNOT BE RE-ASSERTED: two earlier versions of this row
> (7235af08, 03f090b7) said the guard 'permits one such entry and found four'. BOTH HALVES ARE
> FALSE. The assertion is `.toEqual([])` — it permits ZERO. The received array holds TWO entries,
> not four: `- Expected - 1 / + Received + 4` are counts of DIFF LINES."_

🔴 **A count of DIFF LINES read as a count of DEFECTS.** ✅ **`297e9dcf` is the accurate account and
is the only one of the four that should become an issue.**

**And all three ward defects the cluster reported are FIXED** — confirmed independently by three
agents with named commits: the 641px queued-table overflow now carries the owner-ruled affordance
(`b04e796a25`); `SEEDED_QUEUED_IDS` was four and is now the correct six; the `peel-ed` empty-inbox
assertion had been asserting an eight-day-stale state and was rewritten.

⚠️ **What survives the cluster is one structural sentence — the suite is in neither `verify:ui`
path — and that is ALREADY tracked by `43847026`. So the cluster's live content duplicates a record
we are also applying.**

---

## 🔴 THE THREE THAT NEED THE OWNER, NOT CODE

1. **`017b63bd` — P1, clinical.** `SUITABILITY_GATES` still classifies **authorisation** and
   **security** as overridable, beside cohort and sex-mix. The design standard's own §8.4 test:
   _"A judgement about the patient is overridable by a named coordinator with a recorded reason. A
   fact about the world is not."_ 🔴 **Whether a ward holds Mental Health Act authorisation is a
   fact about the ward, not a judgement about the patient.** The 2026-09-02 ruling made every
   suitability gate overridable, with a stated reason — that a rule nobody can override stops the
   RECORD of the placement, not the placement. ⚠️ **Nobody has confirmed that reasoning was meant to
   cover authorisation and security specifically, and the standard does not carry the reasoning at
   all.** **Either answer changes code: confirm, and the reasoning is written into §8.4 and the
   mockup; move it to absolute, and the engine, its tests and the mockup's gate list all change
   together.**
2. **`07fe22b0`** — four screens have no openable drawing; two were built against references that
   exist only as links in the owner's own account. **Only he can open them.**
3. **`463c6f11`** — the data-conditional absence sweep. ✅ **Already deferred by him, with three
   re-raise triggers.** Nothing to decide again; it is parked, not lost.

---

## ⚠️ THE THREE NOBODY HERE CAN SETTLE

**All three need hosted-CI or live-site access, which is provider-backed and was not authorised for
this triage:**

- `6b90cb8e` — the Lighthouse baseline stop-rule. ✅ **Not breached at file level: the baseline's
  last edit is `baec777a68`, 2026-08-19, before the recommendation was written.** Whether main has
  since had a genuinely green run is a hosted fact.
- `9fcfa105` — `release-browser-matrix`. ✅ **The structural cause IS fixed — the 70-minute
  sequential job was split into three per-engine jobs at `timeout-minutes: 45` (`931cab455f`).**
  ⚠️ **But it is still absent from `pr-required`'s `needs` list, so it still cannot block a merge**,
  and whether the 15 Firefox/WebKit assertions still fail is unknown here.
- `b22e1bba` — **P1, the live sign-in outage.** ✅ **A fix matching the exact reported mechanism is
  merged to `origin/main` at `fbbb6c16cf` (PR #2709, 2026-09-07): the callback now reads
  `x-forwarded-host`/`host` instead of the address the server bound to.** 🔴 **Whether the deploy
  landed and the live site is serving it needs a human with provider access. Do not close this on
  the commit alone.**

---

## ✅ THE SEVEN ALREADY FIXED — with the commit, so nobody re-opens them

    01fb8e5a   prototype/reducer disagreed on whether a prior decline is final   313999726b
    11f4c62b   provenance guard: retraction hole + figure-noun whitelist gap     04e42e64e3
    4d821d93   invented-figures guard certified the claim it forbids             41a98eba90
    3c0b6354   every main run cancelled at the 70-minute cap                     931cab455f
    7235af08   the three ward defects of the mockup run                          b04e796a25 +
    c8a3914a   (the same three, recorded twice more)                             9c9aa86797 etc.
    ea9138f6   community-team statistics page drawn but never built              f2a1ad6081

⚠️ **"APPEARS-FIXED" is the agents' word and it is the right one. Each was checked in code, not in a
browser and not in production.** 🔴 **`b22e1bba` in particular is a merged commit, NOT a verified
live recovery, which is why it sits above and not here.**

---

## 🔴 THE ELEVEN THAT STAND — and two are worth reading twice

**`66de38d8` — the standard's own reference build contradicts its prose.** Independently
re-counted by me, not taken from the agent:

    the standard says     "There are twenty-three wards across seventeen sites."
    its reference build    16 ward entries across 9 distinct sites
                           RPH ARM SJGM BTY SCGH GRY FSH RGH FRE
    and                    WACHS is a coloured, named service with ZERO wards under it

**`e957c538` — the gate drift has PARTLY healed and the record's own figure has rotted.** The
mockup emits 10 gates; the engine now has **13**, not the 12 the record says. `acuity` is no longer
mockup-only; `catchment` still is. ⚠️ **And the mockup's own comment now says _"Three gates on this
screen have no counterpart — capability, acuity and catchment"_, which is itself stale.** 🔴 **A
record about drift, drifting, beside a comment about drift that has drifted.**

**The other nine:** the phone-scroll race is structurally unchanged in code; the ward suite is still
in neither local gate; the archived-ledger-row correction is still impossible and a race's loser
still loses its findings silently; Movements still has no link to Delays; all four audit leftovers
are untouched (the Docling model is still unpinned, `preview.html` is still byte-identical in two
places, the service-worker cache version is unchanged, and the governance URL is still an unopenable
blob link); the ED hub still has two rival drawings with no written ruling; and the chrome-header
spec still covers three of the eight audited faults.

---

## ⚠️ WHAT THIS MEANS FOR THE RECONCILE ITSELF

🔴 **The reconcile must apply the requests EXACTLY as recorded — `check:ledger-write-discipline`
rejects any canonical diff that does not equal its recorded transaction, and that gate is right.**
✅ **So this document does not change what gets applied. It is what lets the seven fixed ones be
closed immediately afterwards WITH EVIDENCE, and the three superseded cluster records withdrawn
through the supported `cancel` action rather than by hand.**

🔴 **AND THE COUNT RULE FOR THE RUN: count what goes in and count what comes out, and state both.
"Reconciled successfully" over 41 of 69 reads exactly like 69, and today produced five instances of
a status describing something other than the thing it appeared to describe.**
