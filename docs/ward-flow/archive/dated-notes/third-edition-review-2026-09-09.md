# Review of the third edition — the design system, the Command drawing, and the kit that checks them

**Ward Lead, 2026-09-09, against PR #2738 at `ef582b110f`, merged to `main` before this review ran.**
Three independent audits plus my own read. Every claim below was measured on the merged commit, not
taken from the pull request's own account of itself.

⚠️ **The three audits were Sonnet extraction runs with named catchers** — the live model, the locked
palette, and the checkers' own exit codes. The verdicts and the recommendation are mine.

---

## The short version

**The design system is good work and the honesty rules are the best part of it. The Command drawing
is not safe to build from. One of the kit's four checkers cannot fail, and three cannot run.**

---

## 1. It replaces the locked design language rather than extending it

Not a defect — a decision, made openly, that the owner has not yet ruled on.

| Locked           | Value             | Third edition        | Status                                            |
| ---------------- | ----------------- | -------------------- | ------------------------------------------------- |
| accent           | `#0e7c86` teal    | `#2f4c66` navy slate | **changed — hue**                                 |
| paper            | `#fbfcfd`         | no equivalent        | **dropped**                                       |
| faint            | `#8c99a4`         | no equivalent        | **dropped**                                       |
| surface          | `#ffffff`         | `#fdfdfe`            | changed                                           |
| sunk             | `#f4f7f9`         | `#eef2f6`            | changed                                           |
| ink              | `#16202b`         | `#161a20`            | changed                                           |
| soft ink         | `#3d4c5a`         | `#414953`            | changed                                           |
| muted            | `#5a6976`         | `#5f6873`            | changed                                           |
| lines            | `#e3e9ed`         | `rgba(22,30,40,.11)` | changed, and to alpha                             |
| strong           | `#cbd6dd`         | `rgba(22,30,40,.26)` | changed, and to alpha                             |
| danger           | `#a8542b`         | `#b03b2e`            | changed                                           |
| headings         | Schibsted Grotesk | **Source Serif 4**   | **replaced — a new family shipped into the repo** |
| body             | Source Sans 3     | Source Sans 3        | kept                                              |
| figures          | JetBrains Mono    | JetBrains Mono       | kept                                              |
| base size        | 13.5px            | 13.5px               | kept                                              |
| tabular numerals | yes               | yes                  | kept                                              |

Nine of eleven colours changed, two dropped, the heading face replaced. **Its own history table names
the locked language — "Teal family: Schibsted Grotesk, Source Sans 3, JetBrains Mono, accent
#0e7c86" — and section 13 is a five-wave plan to migrate all eighteen mockups onto the new identity,
including the ones currently correct.** So this is a whole-programme decision sitting inside a
merged pull request.

⚠️ **Two graft traps, whichever way that decision goes.** The kit names its tokens bare — `--surface`,
`--danger`, `--ink` — where the live app namespaces everything `--ward-*` precisely so nothing
collides. `--surface` and `--danger` already exist in `src/app/globals.css` with different values, so
the "copy the block verbatim" instruction would silently overwrite them. And two raw hex values sit in
files whose own commentary claims tokens only: four `#000` in a `mask-image` ramp in `shell.css`
(self-disclosed) and `background: #fff` in a print block.

**What is genuinely strong:** section 8. Absence stated never blank; zero reads _none_ because a
nought is a measurement and none is a state; no verdict ever drawn about a person; search refuses a
risk or acuity score in a sentence rather than returning nothing; any control drawn and not wired says
so. Light, dark, forced-colours and reduced-motion are all handled, and contrast is recomputed from
the page's own tokens on load rather than typed.

---

## 2. 🔴 The Command drawing makes five claims the data cannot support

Three of them change which bed a coordinator is shown first.

1. **A fabricated acuity gate.** Wards carry `acuityInUse`/`acuityCeiling`, movements carry
   `highAcuity`, and eligibility is decided by `acuityOk = !m.highAcuity || u.acuityInUse <
u.acuityCeiling`. `ELIGIBILITY_GATES` is a fixed twelve and acuity is not among them; `highAcuity`
   appears nowhere in the repository outside this file. **And the same page says three times that
   search never returns an acuity score.** It disclaims the thing it then sorts beds by.
