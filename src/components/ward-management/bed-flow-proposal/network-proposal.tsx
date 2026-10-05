"use client";

import { useMemo, useState } from "react";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { BedGrid, BedGridLegend } from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import {
  SERVICE_COLOUR,
  edShort,
  hoursLabel,
  releasesToday,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
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
import { Answer, FactLine, Figures, Section, type Concern } from "./bed-flow-parts";
import { PageHeader } from "./capacity-proposal";
import { STILL_NEEDS_A_BED, stillNeedsABed, useBedFlowProposal } from "./use-bed-flow-proposal";
import styles from "./bed-flow-proposal.module.css";

type View = "overview" | "placement";

/** Shortlist check names, as the coordinator shortlist panel spells them. */
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
 * Proposed Network screen. For a bed flow coordinator: where are people waiting, where are the
 * beds, and who should be placed next? Overview shows every department and every ward at once and
 * can trace one department's referrals onto the wards. Placement shows the pipeline, the queue in
 * the board's own order and one person's shortlist side by side.
 */
export function NetworkProposal({ initialView }: { initialView?: string }) {
  const data = useBedFlowProposal();
  const { wards, network, eds, asAt, open, needing, freeToday } = data;
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
  const fromSelected = edId ? open.filter((movement) => movement.originEdId === edId) : [];
  const tracedNoWard = fromSelected.filter(
    (movement) => movement.referredUnitIds.length === 0 && !movement.acceptedUnitId,
  ).length;

  const concerns: Concern[] = [
    ...ranked
      .filter((ed) => ed.over24h > 0)
      .map((ed) => ({
        tone: "danger" as const,
        label: `${edShort(ed.name)}: ${ed.over24h} waiting over 24 hours`,
      })),
    ...wards
      .filter((ward) => ward.ready === 0)
      .map((ward) => ({ tone: "danger" as const, label: `${ward.unit.name}: no ready bed` })),
  ];

  return (
    <main id="main-content" className={styles.page} data-testid="network-proposal">
      <PageHeader
        title="Network"
        asAt={asAt}
        links={
          <a className={styles.textLink} href="/mockups/ward-flow/capacity/proposal">
            Capacity
          </a>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Network view">
          <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>
            Overview
          </button>
          <button type="button" aria-pressed={view === "placement"} onClick={() => setView("placement")}>
            Placement
          </button>
        </div>
      </div>

      <Answer concerns={view === "overview" ? concerns : []}>
        {open.length === 0 ? (
          <strong>
            Nobody is on an emergency department list. {network.ready} {network.ready === 1 ? "bed is" : "beds are"}{" "}
            ready.
          </strong>
        ) : (
          <>
            <strong>
              {open.length} {open.length === 1 ? "person is" : "people are"} on emergency department lists, and{" "}
              {needing.length} still {needing.length === 1 ? "needs" : "need"} a bed
            </strong>
            . {network.ready} {network.ready === 1 ? "bed is" : "beds are"} ready across the network.{" "}
            {top && top.waiting > 0
              ? `${edShort(top.name)} has the most waiting: ${top.waiting}, the longest for ${hoursLabel(top.longestMinutes)}.`
              : ""}
          </>
        )}
      </Answer>

      <Figures
        label="Network demand and supply"
        items={[
          {
            label: "On ED lists",
            value: open.length,
            note: `${eds.filter((ed) => ed.waiting > 0).length} of ${eds.length} departments`,
          },
          {
            label: "Still need a bed",
            value: needing.length,
            tone: needing.length > network.ready ? "danger" : undefined,
            note: "Requested, in review or accepted",
          },
          { label: "Bed held for them", value: open.length - needing.length, note: "Pulled, handover or moving" },
          { label: "Waiting over 24 hours", value: over24, tone: over24 ? "danger" : undefined },
          { label: "Ready beds", value: network.ready },
          { label: "Free by midnight", value: freeToday, note: "Confirmed and expected" },
        ]}
      />

      {view === "overview" ? (
        <>
          <Section
            title="Emergency department pressure"
            question="Who is waiting where, most first. Select a department to trace its referrals onto the wards."
            meta={`${eds.length} departments`}
            foot={
              <ul className={styles.legendInline}>
                <li>
                  <span className={`${styles.legendKey} ${styles.stackNeed}`} aria-hidden="true" />
                  Still needs a bed
                </li>
                <li>
                  <span className={`${styles.legendKey} ${styles.stackHas}`} aria-hidden="true" />
                  Bed held for them
                </li>
                <li>Each department keeps its own targets, so no shared deadline line is drawn.</li>
              </ul>
            }
          >
            <EdPressure
              rows={ranked}
              movements={open}
              selectedId={edId}
              onSelect={(id) => setEdId((current) => (current === id ? null : id))}
            />
          </Section>

          <Section
            title="Inpatient wards"
            question={
              selectedEd
                ? `Wards that people waiting at ${edShort(selectedEd.name)} have been referred to or accepted by.`
                : "Every ward by health service, one square per bed. Schematic, not geographic."
            }
            meta={
              selectedEd ? (
                <button type="button" className={styles.linkButton} onClick={() => setEdId(null)}>
                  Clear {edShort(selectedEd.name)}
                </button>
              ) : (
                `${wards.length} wards`
              )
            }
            foot={
              <>
                {selectedEd ? (
                  <p className={styles.note}>
                    {fromSelected.length} waiting at {edShort(selectedEd.name)}.{" "}
                    {tracedNoWard
                      ? `${tracedNoWard} ${tracedNoWard === 1 ? "has" : "have"} not been referred to any ward yet. `
                      : ""}
                    A person referred to several wards is counted at each.
                  </p>
                ) : null}
                <BedGridLegend />
              </>
            }
          >
            <div className={styles.services}>
              {HEALTH_SERVICES.map((service) => {
                const own = wards.filter((ward) => ward.service === service);
                if (own.length === 0) return null;
                return (
                  <section key={service} className={styles.service} aria-label={`${service} wards`}>
                    <div className={styles.serviceHead}>
                      <h3 className={styles.serviceName}>
                        <span
                          className={styles.dot}
                          style={{ background: SERVICE_COLOUR[service] }}
                          aria-hidden="true"
                        />
                        {service}
                      </h3>
                      <span className={styles.rowBeds}>{own.reduce((sum, ward) => sum + ward.ready, 0)} ready</span>
                    </div>
                    <ul className={styles.rows}>
                      {own.map((ward) => {
                        const traced = tracedByUnit.get(ward.unit.id) ?? 0;
                        return (
                          <li key={ward.unit.id}>
                            <a
                              href={`/mockups/ward-flow/board/${ward.unit.id}`}
                              className={`${styles.row} ${edId && traced === 0 ? styles.rowDim : ""} ${
                                traced ? styles.rowMatch : ""
                              }`}
                            >
                              <span className={styles.rowHead}>
                                <span className={styles.rowName}>
                                  {ward.ready === 0 ? (
                                    <span className={`${styles.dot} ${styles.dotDanger}`} aria-hidden="true" />
                                  ) : null}
                                  {ward.unit.name}
                                </span>
                                <span className={styles.rowBeds}>{ward.beds} beds</span>
                              </span>
                              <BedGrid figures={ward} size="sm" />
                              <FactLine
                                parts={[
                                  <span key="ready" className={ward.ready === 0 ? styles.dangerText : undefined}>
                                    {ward.ready} ready
                                  </span>,
                                  `${releasesToday(ward.releases)} free today`,
                                  traced ? (
                                    <span key="traced" className={styles.traced}>
                                      {traced} from {edShort(selectedEd?.name ?? "")}
                                    </span>
                                  ) : null,
                                ]}
                              />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </Section>
        </>
      ) : (
        <Placement />
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
                <span className={styles.factLine}>{row.service ?? "No service recorded"}</span>
              </span>
              <span className={styles.stackBar} aria-hidden="true">
                <span className={styles.stackNeed} style={{ width: `${(needs / max) * 100}%` }} />
                <span className={styles.stackHas} style={{ width: `${(has / max) * 100}%` }} />
              </span>
              <span className={styles.edMeta}>
                {row.waiting === 0 ? (
                  <span className={styles.factLine}>No one waiting</span>
                ) : (
                  <>
                    <span className={styles.strongNum}>{row.waiting}</span> waiting · longest{" "}
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

function Placement() {
  const { world, now, open } = useBedFlowProposal();
  const pipeline = queueStageSummaries(world.movements);
  const [stage, setStage] = useState<MovementStage | null>(null);
  const ordered = queueOrder(open, now);
  const queue = stage ? ordered.filter((movement) => movement.stage === stage) : ordered;
  // Open on the first person who still needs a bed: someone with a bed held has no shortlist to weigh.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (ordered.find((movement) => STILL_NEEDS_A_BED.includes(movement.stage)) ?? ordered[0])?.id ?? null,
  );
  const selected = open.find((movement) => movement.id === selectedId);
  const referrals = referralQueueOrder(world.referrals);
  // Short enough for the queue column: "Royal Perth", not "Royal Perth Hospital Emergency Department".
  const edName = (id: string) =>
    edShort(allEmergencyDepartments().find((ed) => ed.id === id)?.name ?? id).replace(
      / (Public Hospital|Hospital|Health Campus|Health Service)$/,
      "",
    );

  return (
    <>
      <section className={styles.stages} aria-label="Movement pipeline">
        {pipeline.waiting.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={styles.stage}
            aria-pressed={stage === entry.id}
            onClick={() => setStage((current) => (current === entry.id ? null : entry.id))}
          >
            <span className={styles.stageLabel}>
              <span
                className={`${styles.legendKey} ${STILL_NEEDS_A_BED.includes(entry.id) ? styles.stackNeed : styles.stackHas}`}
                aria-hidden="true"
              />
              {entry.label}
            </span>
            <span className={styles.stageValue}>{entry.count}</span>
          </button>
        ))}
        <div className={`${styles.stage} ${styles.stageLeft}`}>
          <span className={styles.stageLabel}>Left the pathway</span>
          <span className={styles.stageValue}>{pipeline.left.total}</span>
          <span className={styles.factLine}>
            {pipeline.left.arrived} arrived · {pipeline.left.didNotProceed} did not proceed
          </span>
        </div>
      </section>

      <div className={styles.placementLayout}>
        <Section
          title="Priority queue"
          question="Flagged urgent first, then urgency tier, then longest wait. Select a person to see the wards that could take them. An ordering aid, not clinical advice."
          meta={
            stage ? (
              <>
                Showing {queue.length} of {open.length}
                <button type="button" className={styles.linkButton} onClick={() => setStage(null)}>
                  Show everyone
                </button>
              </>
            ) : (
              `${open.length} open`
            )
          }
        >
          {queue.length === 0 ? (
            <p className={styles.note}>Nobody is at this stage.</p>
          ) : (
            <ul className={styles.queue}>
              <li className={styles.queueHead} aria-hidden="true">
                <span>Movement</span>
                <span>Tier · cohort</span>
                <span>Ward</span>
                <span>From · service</span>
                <span>Bed</span>
                <span>Waiting</span>
              </li>
              {queue.map((movement) => (
                <li key={movement.id}>
                  <button
                    type="button"
                    className={styles.queueRow}
                    aria-pressed={movement.id === selectedId}
                    onClick={() => setSelectedId(movement.id)}
                    aria-label={`${movement.id}: ${urgencyTierLabel(movement.urgency)}, ${movement.cohort}, ${movement.security === "Secure" ? "locked" : "open"} ward, at ${edName(movement.originEdId)}, ${STILL_NEEDS_A_BED.includes(movement.stage) ? "needs a bed" : "bed held"}, ${elapsedLabel(movement, now)}`}
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
                      <span>{edName(movement.originEdId)}</span>
                      <span>{movementHealthService(movement) ?? "Service not identified"}</span>
                    </span>
                    <span className={STILL_NEEDS_A_BED.includes(movement.stage) ? undefined : styles.factLine}>
                      {STILL_NEEDS_A_BED.includes(movement.stage) ? "Needs a bed" : "Bed held"}
                    </span>
                    <span className={styles.queueWait}>{elapsedLabel(movement, now).replace(" waiting", "")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className={`${styles.sticky} ${styles.section}`}>
          {selected ? <Shortlist movement={selected} edName={edName(selected.originEdId)} /> : null}
          <Section
            title="Referral queue"
            question="Referrals waiting for a ward's answer."
            meta={`${referrals.length}`}
          >
            <ul className={styles.idList}>
              {referrals.slice(0, 6).map((referral) => (
                <li key={referral.id}>{referral.id}</li>
              ))}
              {referrals.length > 6 ? <li>and {referrals.length - 6} more</li> : null}
            </ul>
            <a className={styles.textLink} href="/mockups/ward-flow/referrals">
              Open the referral board
            </a>
          </Section>
        </div>
      </div>
    </>
  );
}

function Shortlist({ movement, edName }: { movement: Movement; edName: string }) {
  const { world, now } = useBedFlowProposal();
  const candidates = eligibleCandidatesAmong(movement, world.units, now, 3);
  // Every gate any candidate was checked against, so no ward's unmet gate drops out of the table.
  const gates = [...new Set(candidates.flatMap((candidate) => candidate.verdict.gates.map((gate) => gate.gate)))];
  return (
    <Section title={`Shortlist · ${movement.id}`} raised meta={elapsedLabel(movement, now)}>
      <FactLine
        parts={[
          movement.cohort,
          movement.security === "Secure" ? "Locked ward" : "Open ward",
          `From ${edName}`,
          movement.legalStatus,
        ]}
      />
      {candidates.length === 0 ? (
        <p className={styles.note}>No ward of this cohort is on the board.</p>
      ) : (
        <>
          <div className={styles.tableScroll} role="region" aria-label="Shortlist table" tabIndex={0}>
            <table className={`${styles.table} ${styles.gateTable}`}>
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
                    <td key={candidate.unit.id} className={candidate.verdict.eligible ? undefined : styles.notMet}>
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
                          className={!result ? styles.factLine : result.pass ? styles.met : styles.notMet}
                          title={result?.detail}
                        >
                          {!result ? "Not checked" : result.pass ? "Met" : "Not met"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            These are eligibility checks only. The order is not a judgement of clinical suitability. The coordinator
            decides.
          </p>
        </>
      )}
      <div className={styles.actions}>
        <a className={styles.button} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Open movement workspace
        </a>
      </div>
    </Section>
  );
}
