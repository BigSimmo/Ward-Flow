# 11 Nov 2026, Live audit fixes (PR #1626)

Changed on top of `main` at `0b657ad` (after #1606 and #1608 merged). Each raise is under 5 KB, within the per-screen allowance in HOW-WE-WORK section 6:

- Home `/ward-flow`: 587.7 to 588.2
- Movement `/ward-flow/movements/WF-001`: 618.7 to 619.2
- ED site `/ward-flow/ed/arm-ed`: 678.1 to 681.5

Every other screen keeps `main`'s limit.

Measured by hosted CI on head `4daa8a3` (job 130830721425), in KB: Home 587.9, Movement 618.9 and ED site 681.2. Each new limit is the measurement plus 0.3. `main` alone could not be built for comparison, so the whole overage counts against this PR. Before #1606 merged, this PR with `main` measured Home 585.1, Movement 617.2 and ED site 675.0 (job 130823967817), all inside the limits at the time.

Why it changed: this PR adds the calm "Saving…" pill and its delayed warning, "Leave the demo" in the account and phone menus, the "Waiting to save" bed tile, the bed's closure History, the archive card's reason line and the Undo choices on the toast (D-148, D-149, D-151). Most of that is in the shared shell or the bed drawer, which the ED site page also loads. Merging #1606's ED referral flow on top grew the ED site page by a further 6.2 KB in the combined build, against 1.6 KB in #1606's own measurement.

Trim tried: the toast's reason menu (`wf/toast-choices.tsx`) and the front-door holders were already moved out of the first load in this PR. No further trim was found without a measurement of `main` alone. The ED site raise is 3.4 KB over `main`'s limit, so any further growth there leaves 1.6 KB of the allowance.

## After merging `main` at `02817bb` (#1632)

`main` raised six of its own limits. This PR now keeps `main`'s value for every route and adds only its own raise over the old `main` at `0b657ad`, in KB: Home 588.3 to 588.8 (+0.5), Movement 619.0 to 619.5 (+0.5) and ED site 678.1 to 681.5 (+3.4). Every other route takes `main`'s limit unchanged. Hosted CI's measurement will show whether any can come down.
