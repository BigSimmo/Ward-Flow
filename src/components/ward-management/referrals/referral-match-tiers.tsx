"use client";

import { Button } from "@/components/wf";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { type BedRelease } from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { formatWardOccupancy, wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { type ReferralCandidate } from "@/components/ward-management/ward-referrals";
import styles from "./referrals.module.css";
import { GATE_LABELS } from "./referral-match-model";
import { checkedGates } from "@/components/ward-management/ward-eligibility";

/*
 * The match view's three tiers (available beds, capacity pending, ineligible units), moved
 * unchanged from `referral-match.tsx`. A render helper rather than a component, so the element
 * tree is exactly what the view rendered before.
 */

/** The tier accordion: every candidate unit, in one of three tiers, each tier collapsible. */
export function renderReferralMatchTiers({
  tier1Candidates,
  tier2Candidates,
  tier3Candidates,
  isTier1Expanded,
  isTier2Expanded,
  isTier3Expanded,
  toggleTier,
  expandedUnitGates,
  toggleGates,
  needsGenderPlacement,
  revealGenderPlacementForm,
  handleAccept,
  admissions,
  bedReleases,
  turnaroundForUnit,
  handleFlagTurnaround,
}: {
  tier1Candidates: ReferralCandidate[];
  tier2Candidates: ReferralCandidate[];
  tier3Candidates: ReferralCandidate[];
  isTier1Expanded: boolean;
  isTier2Expanded: boolean;
  isTier3Expanded: boolean;
  toggleTier: (tier: number) => void;
  expandedUnitGates: Set<string>;
  toggleGates: (id: string) => void;
  needsGenderPlacement: (unitId: string) => boolean;
  revealGenderPlacementForm: (unitId: string) => void;
  handleAccept: (unitId: string) => void;
  admissions: readonly Admission[];
  bedReleases: readonly BedRelease[];
  turnaroundForUnit: (unitId: string) => {
    disabledReason?: string;
    recordedSource?: "cld" | "departure";
  };
  handleFlagTurnaround: (unitId: string) => void;
}) {
  return (
    <div className={styles.tierAccordionGroup} data-testid="ward-referral-tier-accordion-group">
      {/* TIER 1: AVAILABLE BEDS */}
      <div className={styles.tierCard}>
        <button
          type="button"
          className={`${styles.tierCardHeader} ${isTier1Expanded ? styles.tierCardHeaderExpanded : ""}`}
          onClick={() => toggleTier(1)}
          aria-expanded={isTier1Expanded}
          aria-controls="referral-match-tier-1-body"
        >
          <div className={styles.tierCardHeaderLeft}>
            <span
              className={`${styles.tierChevronChip} ${isTier1Expanded ? styles.tierChevronChipExpanded : ""}`}
              aria-hidden="true"
            >
              ▶
            </span>
            <div className={styles.tierTitleGroup}>
              <span className={styles.tierTitleText}>Available beds</span>
              <span className="sr-only">TIER 1: READY TO PLACE NOW (IMMEDIATE CONFIRMED VACANCIES)</span>
              <span className={styles.tierSubtitle}>Immediate confirmed vacancies</span>
            </div>
          </div>
          <div className={styles.tierCardHeaderRight}>
            <span
              className={`${styles.tierCountBadge} ${tier1Candidates.length > 0 ? styles.tierCountBadgeActive : styles.tierCountBadgeZero}`}
            >
              {tier1Candidates.length} {tier1Candidates.length === 1 ? "unit available" : "units available"}
            </span>
          </div>
        </button>

        {isTier1Expanded ? (
          <div id="referral-match-tier-1-body" className={styles.tierBody}>
            {tier1Candidates.length === 0 ? (
              <div className={styles.tierEmptyWell}>
                <span className={styles.tierEmptyIconWrap} aria-hidden="true">
                  ✓
                </span>
                <p className={styles.tierEmptyText}>
                  No units in the network currently meet all clinical criteria with an immediately confirmed allocatable
                  bed.
                </p>
              </div>
            ) : (
              tier1Candidates.map((c) => {
                // Information-only gates (acuity, specialling) are shown but never counted as met.
                const passedGates = checkedGates(c.verdict.gates).filter((g) => g.pass);
                const totalGates = checkedGates(c.verdict.gates).length;
                const gateKey = `alt2-t1-${c.unit.id}`;
                const isGatesExpanded = expandedUnitGates.has(gateKey);
                const freeBeds = c.unit.allocatable.value;
                const bedLabel = freeBeds > 0 ? `${freeBeds} ${freeBeds === 1 ? "bed" : "beds"} ready` : "Bed ready";
                const hospitalName = siteByCode(c.unit.siteCode)?.name ?? c.unit.siteCode;
                // L1 (review 12 Oct 2026): the one occupancy count every page uses, occupied plus pulled.
                const occupancy = wardOccupancy([c.unit], admissions, bedReleases);

                return (
                  <div key={c.unit.id} className={`${styles.unitCard} ${styles.unitCardReady}`}>
                    <div className={styles.unitCardTop}>
                      <div>
                        <div className={styles.unitName}>
                          <span>{c.unit.name}</span>
                          <span className={`${styles.unitStateBadge} ${styles.unitStateReady}`}>{bedLabel}</span>
                        </div>
                        <div className={styles.unitSub}>
                          {hospitalName} · {c.unit.cohort} · Contact not recorded
                        </div>
                      </div>
                      {needsGenderPlacement(c.unit.id) ? (
                        <Button
                          variant="pri"
                          size="md"
                          data-placement-action
                          type="button"
                          data-testid={`ward-referral-match-tier-1-gender-placement-${c.unit.id}`}
                          onClick={() => revealGenderPlacementForm(c.unit.id)}
                        >
                          Check placement at {c.unit.name}
                        </Button>
                      ) : (
                        <Button
                          variant="pri"
                          size="md"
                          data-placement-action
                          type="button"
                          onClick={() => handleAccept(c.unit.id)}
                        >
                          Accept at {c.unit.name}
                        </Button>
                      )}
                    </div>

                    <div className={styles.unitIntelRow}>
                      <span>
                        <strong>Allocatable bed recorded</strong>
                      </span>
                      <span className={styles.demoDot}>·</span>
                      <span>Transit not recorded</span>
                      <span className={styles.demoDot}>·</span>
                      <span>
                        <strong>
                          {occupancy.inUse} of {occupancy.beds}
                        </strong>{" "}
                        beds in use ({formatWardOccupancy(occupancy, "not recorded")})
                      </span>
                    </div>

                    <div className={styles.gateSummary}>
                      <button
                        type="button"
                        className={styles.gateToggle}
                        onClick={() => toggleGates(gateKey)}
                        aria-expanded={isGatesExpanded}
                        aria-controls={`gate-grid-${gateKey}`}
                      >
                        <span>
                          ✓ {passedGates.length} of {totalGates} criteria met
                        </span>
                        <span className={styles.gateToggleHint}>
                          {isGatesExpanded ? "Hide criteria" : "Show criteria"}
                        </span>
                      </button>
                      {isGatesExpanded ? (
                        <div id={`gate-grid-${gateKey}`} className={styles.gateGrid}>
                          {c.verdict.gates.map((g) => (
                            <div
                              key={g.gate}
                              className={g.info ? styles.gatePill : `${styles.gatePill} ${styles.gatePillPassed}`}
                            >
                              {g.info ? "i" : "✓"} {GATE_LABELS[g.gate] ?? g.gate}: {g.detail}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {/* TIER 2: CAPACITY PENDING */}
      <div className={styles.tierCard}>
        <button
          type="button"
          className={`${styles.tierCardHeader} ${isTier2Expanded ? styles.tierCardHeaderExpanded : ""}`}
          onClick={() => toggleTier(2)}
          aria-expanded={isTier2Expanded}
          aria-controls="referral-match-tier-2-body"
        >
          <div className={styles.tierCardHeaderLeft}>
            <span
              className={`${styles.tierChevronChip} ${isTier2Expanded ? styles.tierChevronChipExpanded : ""}`}
              aria-hidden="true"
            >
              ▶
            </span>
            <div className={styles.tierTitleGroup}>
              <span className={styles.tierTitleText}>Capacity pending</span>
              <span className="sr-only">TIER 2: CAPACITY CHECKS OUTSTANDING</span>
              <span className={styles.tierSubtitle}>Outstanding capacity checks</span>
            </div>
          </div>
          <div className={styles.tierCardHeaderRight}>
            <span
              className={`${styles.tierCountBadge} ${tier2Candidates.length > 0 ? styles.tierCountBadgeActive : styles.tierCountBadgeZero}`}
            >
              {tier2Candidates.length} {tier2Candidates.length === 1 ? "unit pending" : "units pending"}
            </span>
          </div>
        </button>

        {isTier2Expanded ? (
          <div id="referral-match-tier-2-body" className={styles.tierBody}>
            {tier2Candidates.length === 0 ? (
              <div className={styles.tierEmptyWell}>
                <span className={styles.tierEmptyIconWrap} aria-hidden="true">
                  ○
                </span>
                <p className={styles.tierEmptyText}>No candidates have capacity checks outstanding.</p>
              </div>
            ) : (
              tier2Candidates.map((c) => {
                const gateKey = `alt2-t2-${c.unit.id}`;
                const isGatesExpanded = expandedUnitGates.has(gateKey);
                const hospitalName = siteByCode(c.unit.siteCode)?.name ?? c.unit.siteCode;
                const turnaround = turnaroundForUnit(c.unit.id);

                return (
                  <div key={c.unit.id} className={`${styles.unitCard} ${styles.unitCardTurnaround}`}>
                    <div className={styles.unitCardTop}>
                      <div>
                        <div className={styles.unitName}>
                          <span>{c.unit.name}</span>
                          <span className={`${styles.unitStateBadge} ${styles.unitStatePending}`}>
                            Capacity unresolved
                          </span>
                        </div>
                        <div className={styles.unitSub}>
                          {hospitalName} · {c.unit.cohort}
                        </div>
                      </div>
                      <div className={styles.unitActionStatusWrap}>
                        <Button
                          variant="sec"
                          size="md"
                          disabledReason={turnaround.disabledReason}
                          onClick={() => handleFlagTurnaround(c.unit.id)}
                        >
                          Flag Turnaround Priority
                        </Button>
                        <span className={styles.unitNoticeMuted}>
                          {turnaround.recordedSource
                            ? `Turnaround preference recorded for ${turnaround.recordedSource === "cld" ? "Criteria-Led Discharge" : "confirmed departure"}; placement still needs confirmation.`
                            : "Records a preference only; placement and transport still need confirmation."}
                        </span>
                      </div>
                    </div>

                    <div className={styles.unitIntelRow}>
                      <span>
                        Recorded capacity checks:{" "}
                        <strong>
                          {c.verdict.gates
                            .filter((gate) => !gate.pass)
                            .map((gate) => `${GATE_LABELS[gate.gate] ?? gate.gate}: ${gate.detail}`)
                            .join(" · ")}
                        </strong>
                      </span>
                    </div>

                    <div className={styles.gateSummary}>
                      <button
                        type="button"
                        className={`${styles.gateToggle} ${styles.gateToggleWarn}`}
                        onClick={() => toggleGates(gateKey)}
                        aria-expanded={isGatesExpanded}
                        aria-controls={`gate-grid-${gateKey}`}
                      >
                        <span>Capacity checks outstanding · other recorded gates passed</span>
                        <span className={styles.gateToggleHint}>
                          {isGatesExpanded ? "Hide criteria" : "Show criteria"}
                        </span>
                      </button>
                      {isGatesExpanded ? (
                        <div id={`gate-grid-${gateKey}`} className={styles.gateGrid}>
                          {c.verdict.gates.map((g) => {
                            const isPending = !g.pass;
                            return (
                              <div
                                key={g.gate}
                                className={
                                  g.info
                                    ? styles.gatePill
                                    : `${styles.gatePill} ${isPending ? styles.gatePillPending : styles.gatePillPassed}`
                                }
                              >
                                {g.info ? "i" : isPending ? "○" : "✓"} {GATE_LABELS[g.gate] ?? g.gate}: {g.detail}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      {/* TIER 3: INELIGIBLE UNITS */}
      <div className={styles.tierCard}>
        <button
          type="button"
          className={`${styles.tierCardHeader} ${isTier3Expanded ? styles.tierCardHeaderExpanded : ""}`}
          onClick={() => toggleTier(3)}
          aria-expanded={isTier3Expanded}
          aria-controls="referral-match-tier-3-body"
        >
          <div className={styles.tierCardHeaderLeft}>
            <span
              className={`${styles.tierChevronChip} ${isTier3Expanded ? styles.tierChevronChipExpanded : ""}`}
              aria-hidden="true"
            >
              ▶
            </span>
            <div className={styles.tierTitleGroup}>
              <span className={styles.tierTitleText}>Ineligible units</span>
              <span className="sr-only">TIER 3: INELIGIBLE CRITERIA EXCLUSIONS & STATUTORY POLICY LOCKOUTS</span>
              <span className={styles.tierSubtitle}>Clinical & policy exclusions</span>
            </div>
          </div>
          <div className={styles.tierCardHeaderRight}>
            <span
              className={`${styles.tierCountBadge} ${tier3Candidates.length > 0 ? styles.tierCountBadgeActive : styles.tierCountBadgeZero}`}
            >
              {tier3Candidates.length} {tier3Candidates.length === 1 ? "unit excluded" : "units excluded"}
            </span>
          </div>
        </button>

        {isTier3Expanded ? (
          <div id="referral-match-tier-3-body" className={styles.tierBody}>
            {tier3Candidates.length === 0 ? (
              <div className={styles.tierEmptyWell}>
                <span className={styles.tierEmptyIconWrap} aria-hidden="true">
                  ✓
                </span>
                <p className={styles.tierEmptyText}>
                  No units in this network are excluded by statutory or cohort criteria.
                </p>
              </div>
            ) : (
              tier3Candidates.map((c) => {
                const gateKey = `alt2-t3-${c.unit.id}`;
                const isGatesExpanded = expandedUnitGates.has(gateKey);
                const failedGates = c.verdict.gates.filter((g) => !g.pass);
                const hospitalName = siteByCode(c.unit.siteCode)?.name ?? c.unit.siteCode;

                return (
                  <div key={c.unit.id} className={`${styles.unitCard} ${styles.unitCardIneligible}`}>
                    <div className={styles.unitCardTop}>
                      <div>
                        <div className={styles.unitName}>
                          <span>{c.unit.name}</span>
                          <span className={`${styles.unitStateBadge} ${styles.unitStateExcluded}`}>
                            Statutory exclusion
                          </span>
                        </div>
                        <div className={styles.unitSub}>
                          {hospitalName} · {c.unit.cohort}
                        </div>
                      </div>
                      <div className={styles.unitActionStatusWrap}>
                        <button
                          type="button"
                          className={styles.btnSubtle}
                          aria-disabled="true"
                          aria-describedby={`clinical-override-unavailable-${c.unit.id}`}
                          title="This clinical override is unavailable. Existing authorised, reason-gated exceptions remain in the ward request workflow."
                          onClick={ignoreUnavailableActivation}
                        >
                          Clinical Override
                        </button>
                        <span id={`clinical-override-unavailable-${c.unit.id}`} className={styles.unitNoticeMuted}>
                          This clinical override is unavailable: reason-gated workflow required
                        </span>
                      </div>
                    </div>

                    <div className={styles.unitIntelRow}>
                      <span>
                        Statutory barrier{" "}
                        <strong>
                          <span className={styles.intelGlyphExcluded}>✕</span>{" "}
                          {failedGates[0]?.detail ?? "Statutory policy restriction"}
                        </strong>
                      </span>
                    </div>

                    <div className={styles.gateSummary}>
                      <button
                        type="button"
                        className={`${styles.gateToggle} ${styles.gateToggleDanger}`}
                        onClick={() => toggleGates(gateKey)}
                        aria-expanded={isGatesExpanded}
                        aria-controls={`gate-grid-${gateKey}`}
                      >
                        <span>
                          ✕ {failedGates.length} of {checkedGates(c.verdict.gates).length} criteria failed
                        </span>
                        <span className={styles.gateToggleHint}>
                          {isGatesExpanded ? "Hide criteria" : "Show criteria"}
                        </span>
                      </button>
                      {isGatesExpanded ? (
                        <div id={`gate-grid-${gateKey}`} className={styles.gateGrid}>
                          {c.verdict.gates.map((g) => (
                            <div
                              key={g.gate}
                              className={
                                g.info
                                  ? styles.gatePill
                                  : `${styles.gatePill} ${g.pass ? styles.gatePillPassed : styles.gatePillFailed}`
                              }
                            >
                              {g.info ? "i" : g.pass ? "✓" : "✕"} {GATE_LABELS[g.gate] ?? g.gate}: {g.detail}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
