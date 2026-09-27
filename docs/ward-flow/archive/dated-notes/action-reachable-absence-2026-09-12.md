# The action-reachable absence sweep — and the population is smaller than the commission assumed

**Ward Verifier, 2026-09-12.** **Pre-registration committed BEFORE any number at `f693408520`:
`action-reachable-absence-prereg-2026-09-12.txt`.** **Tree `f7b18de815` (merge of `76f7293805`),
dev server `http://localhost:3249`, identity confirmed at `/api/local-project-id`
(`clinical-kb:ab9ee6912330`).**

**This is the third instrument on this question. A render census walked 36 routes in their DEFAULT
state; a blind source enumeration re-derived 22 sites; both returned zero non-compliant. NEITHER
walked a state reached only by an ACTION. This one does.**

---

## 1 · Status — the final tally is in §9, not here

⚠️ **This section was written when three states had been walked and §7 added a fourth.**
**The figure of record is §9: FOUR walked, ZERO non-compliant, prediction VOID.**

    states walked          4
    NON-COMPLIANT          0
    prediction             "at least one non-compliant among the FIRST TWELVE"
    verdict                VOID — the action-reachable population is smaller than twelve (§8)

⚠️ **Per the pre-registration the tally is written before the next state is opened, so the
prediction cannot be back-loaded.** **It is confirmed at the first non-compliant site at any n; it
is falsified only at twelve-walked-zero-found.** **Three is neither.**

**Load: start 01:05:24 node=83 / 6.31 GB free · 01:17:25 node=86 / 7.35 GB free.**
⚠️ **Ten build agents were running in isolated worktrees throughout. Recorded, not claimed away —
no tool here can make this machine quiet.**

## 2 · ✅ THE INSTRUMENT CONTROL PASSED BEFORE ANY NUMBER WAS READ

**Designated specimen: the search hub's empty-result sentence. The probe had to NOT see it before
the action and to see it after. Either half failing prints `RESULTS VOID` and exits.**

    summary BEFORE any typing : null
    summary AFTER  the action : "Nothing matches “zzqqxx-not-a-person-9931”. …"
    ✅ CONTROL PASSED

## 3 · The three states, each with its own class control

### STATE 1 · `/search` · class A (empty result set) · DERIVED · **COMPLIANT**

> **"Nothing matches “zzqqxx-not-a-person-9931”. No person, no waiting referral and no open
> movement. A record that has already left the system would not appear here even if it existed."**

✅ **Quotes the query verbatim, enumerates ALL THREE populations searched, and then names an
exclusion the reader could not have inferred.** 🔴 **That last clause is more than the standard
asks for: it says what the search would have missed, not only what it covered.**

**Class-A positive control — the same control returning rows:**
`"57 records for “a” — 8 people, 6 still waiting for a decision, and 43 open movements."` ✅
**Same three populations, same order, counted. The empty sentence and the populated sentence are
built from one shape.**

### STATE 2 · `/community` · class A (empty filter) · DERIVED · **COMPLIANT**

> **"No team name contains “zzqqxx9931”. The list holds names as they reach this page, so a team may
> be recorded under a spelling you would not expect. Try a shorter fragment."**

✅ **Quotes the query, names the searched population precisely as team NAMES — which is what the
filter matches on, not "teams" — and then names a LIMIT of the search rather than only its scope.**

**Class-A positive control:** query `"wheat"` returns rows, empty notice absent. ✅

### STATE 3 · `/board/<unknown id>` · class A (identifier resolving to nothing) · DERIVED · **COMPLIANT**

> **"Ward not found — No ward is recorded with the id “zzqqxx-not-a-ward-9931”."**

✅ **Quotes the identifier that failed and names the population it was looked up in.**
**Control: the same block is absent on a real ward (`/board/rph-adult-secure`), so the state is
produced by the action rather than always present.**

## 4 · ⚠️ A CANDIDATE THAT WAS NOT A STRING AT ALL

**`bed-map.tsx:112` appeared in my candidate list as `No site matches`.** 🔴 **It is inside a
COMMENT — describing a test that asserts the phrase never appears.** **There is no such rendered
string.**

⚠️ **Third time in one night that a grep matched PROSE ABOUT a thing rather than the thing.** ✅
**Caught by opening the line rather than counting the hit — the same way the other two were.**

## 5 · 🔴 AND THE PROBE'S FIRST TWO RUNS WERE VOID, CORRECTLY

**Run 1 reported the specimen absent after the action, and dumped the page text — which turned out
to be the inline THEME SCRIPT.**

🔴 **`document.body.cloneNode(true).innerText` on a DETACHED node falls back to `textContent`,
which INCLUDES `<script>` and `<style>` text.** **My "visible page copy" was JavaScript source.**

✅ **Fixed by reading `innerText` on the LIVE body.** ⚠️ **Run 2 was void for a different reason —
the input I had located by placeholder heuristics was the SHELL composer, not the screen's own
search box.** **Both were caught by the instrument control refusing to report a number.**

