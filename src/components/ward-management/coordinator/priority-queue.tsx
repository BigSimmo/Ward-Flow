"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  clockState,
  formatElapsed,
  formatInstantWithDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { elapsedLabel } from "@/components/ward-management/ward-derivations";
import { changeReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  ARRIVAL_MODE_LABELS,
  type HealthService,
  type Movement,
  type Referral,
} from "@/components/ward-management/ward-model";
import {
  FORM_TIMING_FACTOR_LABEL,
  operationalScore,
  urgencyTierLabel,
} from "@/components/ward-management/ward-priority";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";

import styles from "./coordinator.module.css";
import shortlistStyles from "./shortlist-panel.module.css";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

type QueueTab = "patients" | "referrals";

/** Order fixed here, not derived — the same reasoning `exception-drawer.tsx`'s own
 *  `REGISTER_TABS` documents: arrow-key order and DOM order both read off this one list. */
const QUEUE_TABS: { id: QueueTab; label: string }[] = [
  { id: "patients", label: "Patients" },
  { id: "referrals", label: "Referrals" },
];

type PriorityQueueProps = {
  movements: Movement[];
  /**
   * Task C2: every referral this coordinator is still working, in the board's own order —
   * `referralQueueOrder` (`ward-referrals.ts`), computed by `coordinator-screen.tsx` and handed
   * down already filtered and sorted. Never re-filtered or re-sorted here: the population is
   * `referralState(referral) === "queued"` and nothing else, and the order is FIFO waiting time
   * (`raisedAt`) with urgency tie-breaking (Decision D-32) — both established elsewhere, neither
   * re-derived in this file.
   *
   * ⚠️ Optional, defaulted to `[]`, purely so `tests/ward-urgent-flag.dom.test.tsx` — which
   * renders this component directly against its own older prop set — keeps compiling and passing
   * unchanged. Every real caller (`coordinator-screen.tsx`) always passes the real queue.
   */
  referralQueue?: Referral[];
  now: Instant;
  /**
   * The configured pull hold (`state.configuration.pullHoldMinutes`). Until 25 Sept 2026 the rows
   * said "4h hold" whatever the configuration was. Defaulted only so the direct-render test keeps
   * its older prop set; `coordinator-screen.tsx` always passes the configured value.
   */
  pullHoldMinutes?: number;
  selectedId: string | undefined;
  onSelect: (movementId: string) => void;
  /** Task C2: the shortlist's OTHER possible subject — see `coordinator-screen.tsx`'s own
   *  comment on why this is independent of `selectedId`/`onSelect` above, never merged with it. */
  selectedReferralId?: string | undefined;
  onSelectReferral?: (referralId: string) => void;
  filterEdId: string | undefined;
  onClearFilter: () => void;
  /**
   * Item 44, build plan task B1 (`docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2
   * "Command: the patients queue ... are scoped ... S2 applies"). `coordinator-screen.tsx`
   * computes every figure against its own unfiltered `movements` (never the ED-filtered or
   * already-scoped `movements` prop above, so the bar's own "of {total}" always states the real
   * whole population) and passes the whole object; `undefined` — every other caller, including
   * `tests/ward-urgent-flag.dom.test.tsx`'s direct render — renders no bar at all, unchanged from
   * before this task.
   */
  serviceScope?: {
    service: HealthService;
    shown: number;
    total: number;
    noRecordedServiceCount: number;
    urgentOutside: { count: number };
  };
};

/*
 * Urgency tier text carries its own direction on every row (Task 5 ruling 2). With 16 tier-1,
 * 13 tier-2 and 12 tier-3 open movements, long runs of the same bare "Tier 1" badge are the
 * normal case and tell a coordinator nothing about which end of the scale that is. Tier 1 is
 * the clinician's most urgent judgement; tier 3 the least. `queueOrder` never lets anything below
 * reorder across a tier boundary — item 37 (2026-09-17) changed what breaks ties inside one tier
 * from the operational score to the wait itself, uncapped; see `queueOrder`'s own doc comment
 * (`ward-priority.ts`).
 *
 * The wording itself now comes from `urgencyTierLabel` (`ward-priority.ts`), which is shared with
 * the referral board and the referral intake form — see that function's own comment for why the
 * local copy this file used to hold was removed.
 */