2. **The previously-declined ruling, inverted.** The drawing puts `prior_decline` in its absolute
   tier — with "no bed exists" — and states _"a recorded reason does not undo a ward's decline"_.
   The live model has `INFORMATIONAL_GATES = ["prior_decline"]`, ranks it **above** overridable, and
   `needsNoRecordedReason()` returns true, because the owner ruled that re-approaching such a ward
   needs no written reason at all. **The drawing presents the easiest route as the hardest.**
3. **A tentative diagnosis on pre-bed patients.** The vocabulary is real, but it is wired to
   `Admission.tentativeDiagnosis`, which exists only after a bed is confirmed. `Movement` has no
   diagnosis field, and `Referral`'s own guard forbids one. Command's population is people still in an
   emergency department.
4. **An invented catchment gate** (`u.service === m.homeService`), overridden four times in the
   register. Neither `eligibility()` nor `referralEligibility()` tests any such thing.
5. 🔴 **A previously-fixed defect, re-committed.** "2 specialling shifts available, 1 required" —
   `Movement.specialling` is a **boolean**. The live gate carries a comment naming this exact claim as
   a fixed bug: the authored total is never decremented, so the screen told coordinators slots were
   free and `PULL_PATIENT` then refused the placement. `tests/ward-specialling-detail-claims-no-headroom.test.ts`
   guards it. **A test cannot see a drawing.**

**Clean:** the arithmetic (16 units, every bed breakdown reconciles), the Ready/Held/Blocked/Occupied
wording matching the live panel verbatim, the override reason strings, the legal form codes, and the
capacity-freshness override.

---

## 3. The kit checks itself, and mostly well

| Checker                   | Population printed | Mutation → red?                |
| ------------------------- | ------------------ | ------------------------------ |
| `check.mjs`               | yes                | **yes** — 7 of 7 claims tested |
| `check-standard.mjs`      | yes                | **yes** — 4 of 4 tested        |
| `shell/check-preview.mjs` | yes                | **yes** — 2 of 2 tested        |
| `recompute-contrast.mjs`  | yes                | 🔴 **NO — it cannot fail**     |

**Thirteen distinct claims were broken one at a time and each went red with the right message, no
cross-contamination.** That is a real result and better than most gates in this repository.

🔴 **`recompute-contrast.mjs` printed a 1.29:1 ratio — functionally invisible text — alongside eight
discrepancies against its own reference file, and exited 0.** It has no failure path in its source at
all: `grep -n "process.exit\|exitCode"` returns nothing. Worse, it REWRITES the page it checks on
every run, so a re-run after a defect absorbs the bad numbers into the artifact rather than reporting
them.

⚠️ **All three Playwright checkers hardcode `/opt/pw-browsers/chromium`** and crash on this machine.
Every result above needed that one line patched first. Nobody can run this kit's verification here as
shipped.

⚠️ **`check-output.txt` records only `check.mjs`.** The two more thorough checkers — one sweeping
~2,980 elements against the other's ~430, the other the only thing that touches the shell preview —
have never had their output recorded anywhere.

🔴 **`REVIEW-FINDINGS.json` is stale and has no way to say so.** 82 findings, no `status` field
anywhere. Of eight sampled across all severities, **six were already fixed in the shipped file,
including two "high" items from two different reviewers.** Read at face value it says 82 open
problems; the true figure is likely a quarter of that. It was frozen mid-fix-cycle and shipped as
current.

---

## Recommendation

1. **Do not build Command from this drawing** until items 1-5 above are settled. Two of them — acuity
   and catchment — may be features the owner wants; that is a clinical question. The other three are
   wrong against rulings already made.
2. **The identity replacement is the owner's decision and should be made explicitly**, because the
   migration plan for the other seventeen mockups is already written.
3. **Give `recompute-contrast.mjs` a failure path**, and stop it rewriting what it audits.
4. **Give `REVIEW-FINDINGS.json` a status field**, or its next reader will re-fix six things.
5. **Un-hardcode the browser path**, or the kit's own verification is unrunnable outside one sandbox.
