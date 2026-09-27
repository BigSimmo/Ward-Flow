# The ward browser journeys, run for the first time — 2026-09-06

**65 passed · 8 failed · 1 skipped · 5.1 minutes**, local Chromium, `chromium-mockups` project,
all ten `tests/ui-ward-*.spec.ts` files.

⚠️ **THIS IS THE FIRST TIME ANYBODY HAS SEEN THESE RUN.** They have never gated anything, so nothing
has kept them passing — which is exactly what `ci.yml`'s `ui-ward-journeys` block predicted in
writing before the run existed. **The prediction was right and the number is 8.**

**So `WARD_JOURNEYS_BLOCKING` must not be turned on.** The green run its comment waits for does not
exist, and there is now evidence of that rather than an absence of evidence.

---

## ⚠️ SUPERSEDED WITHIN THE HOUR — THE COUNT IS NOW 2, NOT 8

**Ward Lead retired four and RE-POINTED one while this record was being written**, on the owner's
direct authorisation for the browser suite — the decision I declined to assume was covered by the
82-unit-case ruling. **Stopping cost nothing: the answer came back inside the hour.**

    before   8 failed · 65 passed · 1 skipped
    after    2 failed · 67 passed · 5 skipped        74 both times, reconciles

⚠️ **The section below is left exactly as written, because it is the only record of what these
journeys reported the first time anybody ran them.** It is a measurement with a date on it, not a
statement about today.

**🔴 One of my five was wrong to group, and the distinction is worth more than the count.**
_"Retains its operating structure in dark, forced-colours and print"_ — its SUBJECT was retired but
its PROPERTY was not, and Movements is a live screen for which it is exactly as true. **Retiring it
with its siblings would have dropped live coverage of a screen we chose to keep.** I listed it under
"not defects, retire these"; it is not the same act. **A test whose subject went is retired; a test
whose property survived onto the replacement is re-pointed.**

**The two survivors are open product questions, not breakage.** `ui-ward-management:71` is the
`delays` finding, left deliberately because that fold is live work. `ui-ward-discharges` — one of
the two I explicitly did not diagnose — turns out to expect a per-unit group of six figures
(Ready · Held · Confirmed · Expected · Blocked · Occupied) that MERGE 02's table does not
carry, **so a release's stage no longer reaches the coordinator's board at all.** That is the test
reporting a product change. With the owner.

---

## The eight, and they are not one kind of failure

### Five are journeys over screens the owner has ruled finished with — 🔴 NOT DEFECTS

| spec                                          | screen        | why it fails                           |
| --------------------------------------------- | ------------- | -------------------------------------- |
| `ui-ward-morning.spec.ts:55` · `:105`         | morning board | `/morning` redirects to `/capacity`    |
| `ui-ward-roles.spec.ts:227` · `:253` · `:269` | live tracker  | `/transport` redirects to `/movements` |

**These are the browser-level counterpart of the 82 unit cases retired earlier today**, over exactly
the same replaced screens. They assert against pages a coordinator can no longer open, and they fail
because the route redirects — **the tests are working correctly and describing a decision.**

⚠️ **They were NOT retired in this change.** The owner's instruction covered the 82 unit cases; these
five are a separate act on a separate suite and want their own decision. **Retiring them would take
the failure count from 8 to 3 and is the single cheapest step toward a green lane** — recorded here
rather than done.

### Three are on screens a coordinator can still open — these are real

| spec                             | screen                 | what it reports                                                  |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `ui-ward-management.spec.ts:71`  | Ward Flow command view | `WARD_VIEWS gained a destination with no testid mapping: delays` |
| `ui-ward-management.spec.ts:230` | Ward Flow command view | header brand not visible at tablet width with the panel hidden   |
| `ui-ward-discharges.spec.ts:92`  | discharges board       | the bed-release lifecycle does not reach the capacity board live |

**`/mockups/ward-flow` and `/mockups/ward-flow/discharges` are both live routes** — checked, not
assumed.

⚠️ **The `delays` one is the most informative and is not a product bug.** A mode was added to
`WARD_VIEWS` without the spec's testid mapping, so the journey that claims to open **every** Ward
Flow mode has been unable to see the delays mode since it was added. **A test named "opens every
mode" that silently covers one fewer is the failure this whole exercise is about**, and it was found
only because the suite was run.

**The other two are unverified as product defects.** They are red; whether the cause is the screen or
a stale expectation was not investigated, and saying so is better than implying a diagnosis.

---

## What changed in CI, and what did not

**The lane now runs on every UI pull request and does not block** — owner instruction, 2026-09-06.
`WARD_JOURNEYS_BLOCKING` moved off the job's `if:` onto its `continue-on-error`, so the flag now
decides only whether a red one stops a merge.

⚠️ **Removing the flag from the `if:` alone would have inverted the instruction silently**, because
`pr-required` calls `require_skipped_or_success` for this job when the flag is off: an un-gated job
that failed would have blocked every UI pull request in the repository. **The two edits are one
change**, pinned by `tests/ward-journeys-lane-runs-without-blocking.test.ts` — deliberately outside
`ci-cache-safety.test.ts`, whose aggregate block is `skipIf(win32)` and so cannot run on the machine
where this workflow is edited.

**Nothing was fixed, retired or skipped by this change.** The eight are red and now visible.