/**
 * The seven fields this column must carry at a fixed 14rem width (Task 5 ruling 1): movement
 * id, tier badge, elapsed wait, cohort, security, origin department and the operational score.
 * The column stays fixed so Task 6's three-column network diagram keeps its space; the row
 * grows taller instead of the column growing wider — five short lines rather than one cramped
 * one. The origin department renders as `siteCode` (e.g. "RPH"), never `ed.name`, which runs to
 * 50 characters on this fixture and would blow out the column on its own.
 *
 * Task C2 adds a second tab beside this one — Referrals — on the same `role="tablist"` promise
 * `exception-drawer.tsx`'s own registers strip already carries: Left/Right/Home/End move between
 * the two tabs and select as they go, focus follows selection, and only the active tab's own
 * `role="tabpanel"` is exposed to the accessibility tree (the native `hidden` attribute, not a
 * visual-only class — see `.queueList[hidden]` in `coordinator.module.css` for why that needs its
 * own override on this particular class).
 *
 * ⚠️ **SELECTING A TAB DECIDES WHICH LIST IS ON SCREEN, AND NOTHING ELSE** — the drawing's own
 * words, quoted in this task's brief: it never touches which movement or referral the shortlist
 * panel is explaining. `activeTab` is local, private state; `selectedId`/`selectedReferralId` are
 * `coordinator-screen.tsx`'s own state, unaffected by any of the tab logic below.
 */
