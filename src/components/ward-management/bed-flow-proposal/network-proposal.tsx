"use client";

import { useMemo, useState } from "react";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  BedGrid,
  BedGridLegend,
  KpiStrip,
  Panel,
  ProposalHeader,
  TableScroll,
  Verdict,
  type Attention,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import {
  SERVICE_COLOUR,
  edShort,
  hoursLabel,
  releasesToday,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import stats from "@/components/ward-management/statistics/proposal/statistics-proposal.module.css";
import {
  eligibleCandidatesAmong,
  elapsedLabel,
  movementHealthService,
  queueStageSummaries,
} from "@/components/ward-management/ward-derivations";
import type { EligibilityGate } from "@/components/ward-management/ward-eligibility";
import { HEALTH_SERVICES, type Movement, type MovementStage } from "@/components/ward-management/ward-model";
import { queueOrder, urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import { BedFlowDefinitions } from "./bed-flow-definitions";
import { STILL_NEEDS_A_BED, stillNeedsABed, useBedFlowProposal } from "./use-bed-flow-proposal";
import styles from "./bed-flow-proposal.module.css";

type View = "overview" | "placement";

/** Shortlist gate names, as the coordinator shortlist panel spells them. */
const GATE_LABELS: Record<EligibilityGate, string> = {
  acuity: "Acuity mix",
  age: "Age band",
  allocatable_bed: "Allocatable bed",
  authorisation: "Involuntary-capable",
  capacity_freshness: "Capacity freshness",
  cohort: "Cohort match",
  forensic: "Forensic history",
  legal_status: "Legal status",
  prior_decline: "Prior decline",
  security: "Security level",
  gender_designation: "Gender designation",
  sex_mix: "Sex mix",
  specialling: "Specialling capacity",
};

/**
 * Proposed Network screen. Overview: where people are waiting and where the beds are, every
 * department and every ward visible at once, with one department's referrals traced onto the
 * wards. Placement: the pipeline, the queue and one person's shortlist side by side.
 */
export function NetworkProposal({ initialView }: { initialView?: string }) {
  const data = useBedFlowProposal();
  const { world, wards, network, eds, asAt, open, needing, freeToday } = data;
  const [view, setView] = useState<View>(initialView === "placement" ? "placement" : "overview");
  const [edId, setEdId] = useState<string | null>(null);

  const ranked = [...eds].sort((a, b) => b.waiting - a.waiting || b.longestMinutes - a.longestMinutes);
  const top = ranked[0];
  const over24 = eds.reduce((sum, ed) => sum + ed.over24h, 0);
  const selectedEd = eds.find((ed) => ed.id === edId);

  /** For the chosen department: how many of its open journeys have asked, or been accepted by, each ward. */
  const tracedByUnit = useMemo(() => {
    const counts = new Map<string, number>();
    if (!edId) return counts;
    for (const movement of open) {
      if (movement.originEdId !== edId) continue;
      const asked = new Set([
        ...movement.referredUnitIds,
        ...(movement.acceptedUnitId ? [movement.acceptedUnitId] : []),
      ]);
      for (const unitId of asked) counts.set(unitId, (counts.get(unitId) ?? 0) + 1);
    }
    return counts;
  }, [edId, open]);
  const tracedNoWard = edId
    ? open.filter(
        (movement) => movement.originEdId === edId && movement.referredUnitIds.length === 0 && !movement.acceptedUnitId,
      ).length
    : 0;

  const attention: Attention[] = [
    ...ranked
      .filter((ed) => ed.over24h > 0)
      .map((ed) => ({
        tone: "danger" as const,
        label: `${edShort(ed.name)}: ${ed.over24h} waiting over 24 hours`,
      })),
    ...wards
      .filter((ward) => ward.ready === 0)
      .map((ward) => ({ tone: "warn" as const, label: `${ward.unit.name}: no ready bed` })),
  ];

  return (
    <main id="main-content" className={stats.page} data-testid="network-proposal">
      <ProposalHeader crumbs={[{ label: "Operations" }, { label: "Network" }]} title="Network" asAt={asAt} />
      <div className={styles.headerActions}>
        <div className={stats.segmented} role="group" aria-label="Network view">
          <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>
            Overview
          </button>
          <button type="button" aria-pressed={view === "placement"} onClick={() => setView("placement")}>
            Placement
          </button>
        </div>
        <a className={styles.button} href="/mockups/ward-flow/capacity/proposal">
          Capacity view ›
        </a>
      </div>

      <Verdict attention={view === "overview" ? attention : []}>
        <strong>
          {open.length} people are on emergency department lists, and {needing.length} of them still need a bed
        </strong>
        ; {network.ready} beds are ready across the network.{" "}
        {top
          ? `${edShort(top.name)} has the most waiting (${top.waiting}, longest ${hoursLabel(top.longestMinutes)}).`
          : ""}
      </Verdict>

      <KpiStrip
        label="Network demand and supply"
        items={[
          {
            label: "On ED lists",
            value: open.length,
            note: `${eds.filter((ed) => ed.waiting > 0).length} departments`,
          },
          {
            label: "Still need a bed",
            value: needing.length,
            tone: needing.length > network.ready ? "danger" : undefined,
            note: "requested, in review or accepted",
          },
          { label: "Bed held for them", value: open.length - needing.length, note: "pulled, handover or moving" },
          { label: "Waiting over 24h", value: over24, tone: over24 ? "danger" : undefined },
          { label: "Ready beds", value: network.ready, tone: "good", keyClass: stats.segReady },
          { label: "Free by midnight", value: freeToday, tone: "good", note: "confirmed and expected" },
        ]}
      />

      {view === "overview" ? (
        <>
          <Panel
            title="Emergency department pressure"
            question="Who is waiting where. Select a department to trace its referrals onto the wards below."
            meta={`${eds.length} departments`}
          >
            <EdPressure
              rows={ranked}
              movements={open}
              selectedId={edId}
              onSelect={(id) => setEdId((current) => (current === id ? null : id))}
            />
            <ul className={styles.legendInline}>
              <li>
                <span className={`${styles.legendKey} ${styles.stackNeed}`} aria-hidden="true" />
                Still needs a bed
              </li>
              <li>
                <span className={`${styles.legendKey} ${styles.stackHas}`} aria-hidden="true" />
                Bed held for them
              </li>
              <li>Each department keeps its own targets; no shared deadline scale is drawn.</li>
            </ul>
          </Panel>

          <Panel
            title="Inpatient wards"
            question={
              selectedEd
                ? `Wards that people waiting at ${edShort(selectedEd.name)} have been referred to or accepted by.`
                : "Every ward by health service, one square per bed."
            }
            meta={
              selectedEd ? (
                <button type="button" className={styles.button} onClick={() => setEdId(null)}>
                  Clear {edShort(selectedEd.name)}
                </button>
              ) : (
                `${wards.length} wards · schematic, not geographic`
              )
            }
            foot={
              selectedEd && tracedNoWard ? (
                <span className={stats.rowSub}>
                  {tracedNoWard} {tracedNoWard === 1 ? "person has" : "people have"} not been referred to any ward yet.
                </span>
              ) : undefined
            }
          >
            <div className={styles.services}>
              {HEALTH_SERVICES.map((service) => {
                const own = wards.filter((ward) => ward.service === service);
                if (own.length === 0) return null;
                return (
                  <section key={service} className={styles.serviceStack} aria-label={`${service} wards`}>
                    <div className={stats.serviceHead} style={{ borderBottomColor: SERVICE_COLOUR[service] }}>
                      <h3>{service}</h3>
                      <span className={styles.serviceHeadSub}>
                        {own.reduce((sum, ward) => sum + ward.ready, 0)} ready
                      </span>
                    </div>
                    {own.map((ward) => {
                      const traced = tracedByUnit.get(ward.unit.id) ?? 0;
                      const dim = Boolean(edId) && traced === 0;
                      return (
                        <a
                          key={ward.unit.id}
                          href={`/mockups/ward-flow/board/${ward.unit.id}`}
                          className={`${styles.tile} ${ward.ready === 0 ? styles.tileHot : ""} ${dim ? styles.tileDim : ""} ${
                            traced ? styles.tileMatch : ""
                          }`}
                        >
                          <span className={styles.tileHead}>
                            <span>{ward.unit.name}</span>
                            <span className={styles.tileBeds}>{ward.beds} beds</span>
                          </span>
                          <BedGrid figures={ward} size="sm" />
                          <span className={styles.tileFacts}>
                            <span className={ward.ready === 0 ? styles.dangerText : undefined}>
                              <strong>{ward.ready}</strong> ready
                            </span>
                            <span>
                              <strong>{releasesToday(ward.releases)}</strong> free today
                            </span>
                            {traced ? (
                              <span className={styles.tileBadge}>
                                {traced} from {edShort(selectedEd?.name ?? "")}
                              </span>
                            ) : null}
                          </span>
                        </a>
                      );
                    })}
                  </section>
                );
              })}
            </div>
            <div className={stats.note}>
              <BedGridLegend />
            </div>
          </Panel>
        </>
      ) : (
        <Placement movements={world.movements} />
      )}

      <BedFlowDefinitions />
      <WardPrototypeFooter
        testId="network-proposal-governance"
        note="Synthetic network figures and bed statuses · Not a medical device"
      />
    </main>
  );
}

function EdPressure({
  rows,
  movements,
  selectedId,
  onSelect,
}: {
  rows: ReturnType<typeof useBedFlowProposal>["eds"];
  movements: Movement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const max = Math.max(1, ...rows.map((row) => row.waiting));
  return (
    <ul className={styles.edList}>
      {rows.map((row) => {
        const own = movements.filter((movement) => movement.originEdId === row.id);
        const needs = own.filter(stillNeedsABed).length;
        const has = own.length - needs;
        return (
          <li key={row.id}>
            <button
              type="button"
              className={styles.edRow}
              aria-pressed={row.id === selectedId}
              onClick={() => onSelect(row.id)}
              aria-label={`${row.name}: ${row.waiting} waiting, ${needs} still need a bed, longest ${hoursLabel(row.longestMinutes)}`}
            >
              <span className={styles.edName}>
                {edShort(row.name)}
                <span className={stats.rowSub}>{row.service ?? "No service recorded"}</span>
              </span>
              <span className={styles.stackBar} aria-hidden="true">
                <span className={styles.stackNeed} style={{ width: `${(needs / max) * 100}%` }} />
                <span className={styles.stackHas} style={{ width: `${(has / max) * 100}%` }} />
              </span>
              <span className={styles.edMeta}>
                {row.waiting === 0 ? (
                  <span className={stats.rowSub}>No one waiting</span>
                ) : (
                  <>
                    <strong>{row.waiting}</strong> · longest{" "}
                    <span className={row.over24h ? styles.dangerText : undefined}>
                      {hoursLabel(row.longestMinutes)}
                    </span>
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Placement({ movements }: { movements: Movement[] }) {
  const { world, now, open } = useBedFlowProposal();
  const pipeline = queueStageSummaries(movements);
  const [stage, setStage] = useState<MovementStage | null>(null);
  const ordered = queueOrder(open, now);
  const queue = stage ? ordered.filter((movement) => movement.stage === stage) : ordered;
  const [selectedId, setSelectedId] = useState<string | null>(() => queueOrder(open, now)[0]?.id ?? null);
  const selected = open.find((movement) => movement.id === selectedId);
  const referrals = referralQueueOrder(world.referrals);
  const edName = (id: string) => edShort(allEmergencyDepartments().find((ed) => ed.id === id)?.name ?? id);

  return (
    <>
      <section className={styles.stages} aria-label="Movement pipeline">
        {pipeline.waiting.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`${styles.stage} ${STILL_NEEDS_A_BED.includes(entry.id) ? styles.stageNeeds : styles.stageHas}`}
            aria-pressed={stage === entry.id}
            onClick={() => setStage((current) => (current === entry.id ? null : entry.id))}
          >
            <span className={styles.stageLabel}>{entry.label}</span>
            <span className={styles.stageValue}>{entry.count}</span>
          </button>
        ))}
        <div className={`${styles.stage} ${styles.stageLeft}`}>
          <span className={styles.stageLabel}>Left the pathway</span>
          <span className={styles.stageValue}>{pipeline.left.total}</span>
          <span className={stats.rowSub}>
            {pipeline.left.arrived} arrived · {pipeline.left.didNotProceed} did not proceed
          </span>
        </div>
      </section>

      <div className={styles.placementLayout}>
        <Panel
          title="Priority queue"
          question="Flagged urgent first, then urgency tier, then longest wait. Select a person to see the wards that could take them."
          meta={stage ? `Showing ${queue.length} of ${open.length}` : `${open.length} open`}
          foot={
            stage ? (
              <button type="button" className={styles.button} onClick={() => setStage(null)}>
                Show the whole queue
              </button>
            ) : undefined
          }
          flush
        >
          <ul className={styles.queue}>
            {queue.map((movement) => (
              <li key={movement.id}>
                <button
                  type="button"
                  className={styles.queueRow}
                  aria-pressed={movement.id === selectedId}
                  onClick={() => setSelectedId(movement.id)}
                >
                  <span className={styles.queueId}>{movement.id}</span>
                  <span>
                    <span
                      className={`${styles.tier} ${movement.urgency === 1 ? styles.tier1 : ""}`}
                      title={urgencyTierLabel(movement.urgency)}
                    >
                      {movement.urgency}
                    </span>
                    {movement.cohort === "Older adult" ? "Older" : movement.cohort}
                  </span>
                  <span>{movement.security === "Secure" ? "Locked" : "Open"}</span>
                  <span className={styles.queueEd}>
                    {edName(movement.originEdId)}
                    <span className={stats.rowSub}>
                      {" "}
                      · {movementHealthService(movement) ?? "Service not identified"}
                    </span>
                  </span>
                  <span className={STILL_NEEDS_A_BED.includes(movement.stage) ? undefined : styles.goodText}>
                    {STILL_NEEDS_A_BED.includes(movement.stage) ? "Needs a bed" : "Bed held"}
                  </span>
                  <span className={styles.queueWait}>{elapsedLabel(movement, now).replace(" waiting", "")}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className={`${styles.sticky} ${stats.stack}`}>
          {selected ? <Shortlist movement={selected} edName={edName(selected.originEdId)} /> : null}
          <Panel
            title="Referral queue"
            question="Referrals awaiting a ward's answer."
            meta={`${referrals.length}`}
            foot={
              <a className={stats.link} href="/mockups/ward-flow/referrals">
                Open the referral board ›
              </a>
            }
          >
            <ul className={styles.legendInline} style={{ margin: 0 }}>
              {referrals.slice(0, 6).map((referral) => (
                <li key={referral.id} className={styles.queueId}>
                  {referral.id}
                </li>
              ))}
              {referrals.length > 6 ? <li>and {referrals.length - 6} more</li> : null}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Shortlist({ movement, edName }: { movement: Movement; edName: string }) {
  const { world, now } = useBedFlowProposal();
  const candidates = eligibleCandidatesAmong(movement, world.units, now, 3);
  const gates = candidates[0]?.verdict.gates.map((gate) => gate.gate) ?? [];
  return (
    <Panel
      title={`Shortlist · ${movement.id}`}
      question={`${movement.cohort} · ${movement.security === "Secure" ? "locked" : "open"} ward · from ${edName} · ${movement.legalStatus}`}
      meta={elapsedLabel(movement, now)}
      foot={
        <a className={`${styles.button} ${styles.buttonPrimary}`} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Open movement workspace
        </a>
      }
    >
      {candidates.length === 0 ? (
        <p className={stats.empty}>No ward of this cohort is on the board.</p>
      ) : (
        <>
          <TableScroll label="Shortlist">
            <table className={`${stats.table} ${styles.gateTable}`}>
              <thead>
                <tr>
                  <th>Check</th>
                  {candidates.map((candidate) => (
                    <th key={candidate.unit.id}>{candidate.unit.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>All checks</td>
                  {candidates.map((candidate) => (
                    <td key={candidate.unit.id} className={candidate.verdict.eligible ? styles.pass : styles.fail}>
                      {candidate.verdict.eligible ? "Eligible" : "Not eligible"}
                    </td>
                  ))}
                </tr>
                {gates.map((gate) => (
                  <tr key={gate}>
                    <td>{GATE_LABELS[gate]}</td>
                    {candidates.map((candidate) => {
                      const result = candidate.verdict.gates.find((entry) => entry.gate === gate);
                      return (
                        <td
                          key={candidate.unit.id}
                          className={result?.pass ? styles.pass : styles.fail}
                          title={result?.detail}
                        >
                          {result?.pass ? "Met" : "Not met"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <p className={stats.note}>
            Eligibility checks only. The order is not a judgement of clinical suitability; the coordinator decides.
          </p>
        </>
      )}
    </Panel>
  );
}
