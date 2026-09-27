# Re-measure of the 17 Sept audit against tip `6fd766d37c` — 18 Sept 2026

The 17 Sept audit (`WARD-FLOW-CONSOLIDATED-AUDIT-2026-09-17.md`, rolled up into
`WARD-FLOW-MASTER-COMPLETE-2026-09-17.md`) was measured at `f10ca39fbd`. Five commits landed
after it, one of them "streamline emergency department table". This re-measures its P1 list
against the current committed tip.

Measured in an isolated worktree at `6fd766d37c` — deliberately **not** in `ward-lead`, which
had a live writer at the time (53 files uncommitted and growing, newest write 52 seconds
before the check).

| Audit finding                                             | Verdict at `6fd766d37c`                     |
| --------------------------------------------------------- | ------------------------------------------- |
| WF-P1-ED — ED board overflow, desktop + tablet            | **FIXED**                                   |
| WF-P1-02 — `CONFIRM_CAPACITY` unbounded                   | **STILL OPEN**, lower severity than stated  |
| WF-P1-03 — STEP_BACK holds bed without unwind             | **BY DESIGN**; UX question remains          |
| WF-P1-WLQ4 — revoked exam not blocked at EN_ROUTE/ARRIVED | **NOT A DEFECT** — reverses an owner ruling |
| WF-P1-seed — pulled-admissions `it.fails`                 | **STILL OPEN**                              |
| WF-P1-unreachable — two events with no screen             | **STILL OPEN**, already registered          |
| WF-P1-tablet #2 — "Send referral" disabled                | **NOT REPRODUCED**                          |

---

## WF-P1-ED — fixed, and the metric that said otherwise

The audit reported `scrollWidth` figures: tablet `/ed/peel-ed` 1769, desktop 1440 peel-ed 2013
and rph-ed 2513, concluding "still overflows".

Measured today on both named boards at both widths:

| Page          | Viewport                         | `documentElement.scrollWidth` | `body.scrollWidth` | Elements overflowing outside a scroller |
| ------------- | -------------------------------- | ----------------------------- | ------------------ | --------------------------------------- |
| `/ed/rph-ed`  | 1425                             | 2040                          | **1425**           | **0**                                   |
| `/ed/rph-ed`  | 753                              | —                             | **753**            | **0**                                   |
| `/ed/peel-ed` | 753                              | —                             | **753**            | **0**                                   |
| `/ed/peel-ed` | 1425                             | —                             | **1425**           | **0**                                   |
| `/ed/peel-ed` | 805 (the audit's own 820 tablet) | 1280 (was 1769)               | **805**            | **0**                                   |

`body.scrollWidth` equals the viewport exactly in every case, and a sweep of every element
whose right edge passes the viewport finds **none** that is not inside a scrollable ancestor.

The board table is genuinely wide — 2125px at desktop — but it sits in
`ed-module__tableWrap`, which is `overflow-x: auto` and really scrolls (setting
`scrollLeft = 500` moves it). That is exactly the fix the audit asked for: "internal scroll,
not page overflow."

> ⚠️ **`documentElement.scrollWidth` is the wrong instrument here and will fabricate this
> finding again.** It still reads 2040 at desktop and 1280 at tablet, because it reports an
> unclipped descendant box. Both `html` and `body` are `overflow-x: clip`, so the page cannot
> be scrolled horizontally and nothing is cut off. Measure `body.scrollWidth`, or count
> elements that overflow while outside a scroller. Anyone re-running the audit's method will
> "reproduce" this and then repair a working scroller.

## WF-P1-02 — `CONFIRM_CAPACITY` still unbounded, but the harm is floored downstream

`ward-flow-reducer.ts:4490` writes `value: event.value` with no bound of any kind — confirmed
today, exactly as the audit says, and its point about the trust boundary is right: the screen
bounds it (`min={0} max={unit.beds}`, plus a `parsed < 0` guard in `submitCapacity`) and the
reducer does not, which inverts this repo's own repeated doctrine that the refusal belongs in
the reducer.

What the audit does not say is that the consequence is already caught.
`tests/ward-flow-reducer.test.ts:1273` ("arrival capacity floor") **deliberately uses** the
unbounded write to build its scenario — confirming `value: 5` on a unit with one allocatable
bed — and proves `PATIENT_ARRIVED` refuses once physically empty beds are exhausted rather
than driving `empty.value` negative. So the state cannot be corrupted. The residual exposure
is a _displayed_ allocatable figure that can exceed the ward's bed count.

**If you clamp it:** clamping to `unit.beds` is safe and leaves that test green (it uses 5 on
a 20-bed unit). Clamping to `empty.value` would break it. Run that test both ways.

## WF-P1-WLQ4 — not a defect; building this would reverse an owner ruling

The audit asks to "re-check EN_ROUTE/ARRIVED still open while revoked unresolved" and the
master document turns that into "Guard while revoked awaiting release".

`ward-flow-reducer.ts:2632-2700` and `ward-flow-reducer.test.ts:750-826` both record **WLQ-4
(owner, 2026-09-15)** as a deliberate decision: a revoked examination after transport is
booked flags the situation for the coordinator and does **not** stop the vehicle; the bed
stays held via `examinationRevokedAwaitingRelease` until a person decides to release it. The
test says it outright at line 809 — _"WLQ-4 flags the situation for a coordinator to resolve;
it does not itself stop the vehicle."_

The absence of a block is the ruling, not a gap in it.

## WF-P1-03 — deliberate, so what is left is a looking question

`STEP_BACK_STAGE` keeping the bed and `admissionId` is by design under rulings E/F
(`ward-flow-reducer.ts:3312`), with `RELEASE_PULL` as the separate event that refunds the bed.
Both controls are dispatched from `ward-management-console.tsx`. Whether the release path
_reads_ as unmistakable is a visual judgement that no gate here can make; it needs eyes and a
`SCREEN-VERIFICATION.md` row, not a code change.

## WF-P1-unreachable — open, but already registered and self-closing

`RECORD_NO_REFERRAL` and `RECORD_TRANSPORT_NEED` are entries in
`tests/ward-event-reachability.test.ts` `KNOWN_UNREACHABLE` with written reasons. That
register fails in both directions, so it forces its own entry out the moment a screen
dispatches either. The allowlist half of the audit's "UI or allowlist" is already done; the
screens are what is missing.

## WF-P1-tablet #2 — not reproduced

On a fresh load of `/mockups/ward-flow/referrals/new` at 820×1180, the
`ward-referral-intake-submit` control reads **enabled**, labelled "Send referral". The audit
recorded it disabled with an unavailable-reason. Either it was fixed or the original was
state-dependent; as written, the claim does not reproduce.

Claims #1 (raise link not scrolled into view) and #3 (community card not clickable) were not
completed — the renderer stopped responding on that 4,657px page and I did not want to report
a timeout as a result.

## Not run

The offline unit suite (`npm run test`) was started and had not finished. The audit's
"95 passed / 2 skipped" e2e figure is unverified here and was in any case measured on the
superseded tip.