export function PriorityQueue({
  movements,
  referralQueue = [],
  now,
  selectedId,
  onSelect,
  selectedReferralId,
  onSelectReferral,
  filterEdId,
  onClearFilter,
  serviceScope,
  pullHoldMinutes = defaultWardConfiguration().pullHoldMinutes,
}: PriorityQueueProps) {
  const holdLabel = pullHoldMinutes % 60 === 0 ? `${pullHoldMinutes / 60}h` : splitDuration(pullHoldMinutes);
  const [activeTab, setActiveTab] = useState<QueueTab>("patients");
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const resolvePatientIdentity = usePatientOf();

  // Built once per render rather than called once per row (41 calls) — every row below reads
  // the same fixed department list, so a single lookup map replaces 41 redundant scans.
  const edsById = new Map(allEmergencyDepartments().map((ed) => [ed.id, ed]));
  // A one-line lookup keyed on a field the model already carries (`filterEdId`) — the same
  // reasoning `coordinator-screen.tsx` uses for its own ED lookup — not a derivation that
  // belongs in a ward-*.ts module. If the id it was given cannot be resolved, say so rather than
  // silently dropping the filter notice or naming the wrong department.
  const filterEd = filterEdId ? edsById.get(filterEdId) : undefined;

  const patientsCount = movements.length;
  const referralsCount = referralQueue.length;
  const countFor: Record<QueueTab, number> = { patients: patientsCount, referrals: referralsCount };

  /**
   * Left/Right (and Home/End) move between the two queue tabs and select as they go — mirrors
   * `exception-drawer.tsx`'s own `onTabsKeyDown` exactly: moving costs nothing, so a second
   * keypress to confirm would only be slower than the mouse.
   */
  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = QUEUE_TABS.map((tab) => tab.id);
    const current = order.indexOf(activeTab);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % order.length;
    if (event.key === "ArrowLeft") next = (current - 1 + order.length) % order.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = order.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = order[next];
    if (target === undefined) return;
    setActiveTab(target);
    // Focus follows selection, so the next arrow key continues from where the reader just landed.
    const el = event.currentTarget.querySelector<HTMLButtonElement>(`[data-queue-tab="${target}"]`);
    el?.focus();
  }

  return (
    <section className={styles.queueRegion} aria-label="Priority queue">
      <header className={styles.regionHeader}>
        <h2>Priority queue</h2>
        {/* The header's own total belongs to whichever list is actually on screen — a coordinator
            switching to Referrals must not go on reading the Patients count as if it still
            described what is now showing. Absence and zero (rule 2): "none", never a bare "0". */}
        <span className={`${styles.regionCount} ${shortlistStyles.tabularNum}`}>
          {activeTab === "referrals"
            ? `${referralsCount === 0 ? "none" : referralsCount} awaiting a decision`
            : `${patientsCount === 0 ? "none" : patientsCount} open movements`}
        </span>
        {/* The ED filter is a Patients-tab concept — a referral carries no ED-origin filter of its
            own, and Q-2 forbids filtering referrals by location at all. Hidden on the Referrals
            tab rather than left showing a notice for a filter that tab does not apply. */}
        {activeTab === "patients" && filterEdId ? (
          <p className={styles.filterNotice}>
            <span>
              {filterEd ? `Filtered to ${filterEd.siteCode} — ${filterEd.name}` : "Filtered — department unavailable"}
            </span>
            <button
              type="button"
              className={`${styles.clearSelectionButton} ${shortlistStyles.triageControlTouch}`}
              onClick={onClearFilter}
            >
              Clear filter
            </button>
          </p>
        ) : null}
      </header>

      {/* Item 44, task B1, "S2 applies": only the Patients-tab population (`movements`, a
       *  `Movement[]`) has an "urgent outside" figure at all — a referral carries no legal form
       *  and no `flaggedUrgent`, so this bar reports against that tab regardless of which tab is
       *  currently active, the same way the header's own total switches with `activeTab` but this
       *  narrowing fact does not. */}
      {serviceScope ? (
        <WardServiceScopeBar
          service={serviceScope.service}
          shown={serviceScope.shown}
          total={serviceScope.total}
          noun="movements"
          noRecordedServiceCount={serviceScope.noRecordedServiceCount}
          urgentOutside={serviceScope.urgentOutside}
        />
      ) : null}

      <div className={styles.queueTabs} role="tablist" aria-label="Queues" onKeyDown={onTabsKeyDown}>
        {QUEUE_TABS.map((tab) => {
          const count = countFor[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`ward-queue-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`ward-queue-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              data-queue-tab={tab.id}
              className={`${activeTab === tab.id ? styles.queueTabActive : styles.queueTab} ${shortlistStyles.triageControlTouch}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {/* Absence and zero (rule 2): "none", never a bare "0" — the same wording
                  `delays-screen.tsx`'s own tab counts already use. */}
              {tab.label}{" "}
              <span className={`${styles.queueTabCount} ${shortlistStyles.tabularNum}`}>
                {count === 0 ? "none" : count}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        Neither panel is `<ul>/<li>` any more (Task C2) — the drawing's own resolved shape, and
        for the same reason it gives: "a list item may not sit inside an element whose role is
        not a list", and `role="tabpanel"` is not `role="list"`. `.queueList`'s `display: grid`
        lays the rows out identically either way; only the wrapping element changed.
       */}
      <div
        role="tabpanel"
        id="ward-queue-panel-patients"
        aria-label="Patients"
        tabIndex={0}
        hidden={activeTab !== "patients"}
        className={styles.queueList}
      >
        {movements.length === 0 ? (
          <p className={styles.placeholder}>No open movements in the priority queue.</p>
        ) : (
          movements.map((movement) => {
            const selected = movement.id === selectedId;
            // Same one-line lookup reasoning as `filterEd` above, keyed on
            // `Movement.originEdId`. An unresolved id renders as an explicit absence, never a
            // substituted department (Task 5 ruling 1).
            const originEd = edsById.get(movement.originEdId);
            // Unlabelled, "Secure · JHC" reads as a destination on a screen whose whole purpose is
            // finding one — JHC is where the patient currently is, not where they are going
            // (display-honesty rule; Task 5 review Minor 5). "from" makes the direction explicit.
            const originLabel = originEd ? `from ${originEd.siteCode}` : "from an unknown ED";
            const { score, factors } = operationalScore(movement, now);
            // `clockState` (not the presence of a factor) is the source of truth for "is this
            // breached" — the factor list is scoped to Task 7's expandable shortlist, not this
            // row, but a breached statutory deadline is the one thing this row must never let a
            // coordinator miss, so it always renders here regardless of what Task 7 later shows.
            // A form with no `dueAt` is never breached — `undefined` must never reach
            // `clockState`'s arithmetic. As of the 2026-08-23 product-owner correction, neither a
            // Form 1A nor a Form 3B carries one any longer (Task 6A first established this for 3B;
            // see `LegalForm`'s doc comment in ward-model.ts) — only the transport/transfer forms
            // (4A/4C) still do, and none of those are due in the past on today's fixture, so
            // `legalBreached` below is false today.
            const legalDueAt = movement.legalForm?.dueAt;
            const legalBreached = legalDueAt !== undefined && clockState(legalDueAt, now) === "breached";
            const legalFactor = factors.find((factor) => factor.label === FORM_TIMING_FACTOR_LABEL);
            // Item 37 (2026-09-17): queueOrder's tie-break inside a tier is the wait itself,
            // uncapped — no longer operationalScore. Exposed on the row the same way `score`
            // already is (as `data-wait` below), so a Playwright spec can assert the property off
            // the record rather than off a hard-coded fixture value.
            const waitedMinutes = Math.max(0, now - movement.openedAt);

            return (
              <button
                key={movement.id}
                type="button"
                data-testid={`ward-queue-row-${movement.id}`}
                data-origin-ed={movement.originEdId}
                data-score={score}
                data-wait={waitedMinutes}
                className={`${selected ? styles.queueRowSelected : styles.queueRow} ${shortlistStyles.queueRowTouch}`}
                aria-pressed={selected}
                onClick={() => onSelect(movement.id)}
              >
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                <strong className={shortlistStyles.tabularNum}>{resolvePatientIdentity(movement).formalName}</strong>
                {/* The urgent flag, shown where the ordering is read. The owner asked for two
                    things — that it sorts to the top and that it is VISIBLE — and a row that leads
                    the queue for a reason the screen does not state is the worse half of that: a
                    coordinator would see a tier-3 patient with the shortest wait at the top and
                    have nothing to explain it. */}
                {movement.flaggedUrgent ? (
                  <span
                    className={`${styles.queueFlag} ${shortlistStyles.queueFlagHighContrast}`}
                    data-testid={`ward-queue-flag-${movement.id}`}
                  >
                    Flagged urgent
                  </span>
                ) : null}
                {/* Item 37 (2026-09-17), widened by the review fix-forward (item 5): who flagged
                    this, when, and why — or an honest admission that none of it was recorded.
                    `movement.urgentFlag` is only ever absent on a movement flagged before this
                    field existed (the fixture's own WF-018) — every flag raised through
                    FLAG_MOVEMENT_URGENT now carries it. The role renders through
                    WARD_FLOW_ROLE_LABELS ("Flow coordinator", never the bare "coordinator") and
                    the reason through changeReasonLabels, the same lookup the reason picker itself
                    uses. */}
                {movement.flaggedUrgent ? (
                  <span className={styles.queueFlagDetail} data-testid={`ward-queue-flag-detail-${movement.id}`}>
                    {movement.urgentFlag
                      ? `Flagged urgent by ${WARD_FLOW_ROLE_LABELS[movement.urgentFlag.by]} at ${formatInstantWithDay(movement.urgentFlag.at, now)}: ${changeReasonLabels[movement.urgentFlag.reason]}.`
                      : "Who flagged this, when and why was not recorded."}
                  </span>
                ) : null}
                <span
                  data-ward-type-floor="command-tier"
                  className={`${styles.queueTier} ${shortlistStyles.queueTier}`}
                  data-tier={movement.urgency}
                >
                  {urgencyTierLabel(movement.urgency)}
                </span>
                <span className={shortlistStyles.tabularNum}>{elapsedLabel(movement, now)}</span>
                <span>
                  {movement.cohort} · {movement.security} · {originLabel}
                </span>
                {/* Labelled "Operational" — this is how badly the movement is going
                    operationally, never a restatement of clinical severity, acuity or risk. */}
                <span
                  data-ward-type-floor="command-score"
                  className={`${styles.queueScore} ${shortlistStyles.tabularNum}`}
                >
                  Operational {score}
                </span>
                {legalBreached ? (
                  <span className={styles.queueLegalBreach}>
                    {legalFactor ? legalFactor.detail : "Form due time passed"}
                  </span>
                ) : null}
                {legalBreached ? <LegalLimitsNotChecked variant="tag" /> : null}
                {movement.arrivalDetails ? (
                  movement.arrivalDetails.estimatedArrivalAt !== undefined ? (
                    now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES ? (
                      <span
                        className={styles.queueTransitOverdue}
                        data-testid={"ward-queue-transit-overdue-" + movement.id}
                      >
                        ⚠ Overdue ETA (+{Math.floor((now - movement.arrivalDetails.estimatedArrivalAt) / 60)}h) ·{" "}
                        {movement.arrivalDetails.modeOfArrival ??
                          (movement.arrivalDetails.mode
                            ? (ARRIVAL_MODE_LABELS[movement.arrivalDetails.mode] ?? movement.arrivalDetails.mode)
                            : "Transit")}
                      </span>
                    ) : (
                      <span className={styles.queueTransitEta} data-testid={"ward-queue-transit-eta-" + movement.id}>
                        ⏱ ETA in {Math.max(0, movement.arrivalDetails.estimatedArrivalAt - now)}m ·{" "}
                        {movement.arrivalDetails.modeOfArrival ??
                          (movement.arrivalDetails.mode
                            ? (ARRIVAL_MODE_LABELS[movement.arrivalDetails.mode] ?? movement.arrivalDetails.mode)
                            : "Transit")}
                      </span>
                    )
                  ) : (
                    <span className={styles.queueTransitEta} data-testid={"ward-queue-transit-eta-" + movement.id}>
                      ⏱ Transit: {holdLabel} hold (
                      {movement.arrivalDetails.modeOfArrival ??
                        (movement.arrivalDetails.mode
                          ? (ARRIVAL_MODE_LABELS[movement.arrivalDetails.mode] ?? movement.arrivalDetails.mode)
                          : "Transit")}
                      )
                    </span>
                  )
                ) : movement.stage === "pulled" ? (
                  <span className={styles.queueTransitHold} data-testid={"ward-queue-transit-hold-" + movement.id}>
                    ⏱ Pulled · {holdLabel} hold clock active
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/*
        Task C2: the referral queue. `referralQueueOrder` already scoped this to `"queued"` and
        sorted it urgency-then-`raisedAt` before it reached this component — see the prop's own
        comment above. 🔴 A referral names no ward: no "referred to", no ward column, no back-link
        to a unit renders here or in the placement panel this row opens
        (`ShortlistPanel`'s `ReferralPlacementPanel`) — `Movement.acceptedUnitId` is the only place
        a destination attaches, and a referral is not one of those yet.
       */}
      <div
        role="tabpanel"
        id="ward-queue-panel-referrals"
        aria-label="Referrals"
        tabIndex={0}
        hidden={activeTab !== "referrals"}
        className={styles.queueList}
      >
        {referralQueue.length === 0 ? (
          <p className={styles.placeholder}>No referrals awaiting a decision.</p>
        ) : (
          referralQueue.map((referral) => {
            const selected = referral.id === selectedReferralId;
            // Elapsed since the referral was raised — the same `formatElapsed` helper
            // `elapsedLabel` above wraps for a movement, applied directly here since a referral
            // carries no movement to derive it through.
            const waitingLabel = formatElapsed(Math.max(now - referral.raisedAt, 0));

            return (
              <button
                key={referral.id}
                type="button"
                data-testid={`ward-referral-row-${referral.id}`}
                className={`${selected ? styles.queueRowSelected : styles.queueRow} ${shortlistStyles.queueRowTouch}`}
                aria-pressed={selected}
                onClick={() => onSelectReferral?.(referral.id)}
              >
                <strong className={shortlistStyles.tabularNum}>{referral.id}</strong>
                <span className={`${styles.queueTier} ${shortlistStyles.queueTier}`} data-tier={referral.urgency}>
                  {urgencyTierLabel(referral.urgency)}
                </span>
                <span className={shortlistStyles.tabularNum}>{waitingLabel}</span>
                {/* The sending team is appended through the shared helper, never formatted here —
                    one wording decision, three render sites. "from" already belongs to the SITE. */}
                <span>
                  {withSendingTeam(
                    `${referral.ageBand} · ${referral.homeRegion} · from ${referral.originSiteCode}`,
                    referral,
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
