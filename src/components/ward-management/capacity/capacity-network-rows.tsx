"use client";

// The network table's ward rows and the per-service fold that groups them, split out of
// `capacity-screen.tsx` (18 October 2026) to keep that file under the line cap.

import { capacityConfirmer } from "@/components/ward-management/capacity/capacity-confirmer";
import { useState } from "react";
import { dayOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { Button } from "@/components/wf";
import { WardChip } from "@/components/ward-management/ward-chip";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { wardIntakeConstraintLabels } from "@/components/ward-management/ward-change-reasons";
import {
  countCellText,
  confirmedHeldUpNote,
  freeingCellText,
  networkServiceGroupTotals,
  type NetworkServiceGroup,
  type NetworkWardRow,
} from "./capacity-derivations";
import styles from "./capacity.module.css";
import { bedKindsServed } from "./capacity-gap-words";
import { capacityRequestIsOpen } from "../ward/ward-buzz-keys";

/**
 * ⚠️ **`matches` MARKS A ROW. IT NEVER REMOVES ONE — that is the whole point of this task.**
 * `undefined` means the "All" chip is active, which asks nothing about any row, so nothing is
 * marked. `true`/`false` are the active chip's real verdict on THIS row, and either one still
 * renders the entire row — every cell below is unconditional on `matches`.
 *
 * ⚠️ **THE WORD CARRIES THE FACT; THE ATTRIBUTE ONLY CARRIES THE STYLE.** `data-ward-network-row-
 * matches` (on the `<tr>`) drives a token-only visual weight (`capacity.module.css`) that this
 * codebase's own design language already says may vanish under forced colours (`ward-tokens.
 * module.css`'s own comment: "the word is what survives"). So a matching row also states it in
 * words — `.matchMark`, rendered through `WardChip`, which throws at build time if it is ever
 * given no text (`ward-chip.tsx`'s `requireWords`). That word is what stays legible once every
 * colour on this row has been flattened to the system palette.
 */
function NetworkRow({
  row,
  now,
  matches,
  onRequestRefresh,
  selected,
  onSelect,
}: {
  row: NetworkWardRow;
  now: Instant;
  matches: boolean | undefined;
  onRequestRefresh: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const { refreshRequests } = useWardFlowSelect("refreshRequests");
  const requestDisabledReason =
    useEffectiveWardAccess().role === "coordinator" ? undefined : "Only the coordinator can request ward updates.";
  // From the shared record, so a demo reset clears it and a request made from the ward sidebar shows here too.
  // A request stays outstanding until the ward next confirms its capacity (DEC-L5-04): the confirmation stamps it
  // answered, so the order comes from the events, not from whole-minute timestamps.
  const latestRequest = refreshRequests
    .filter((request) => request.unitId === row.unit.id && capacityRequestIsOpen(request, row.unit.allocatable))
    .at(-1);
  const asked = latestRequest !== undefined;
  const site = siteByCode(row.unit.siteCode);
  /*
   * Wards are always named, never shown as a bare code. The unresolved sentence comes from
   * `ward-absence-labels.ts` — Ward Lead's 2026-09-11 ruling that such a sentence must blame the
   * RECORD and not the network.
   *
   * ⚠️ The comment here used to cite `delays-screen.tsx` as the precedent for the old wording.
   * Delays moved to the ruled wording and this file did not, so the citation was pointing the next
   * reader at a repair that had already happened. A comment that names another file as its
   * precedent cannot follow that file when it changes.
   */
  const siteText = siteLabel(row.unit.siteCode, site?.name);
  return (
    <tr
      data-testid={`ward-capacity-network-row-${row.unit.id}`}
      data-selected={selected || undefined}
      onClick={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest("button, a")) onSelect();
      }}
      data-ward-network-row-matches={matches === undefined ? undefined : matches ? "true" : "false"}
    >
      <td>
        <button
          type="button"
          className={styles.wardRowSelect}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {row.unit.name}
        </button>
        <div className={styles.who}>{siteText}</div>
        {/* Owner Answer 18 (second round, 2026-09-17): the ward's fixed-list intake-constraint
            codes, shown here as the coordinator-facing capacity view this ruling names. Chosen
            labels only — this file never renders a code, only `wardIntakeConstraintLabels[code]`. */}
        {row.unit.intakeConstraints !== undefined && row.unit.intakeConstraints.length > 0 ? (
          <div className={styles.who} data-testid={`ward-capacity-network-constraints-${row.unit.id}`}>
            Limiting intake: {row.unit.intakeConstraints.map((code) => wardIntakeConstraintLabels[code]).join(", ")}
          </div>
        ) : null}
        {matches === true ? (
          <div className={styles.matchMark} data-testid={`ward-capacity-network-match-${row.unit.id}`}>
            <WardChip level="accepted">Matches this filter</WardChip>
          </div>
        ) : null}
      </td>
      <td>{bedKindsServed(row.unit)}</td>
      {/*
        🔴 THE CLEANING COUNT SITS BESIDE THE FIGURE, AND THE FIGURE ITSELF DOES NOT MOVE.
        Owner ruling 2026-09-05. "Ready" counted beds the application refuses to admit a patient
        into — the reducer rejects PULL_PATIENT with "every free bed at X is still being made
        ready" — so a coordinator could commit two patients and have the second refused at the
        moment of action, after the ward had been told. He ruled to SHOW the pending count rather
        than subtract it, because an earlier ruling of his avoids the figure lurching as cleaning
        starts and stops. Absence stated in words, never a bare 0 for "we were not told".
      */}
      <td data-testid="ward-capacity-network-ready">
        {/*
          🔴 A POSSIBLE-ZERO IS STATED IN WORDS, NEVER THE DIGIT — restored 2026-09-05, and this
          screen was already obeying the rule two columns over ("Not tracked here" for an untracked
          freeing figure) while contradicting it here. Three wards rendered a bare "0"; the census
          at docs/ward-flow/bed-figure-wording-census-2026-09-04.md §7 has the render evidence and
          the counter-argument the owner decided against.

          ⚠️ The word REPLACES the digit and never sits beside it. A cell reading "0 none" passes a
          careless assertion and is worse than either alone.
        */}
        {row.ready === 0 ? (
          <span className={styles.statedZero}>{countCellText(row.ready)}</span>
        ) : (
          <span className={styles.readyBadge}>{row.ready}</span>
        )}
        {row.pendingPreparation !== undefined && row.pendingPreparation > 0 ? (
          <small className={styles.beingMadeReady} data-testid="ward-capacity-network-pending">
            {row.pendingPreparation} still being made ready
          </small>
        ) : null}
      </td>
      {/* `none`, not `0` — owner ruling 2026-09-06, census §8. See `freeingCellText`. */}
      <td data-testid="ward-capacity-network-locked">
        {/*
          ⚠️ `.statedZero`, NOT `.notTracked`. This cell is a ward that REPORTED and the answer is
          zero; `.notTracked` is named for the opposite fact — a ward that did not report at all.
          The two are visually identical today and the words carry the distinction, but a class
          named for the wrong meaning is how the next person changes the wrong one. See their
          comment in `capacity.module.css`.
        */}
        {row.lockedReady === 0 ? (
          <span className={styles.statedZero}>{countCellText(row.lockedReady)}</span>
        ) : (
          <span className={styles.lockedBadge}>{row.lockedReady}</span>
        )}
      </td>
      <td
        data-testid="ward-capacity-network-freeing"
        className={row.freeing === undefined ? styles.notTracked : row.freeing === 0 ? styles.statedZero : undefined}
      >
        {freeingCellText(row.freeing)}
      </td>
      {/*
        `freeingCellText` is reused rather than copied: it is the one place that decides how a count
        renders versus how an absence reads ("Not tracked here" for undefined, "none" for a real
        zero). ⚠️ Its NAME is about one column and these are three — worth renaming, but a SECOND
        renderer is the worse fault, because two of them drift and the whole point of this helper is
        that `0` and `undefined` never collapse into each other.
      */}
      <td
        data-testid="ward-capacity-network-confirmed"
        className={
          row.confirmed === undefined ? styles.notTracked : row.confirmed === 0 ? styles.statedZero : undefined
        }
      >
        {freeingCellText(row.confirmed)}
        <ConfirmedHeldUpNote confirmed={row.confirmed} alsoHeldUp={row.confirmedHeldUp} />
      </td>
      <td
        data-testid="ward-capacity-network-expected"
        className={row.expected === undefined ? styles.notTracked : row.expected === 0 ? styles.statedZero : undefined}
      >
        {freeingCellText(row.expected)}
      </td>
      <td
        data-testid="ward-capacity-network-blocked"
        className={row.blocked === undefined ? styles.notTracked : row.blocked === 0 ? styles.statedZero : undefined}
      >
        {row.blocked === undefined || row.blocked === 0 ? (
          freeingCellText(row.blocked)
        ) : (
          <span className={styles.blockedBadge}>{freeingCellText(row.blocked)}</span>
        )}
        {/*
          WLQ-10, owner ruling 2026-09-15: while a discharge is still held up it keeps counting in
          `row.blocked` above — that figure is unchanged by this task — and the screen additionally
          says since when the OLDEST of this ward's currently blocked releases has been held up.
          `formatInstantWithDay` is the existing formatter this brief named: a bare clock face for
          something still held up from earlier today, "yesterday" or "N days ago" once it is not.
          Absent whenever `row.blocked` is `0` or `undefined` — never a duration or a claim this
          screen cannot back.
        */}
        {row.oldestBlockedSince !== undefined ? (
          <small className={styles.beingMadeReady} data-testid="ward-capacity-network-blocked-since">
            {dayOf(row.oldestBlockedSince) > dayOf(now)
              ? `expected release in ${dayOf(row.oldestBlockedSince) - dayOf(now)} days`
              : `held up since ${formatInstantWithDay(row.oldestBlockedSince, now)}`}
          </small>
        ) : null}
      </td>
      {/*
        ⚠️ **PULLED, CLOSED AND OCCUPIED TAKE `countCellText`, NOT `freeingCellText`, AND THE
        DIFFERENCE IS NOT COSMETIC.** None reads the release list, so none has a "nobody told
        this screen" state to represent — there is no `undefined` for them and rendering
        "Not tracked here" would be a claim about reporting that is simply false. A real zero still
        reads as the word, which is the rule that applies to every possible-zero on this screen.
      */}
      {/*
        Bed board decision 8A (Josh, 26 Sept 2026). Discharges due today reads each stay's own
        discharge record; transfers today has no recorded source (a movement carries no origin
        ward), so it says so rather than printing a number.
      */}
      <td
        data-testid="ward-capacity-network-discharges-due-today"
        className={
          row.dischargesDueToday === undefined
            ? styles.notTracked
            : row.dischargesDueToday === 0
              ? styles.statedZero
              : undefined
        }
      >
        {freeingCellText(row.dischargesDueToday)}
      </td>
      <td data-testid="ward-capacity-network-transfers-today" className={styles.notTracked}>
        Not recorded
      </td>
      {/*
        The ruled bed boxes (`ward-bed-states.ts`): Ready · Pulled · Closed · Occupied add up to the
        ward's beds. Closed is the box once mislabelled "Held"; "on leave" sits beside Occupied as a
        marker of beds already counted inside it, never a fifth box.
      */}
      <td data-testid="ward-capacity-network-pulled" className={row.pulled === 0 ? styles.statedZero : undefined}>
        {countCellText(row.pulled)}
      </td>
      <td data-testid="ward-capacity-network-closed" className={row.closed === 0 ? styles.statedZero : undefined}>
        {countCellText(row.closed)}
      </td>
      <td data-testid="ward-capacity-network-occupied" className={row.occupied === 0 ? styles.statedZero : undefined}>
        {countCellText(row.occupied)}
        {row.surge !== undefined && row.surge > 0 && (
          <span className={styles.surgeBadge} data-testid={`ward-capacity-surge-${row.unit.id}`}>
            +{row.surge} Surge
          </span>
        )}
        {row.onLeave > 0 ? (
          <small className={styles.beingMadeReady} data-testid="ward-capacity-network-on-leave">
            {row.onLeave} {BED_STATE_LABELS.onLeave.toLowerCase()}
          </small>
        ) : null}
      </td>
      {/*
        🔴 **SEX MIX AND SPECIALLING HEADROOM — OWNER RULING 2026-09-06, built here the same day.**

        **These are not decoration and they are not "nice to have": they are the two gates a
        placement is REFUSED by.** `ward-eligibility.ts` reads `unit.sexMix[movement.sex]` at two
        sites, and `ward-flow-reducer.ts` refuses `PULL_PATIENT` outright when
        `remainingSpeciallingCapacity(unit, admissions) <= 0`. A coordinator was being asked to plan
        against two rules the software enforces and the screen concealed — propose a placement, get
        refused, and nothing on the board says why.

        ⚠️ **A GUARD ASSERTED THE OPPOSITE OF THIS UNTIL TODAY, AND IT WAS RIGHT TO.**
        `ward-capacity-sexmix-release.dom.test.tsx` pinned "carries the signal without putting any
        sex-mix figure on the screen" under the previous ruling. It is RE-POINTED in this commit
        rather than deleted, with its docblock recording that the ruling changed — the same treatment
        the retired dead-mode case got, for the same reason: a guard whose subject was ruled the
        other way is re-pointed, never removed.

        ⚠️ **SPECIALLING PRINTS WORDS, NOT A NUMBER, WHEN IT IS NOT KNOWN.** `speciallingFree` is
        `undefined` when no admissions list reached this screen, because
        `remainingSpeciallingCapacity(unit, [])` returns the ward's FULL authored capacity — so the
        fabricated value would claim headroom that does not exist, which is the direction that sends
        a patient to a ward that must refuse them.
      */}
      <td data-testid={`ward-capacity-sexmix-${row.unit.id}`}>
        {/*
          ⚠️ **NO `?? 0` HERE, AND THE FIRST VERSION HAD ONE.** I wrote `sexMix.female ?? 0` — the keys
          are `Female` and `Male`, capitalised — and every ward on the board rendered **"Female 0 ·
          Male 0"**, a confident false statement about twenty-three wards. The nullish default is what
          made it silent: a missing key became a number rather than an error. `Record<Sex, number>`
          guarantees both keys, so there is nothing to defend against and the guard belongs in the
          test instead — see the all-zero floor in `ward-capacity-sexmix-release.dom.test.tsx`.
        */}
        {`Female ${row.unit.sexMix.Female} · Male ${row.unit.sexMix.Male}`}
        {/*
          🔴 **THE MID-UPDATE CAUTION LIVES HERE, MOVED 2026-09-06. IT SAT UNDER `Ready` AND THAT WAS
          A SCREEN MAKING A FALSE STATEMENT ABOUT WHICH OF ITS OWN NUMBERS TO DISTRUST.**
          Ward Lead ruled it stayed under Ready, then reversed on the mechanism below. Recorded
          because a caution moved on a mechanism nobody wrote down gets moved back by the next
          person.

          **WHAT THE PREDICATE ACTUALLY COMPARES.** `bedRecordsMidUpdate` is
          `sum(unit.sexMix) !== unitCapacity(unit, releases).occupied`. And `occupied` is
          `max((beds - empty) - blocked, 0)` — it reads `beds`, `empty` and `blocked`, **and it does
          not read `allocatable` at all.** `allocatable.value` is the number `ready` IS. So the
          caution never carried information about the Ready figure it was sitting under: **its own
          predicate does not mention it.**

          **WHY THE SEX REGISTER IS THE STALE SIDE, NOT OCCUPANCY.** Both writes to `sexMix` in
          `ward-flow-reducer.ts` move `empty` the opposite way in the same object literal — an
          arrival does `empty - 1` with `sexMix[sex] + 1`, a departure does `empty + 1` with
          `sexMix[sex] - 1`. So a normal admission or discharge can never open this gap. Only an
          event that moves `empty` WITHOUT touching `sexMix` can, and `RELEASE_BED` is that event:
          it frees a bed without knowing whose it was, because guessing would invent a fact about a
          person's sex.

          ⚠️ **AND READY CAN STILL BE STALE — BY A DIFFERENT MECHANISM, WITH ITS OWN CONTROL ON THIS
          ROW.** `allocatable.value` can be out of date if a ward has not restated its numbers; that
          is what `WardFreshness`'s "Confirmed HH:MM" cell and the refresh button two columns over
          are for. **Two different staleness facts, two different indicators, and conflating them is
          what put this one under the wrong figure.**

          ⚠️ It renders ONLY when the two genuinely disagree. At seed every ward holds the identity,
          so this is silent on a settled board — an always-visible caution would be ignored within a
          day and would make every figure look doubtful.
        */}
        {(row.reservationReleaseCapacityConflicts ?? 0) > 0 ? (
          <small className={styles.midUpdate} data-testid={`ward-capacity-reservation-release-conflict-${row.unit.id}`}>
            {row.reservationReleaseCapacityConflicts} reservation release(s) need capacity re-confirmation — an offered
            count already reported its ceiling. No extra physical vacancy is implied.
          </small>
        ) : null}
        {(row.arrivalCapacityConflicts ?? 0) > 0 ? (
          <small className={styles.midUpdate} data-testid={`ward-capacity-arrival-conflict-${row.unit.id}`}>
            {row.arrivalCapacityConflicts} {row.arrivalCapacityConflicts === 1 ? "arrival awaits" : "arrivals await"}{" "}
            capacity reconciliation — recorded arrival conflicts with the empty-bed observation.
          </small>
        ) : null}
        {row.bedRecordsMidUpdate ? (
          <small className={styles.midUpdate} data-testid={`ward-capacity-mid-update-${row.unit.id}`}>
            This ward&rsquo;s bed records are mid-update — this figure may not be settled.
          </small>
        ) : null}
      </td>
      <td
        data-testid={`ward-capacity-specialling-${row.unit.id}`}
        className={row.speciallingFree === undefined ? styles.notTracked : undefined}
      >
        {row.speciallingFree === undefined
          ? "Not tracked here"
          : `${row.speciallingFree} of ${row.speciallingStaffable}`}
      </td>
      {/*
        🔴 WHETHER THIS WARD MAY LAWFULLY HOLD A DETAINED PATIENT — restored to the NETWORK view
        2026-09-05. It was never wholly lost: `ward/ward-screen.tsx` and `coordinator/flow-diagram.tsx`
        both render it. What the fold lost is seeing it for every ward AT ONCE, which is the question
        a capacity board answers and a per-ward page cannot.

        ⚠️ Rendering the flag is not a legal claim — it is `Unit.authorised`, the ward's own recorded
        statutory fact, in the codebase's existing wording. Nothing here decides eligibility;
        `ward-eligibility.ts` owns that and still refuses at the point of action.
      */}
      <td data-testid={`ward-capacity-authorised-${row.unit.id}`}>
        <span className={row.unit.authorised ? styles.authYes : styles.authNo}>
          {row.unit.authorised ? "Yes" : "No"}
        </span>
      </td>
      <td className={styles.confirmationCell} title={capacityConfirmer(row.unit)}>
        {/*
          🔴 WHO CONFIRMED IT, RESTORED 2026-09-05 — MY FOLD DROPPED IT AND A GREEN TEST HID THAT.
          The old capacity view passed `confirmedByRole` and `derived`; this screen replaced it and
          passed neither, so every ward read a bare "Confirmed 10:32" where it used to read
          "Confirmed 10:32 · NUM Armadale". The distinction is not decoration: `source === "ward"`
          means the WARD ITSELF confirmed the figure, and anything else means it was derived from a
          feed nobody stood behind. A coordinator ringing a ward about its own number needs to know
          which of those they are looking at.

          ⚠️ It survived because `ward-capacity-freshness-source.dom.test.tsx` still renders the OLD
          mode, which no route reaches any more — a clinical guard passing forever about a screen
          nobody can open, while a reader counting green ticks concludes THIS screen has attribution.
          Found by Ward Lead after the fold. The table retains the NUM role; the ward name is
          already on this row and the complete attribution remains in this cell's title.
        */}
        <WardFreshness
          confirmedAt={row.confirmedAt}
          confirmedByRole={capacityConfirmer(row.unit)}
          derived={row.unit.allocatable.source !== "ward"}
          now={now}
        />
      </td>
      {/*
        🔴 THE COORDINATOR'S ONE PERMITTED ACTION ON THIS BOARD, RESTORED 2026-09-05.

        ⚠️ **THIS WAS A CAPABILITY LOST BY ACCIDENT, NOT BY DECISION.** `REQUEST_CAPACITY_REFRESH`
        was dispatched from exactly ONE place in the codebase — the capacity view MERGE 02 retired —
        while the event type, the reducer case, the provider list and the ward-side DISPLAY of a
        request all kept working. So no coordinator could ask a ward to restate its numbers, and
        `ward/ward-screen.tsx` carried a mark for something nothing could produce: a field with no
        producer, invisible to every gate because each half was individually correct.

        ⚠️ It moves NO bed figure, and that is the whole point of it. The reducer appends to
        `refreshRequests` and touches nothing else — it records that somebody asked.
      */}
      <td>
        {requestDisabledReason ? (
          <Button
            className={styles.refreshButton}
            data-testid={`ward-capacity-refresh-${row.unit.id}`}
            disabledReason={requestDisabledReason}
          >
            Request update
          </Button>
        ) : (
          <button
            type="button"
            className={styles.refreshButton}
            data-testid={`ward-capacity-refresh-${row.unit.id}`}
            // Once a request is on record the button says so and stops dispatching another one.
            disabled={asked}
            title={asked ? "An update has already been requested from this ward." : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onRequestRefresh();
            }}
          >
            {asked ? "Update requested" : "Request update"}
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * `NETWORK_TABLE_COLUMN_COUNT` matches the eighteen `<th scope="col">` cells declared in
 * `CapacityScreen`'s own `<thead>` above — Ward, Bed kinds, Ready, Locked, Freeing, the three
 * release-stage figures, Discharges due today, Transfers today (decision 8A), Pulled, Closed, Occupied, Gender mix, Specialling, Mental Health Act, Confirmed and
 * Ask for an update. Used only to span an empty-service sentence across the whole row; not read
 * from the `<thead>` at runtime because a Server-Component-shaped table primitive has no DOM to
 * count at render time (see `WardTable`'s own comment on why it cannot measure itself).
 */
const NETWORK_TABLE_COLUMN_COUNT = 18;

/**
 * One health service's rows on the network table, behind a fold — Task 2, Part Two.
 *
 * ⚠️ **WHY THIS IS NOT `BandGroup` (`referral-match.tsx`).** `BandGroup` wraps a `<ul>` in a
 * `<details>`, and `<details>` is not valid inside a `<table>` — a table's children are
 * `<thead>`/`<tbody>`/`<tr>`, so a browser reparents a `<details>` placed there out of the table
 * entirely. The fold control here is instead a native `<button>` inside the group's own header
 * `<tr>`, carrying `aria-expanded`/`aria-controls` — the same shape `ward-board.tsx`'s daily-sheet
 * fold already uses, including pointing `aria-controls` at an id that exists in the DOM whether or
 * not it is currently visible: the body `<tbody>` below is always rendered and hidden by a CSS
 * class when folded, never unmounted, so `aria-controls` never dangles.
 *
 * Four properties carried over from `BandGroup` regardless:
 *   1. The summary row — service name, fold button, ward count, and every column's own total —
 *      renders identically whether the group is open or shut, including for an empty group.
 *   2. Every total in it is computed from THIS group's own rows (`networkServiceGroupTotals`),
 *      never sliced from the network-wide totals.
 *   3. Open state is owned locally by this component's own `useState`.
 *   4. An empty group renders a sentence in place of the fold entirely — never a heading, and
 *      never an empty list — matching `bed-map.tsx`'s own `ServiceGroup` for the same reason: this
 *      counts WARDS, not people, so `WardGroupHeading` (which throws on a count of nought and is
 *      scoped to people) is the wrong primitive here, exactly as it is there.
 *
 * Q004: groups start open to match the ward-table drawing. Folding remains available, and
 * the table grows only to its desktop bound so closing groups never leaves an empty panel.
 */
export function NetworkServiceGroupRows({
  group,
  now,
  activeNetworkFilter,
  selectedUnitId,
  onSelectWard,
  onRequestRefresh,
}: {
  group: NetworkServiceGroup;
  now: Instant;
  activeNetworkFilter: { id: string; predicate: (row: NetworkWardRow) => boolean };
  onRequestRefresh: (unitId: string) => void;
  selectedUnitId?: string;
  onSelectWard: (unitId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const slug = group.service.replace(/\s+/gu, "-");
  const bodyId = `ward-capacity-network-group-body-${slug}`;

  if (group.wards.length === 0) {
    return (
      <tbody data-testid={`ward-capacity-network-group-${slug}`}>
        <tr>
          <td colSpan={NETWORK_TABLE_COLUMN_COUNT} className={styles.networkGroupAbsent}>
            {group.service} has no inpatient unit reporting to this board.
          </td>
        </tr>
      </tbody>
    );
  }

  const totals = networkServiceGroupTotals(group.wards);

  return (
    <>
      <tbody data-testid={`ward-capacity-network-group-${slug}`}>
        <tr className={styles.groupSummaryRow}>
          <th scope="row">
            <button
              type="button"
              className={styles.groupFoldButton}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((wasOpen) => !wasOpen)}
            >
              <span className={styles.foldIcon} aria-hidden="true">
                {open ? "▾" : "▸"}
              </span>
              <span className={styles.groupServiceName}>{group.service}</span>
              <span className={styles.groupWardBadge}>{totals.wards === 1 ? "1 ward" : `${totals.wards} wards`}</span>
              <span className={styles.srOnly}>{open ? "Hide" : "Show"}</span>
            </button>
          </th>
          {/*
            ⚠️ Bed kinds served is a per-ward FACT (which kinds this ward offers), not a quantity —
            summing or listing it here would either be meaningless arithmetic or a duplicate of the
            rows underneath. Stated in words rather than rendered as a number that looks like a total
            and is not (see `networkServiceGroupTotals`'s own doc comment).
          */}
          <td className={styles.groupNoSummary}>By ward</td>
          <td>
            {totals.ready === 0 ? (
              <span className={styles.statedZero}>{countCellText(totals.ready)}</span>
            ) : (
              <span className={styles.readyBadge}>{totals.ready}</span>
            )}
          </td>
          <td>
            {totals.lockedReady === 0 ? (
              <span className={styles.statedZero}>{countCellText(totals.lockedReady)}</span>
            ) : (
              <span className={styles.lockedBadge}>{totals.lockedReady}</span>
            )}
          </td>
          <td>{freeingCellText(totals.freeing)}</td>
          <td>
            {freeingCellText(totals.confirmed)}
            <ConfirmedHeldUpNote confirmed={totals.confirmed} alsoHeldUp={totals.confirmedHeldUp} />
          </td>
          <td>{freeingCellText(totals.expected)}</td>
          <td>{freeingCellText(totals.blocked)}</td>
          <td>{freeingCellText(totals.dischargesDueToday)}</td>
          <td className={styles.groupNoSummary}>Not recorded</td>
          <td>{countCellText(totals.pulled)}</td>
          <td>{countCellText(totals.closed)}</td>
          <td>
            {countCellText(totals.occupied)}
            {totals.surge !== undefined && totals.surge > 0 && (
              <span className={styles.surgeBadge}>+{totals.surge} Surge</span>
            )}
          </td>
          <td>{`Female ${totals.sexMix.Female} · Male ${totals.sexMix.Male}`}</td>
          <td>
            {totals.speciallingFree === undefined
              ? "Not tracked here"
              : `${totals.speciallingFree} of ${totals.speciallingStaffable}`}
          </td>
          {/* A real count against the group's OWN wards ("M of N"), never a bare number that could
           *  be mistaken for a sum of a per-ward true/false flag. */}
          <td>{`${totals.authorised} of ${totals.wards} involuntary-capable`}</td>
          {/* Freshness is a per-ward timestamp and attribution, not a quantity — stated in words for
           *  the same reason bed kinds served is, above. */}
          <td className={styles.groupNoSummary}>By ward</td>
          {/* No group-level "ask every ward in this service to restate its numbers" action exists in
           *  the reducer, and inventing one here would be a capability this task was not asked to
           *  build. Left empty rather than a disabled control implying one exists. */}
          <td />
        </tr>
      </tbody>
      <tbody id={bodyId} data-testid={bodyId} className={open ? undefined : styles.groupBodyClosed}>
        {group.wards.map((row) => (
          <NetworkRow
            key={row.unit.id}
            row={row}
            now={now}
            // `undefined` on "All": nothing is being asked about, so nothing is marked. Every other
            // chip states a real true/false — see `NetworkRow`'s own comment.
            matches={activeNetworkFilter.id === "all" ? undefined : activeNetworkFilter.predicate(row)}
            selected={selectedUnitId === row.unit.id}
            onSelect={() => onSelectWard(row.unit.id)}
            onRequestRefresh={() => onRequestRefresh(row.unit.id)}
          />
        ))}
      </tbody>
    </>
  );
}

/** "(1 also held up)" under a Confirmed count (A16), in the `<small>` the other count notes use. */
function ConfirmedHeldUpNote({
  confirmed,
  alsoHeldUp,
}: {
  confirmed: number | undefined;
  alsoHeldUp: number | undefined;
}) {
  const note = confirmedHeldUpNote(confirmed, alsoHeldUp);
  return note === undefined ? null : (
    <small className={styles.beingMadeReady} data-testid="ward-capacity-network-confirmed-held-up">
      {" "}
      {note}
    </small>
  );
}