## 6 · What remains

**Nine more states to reach twelve.** **Candidate surfaces already enumerated from source (fourteen
components carry both interactive state and JSX absence text) but NOT yet walked**: the patient
search's refusal path, the typeahead's attached-referral line, the shortlist panel's
no-ward-can-take-this-person verdict, the ward screen's five per-section placeholders, and the
movements console's grouping.

⚠️ **Several of those may prove to be DEFAULT-render rather than action-reachable, in which case
they belong to the census already done and not to this population.** 🔴 **If the action-reachable
population turns out to be smaller than twelve, the pre-registration makes the prediction VOID
rather than falsified — an undersized population is not evidence either way, and I will report it
that way rather than treating a small clean sample as a clearance.**

---

## 7 · STATE 4 · `/ward/<unit>` suburb lookup · class A · DERIVED · **COMPLIANT**

**Driven through twelve queries. Control: the answer block is `null` before any lookup, and eleven
real suburbs return `state="reviewed"` — so the probe distinguishes an answer from an absence
rather than reading an unmounted panel.**

> **"zzqqxx-not-a-suburb-9931 is not in the source table. zzqqxx-not-a-suburb-9931 is not
> recognised — it appears in no catchment document supplied. Check the spelling and the address. A
> suburb absent from the table may be a misspelling, or somebody out of this catchment altogether —
> **no answer is guessed at from a similar name**."**

✅ **Names the query twice, names the searched population twice and differently (the source table;
every catchment document supplied), names what to do, and explicitly refuses to guess.**

🔴 **AND THE PANEL DISTINGUISHES TWO ABSENCES THAT MOST CODE WOULD MERGE.** Its own comments:

> _`no-team-recorded`_ — **"NOT \"unknown\". The place is real and the mapping is missing —
> something to FILL IN."**
> _`not-in-table`_ — **"NOT \"unknown\" either, and not the same as the case above — something to
> CHECK."**

⚠️ **I reached only `not-in-table`. `no-team-recorded` needs a suburb that IS in the table with no
clinic against it, and none of my twelve queries produced one. NOT REACHED, therefore NOT COUNTED —
in either direction.**

### 🔴 And a fourth prior diagnosis, in that panel's own comment

> **"An earlier draft restated the source facts here… THE TESTS COULD NOT SEE IT: THEY ASSERT
> PRESENCE, AND A DUPLICATED SENTENCE IS PRESENT TWICE. Found by reading the rendered panel in a
> browser."**

**Someone had already met the shape this whole sweep exists to find, recorded that the test suite
was structurally blind to it, and said which instrument caught it.**

## 8 · 🔴 THE REAL FINDING: MOST OF THE UNWALKED REMAINDER IS NOT ACTION-REACHABLE AT ALL

**A default-render census over nine routes, with a positive control proving the probe reads page
copy, classified eighteen candidate sentences:**

    PRESENT by default (belong to the census already done)   4
    ABSENT from the default render                          14

⚠️ **"Absent from the default render" is NOT the same as "reachable by an action", and conflating
them would have been this sweep's version of every unit error recorded tonight.** **Reading each
one's condition:**

    ACTION-conditional (a click, a query, a selection)   ~4
    DATA-conditional  (the seed would have to differ)    ~10

**The data-conditional ones — "No ward in the network reports a ready bed right now", "No ward
reports a bed freeing today", "No referrals awaiting a decision", "No movement is in this group
right now" — cannot be produced by using the screen at all.** **They need a different seed.**

🔴 **So the commission's premise is only half right. The unwalked population is real and large, but
it is mostly UNREACHABLE BY ACTION — it is reachable only by changing the data.** ✅ **That is a
different instrument again: seed perturbation, of the kind used once tonight on the community
statistics contradiction, reversibly and with the restoration proved three ways.**

## 9 · Verdict against the pre-registration

    action-reachable states WALKED        4      (all class A)
    NON-COMPLIANT                          0
    action-reachable population estimated ~7     — fewer than twelve

🔴 **Per the pre-registration: an undersized population makes the prediction VOID, NOT FALSIFIED.
An undersized clean sample is not evidence either way, and I am not letting four compliant states
read as a clearance.**

✅ **What can be said: of every action-reachable absence state I could produce, all four name what
was searched, and three of the four also name a LIMIT of the search. None was non-compliant.**

🔴 **What cannot: nothing about the ten data-conditional states, which are now the largest unwalked
population anybody has identified, and which no instrument used tonight can reach.**

**Load: start 01:05:24 node=83 / 6.31 GB · 01:17:25 node=86 / 7.35 GB · end 01:28:44 node=82 /
4.85 GB. Ten build agents throughout.**

## 10 · ⚠️ An incidental corroboration

**`/queue` and `/delays` returned IDENTICAL body lengths — 9,535 characters both.** **Consistent
with Lane A's finding that `/queue` is a redirect stub to Delays, reached here by a different
instrument and not looked for.**
