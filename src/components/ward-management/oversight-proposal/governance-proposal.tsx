"use client";

import { useState } from "react";

import { movementHref } from "@/components/ward-management/shell/ward-facade";
import type { AuditEvent, AuditReview } from "@/components/ward-management/ward-audit";
import { formatInstantWithDay, formatSheetMoment } from "@/components/ward-management/ward-clock";
import {
  allOverrides,
  changeAudit,
  effectivenessNumbers,
  MINIMUM_EFFECTIVENESS_SAMPLE,
  type ChangeAuditEntry,
  type EffectivenessMeasure,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import {
  KpiStrip,
  Panel,
  Pill,
  ProposalHeader,
  ProposalPreviewBar,
  Segmented,
  Verdict,
  type Attention,
  type Tone,
} from "./oversight-proposal-parts";
import styles from "./oversight-proposal.module.css";

const ACTOR = { role: "coordinator" } as const;

const CATEGORY: Record<AuditEvent["category"], string> = {
  referral: "Referral",
  override: "Override",
  "legal-status": "Legal status",
  "legal-form": "Legal form",
  discharge: "Discharge",
  "record-access": "Record opened",
  review: "Review",
  configuration: "Settings change",
};

const OUTCOME: Record<AuditEvent["outcome"], { label: string; tone: Tone }> = {
  accepted: { label: "Accepted", tone: "good" },
  partial: { label: "Partly accepted", tone: "warn" },
  denied: { label: "Refused", tone: "danger" },
  stale: { label: "Stale request", tone: "warn" },
};

const CHANGE_KIND: Record<ChangeAuditEntry["kind"], string> = {
  urgency: "Urgency changed",
  legal_status: "Legal status changed",
  pull_released: "Pulled bed released",
  transport_cancelled: "Transport cancelled",
  stage_corrected: "Stage corrected",
  acceptance_withdrawn: "Acceptance withdrawn",
};

type ReviewState = "unreviewed" | AuditReview["decision"];
type QueueFilter = "waiting" | "follow-up-required" | "all";

const REVIEW: Record<ReviewState, { label: string; tone: Tone }> = {
  unreviewed: { label: "Waiting for review", tone: "quiet" },
  reviewed: { label: "Reviewed", tone: "good" },
  "follow-up-required": { label: "Follow-up required", tone: "warn" },
};

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function GovernanceProposal() {
  const flow = useWardFlow();
  const now = useWardFlowClock();
  const patientOf = usePatientOf();
  const [filter, setFilter] = useState<QueueFilter>("waiting");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const eventRead = flow.readAuditEvents(ACTOR);
  const reviewRead = flow.readAuditReviews(ACTOR);
  const readable = eventRead.status === "allowed" && reviewRead.status === "allowed";
  const events = eventRead.status === "allowed" ? eventRead.value : [];
  const reviews = reviewRead.status === "allowed" ? reviewRead.value : [];
  const reviewable = events.filter((event) => event.category !== "review");

  const historyOf = (event: AuditEvent) =>
    reviews.filter((review) => review.eventId === event.id && review.generation === event.generation);
  const stateOf = (event: AuditEvent): ReviewState => historyOf(event).at(-1)?.decision ?? "unreviewed";

  const waiting = reviewable.filter((event) => stateOf(event) === "unreviewed");
  const followUp = reviewable.filter((event) => stateOf(event) === "follow-up-required");
  const overrides = allOverrides(flow.movements).sort((a, b) => b.override.at - a.override.at);
  const changes = changeAudit(flow.movements).sort((a, b) => b.at - a.at);
  const effectiveness = effectivenessNumbers(flow.movements);

  const queue = [
    ...(filter === "waiting" ? waiting : filter === "follow-up-required" ? followUp : reviewable),
  ].reverse();
  const selected = queue.find((event) => event.id === selectedId) ?? queue[0] ?? null;
  const subjectName = (event: AuditEvent) => {
    const subject = event.subject;
    if (subject.kind === "movement") return patientOf({ movementId: subject.movementId }).displayName;
    if (subject.kind === "admission") return subject.admissionId;
    if (subject.kind === "referral") return subject.referralId;
    if (subject.kind === "bed-release") return subject.releaseId;
    if (subject.kind === "configuration") return "Settings";
    return "Record not linked";
  };

  function review(decision: AuditReview["decision"]) {
    if (!selected || selected.generation !== flow.worldGeneration) return;
    flow.dispatch({
      type: "REVIEW_AUDIT_EVENT",
      role: "coordinator",
      now,
      eventId: selected.id,
      expectedGeneration: selected.generation,
      expectedReviewCount: historyOf(selected).length,
      decision,
    });
  }

  const attention: Attention[] = [];
  if (waiting.length > 0)
    attention.push({ tone: "quiet", label: `${plural(waiting.length, "action")} waiting for review` });
  if (followUp.length > 0) attention.push({ tone: "warn", label: `${followUp.length} marked for follow-up` });
  if (overrides.length > 0)
    attention.push({ tone: "accent", label: `${plural(overrides.length, "override")} recorded on movements` });
  if (changes.length > 0) attention.push({ tone: "quiet", label: `${plural(changes.length, "change")} to movements` });

  return (
    <>
      <ProposalPreviewBar active="governance" />
      <main id="main-content" className={styles.page} data-testid="governance-proposal">
        <ProposalHeader
          crumb="Oversight"
          title="Governance"
          subtitle="Who changed what in this session, and what still needs a review."
          asAt={`As at ${formatSheetMoment(now, flow.dayZero)}`}
        />

        <Verdict attention={attention}>
          {!readable ? (
            <>The audit record cannot be read for this role, so nothing here can be counted.</>
          ) : waiting.length === 0 ? (
            <>
              <strong>Nothing is waiting for a review.</strong>{" "}
              {reviewable.length === 0
                ? changes.length > 0
                  ? `No action has been recorded in this session yet. The ${plural(changes.length, "change")} to movements below came with the sample data.`
                  : "No action has been recorded in this session yet."
                : `All ${plural(reviewable.length, "recorded action")} have a review.`}
            </>
          ) : (
            <>
              <strong>
                {plural(waiting.length, "recorded action")} {waiting.length === 1 ? "needs" : "need"} a review.
              </strong>{" "}
              {waiting.length > 1 ? "The oldest is at the bottom of the queue below." : "It is selected below."}
            </>
          )}
        </Verdict>

        <KpiStrip
          label="Governance figures"
          items={[
            {
              label: "Waiting for review",
              value: waiting.length,
              tone: undefined,
              note: "Recorded actions with no review yet",
              pressed: filter === "waiting",
              onPress: () => setFilter("waiting"),
            },
            {
              label: "Follow-up required",
              value: followUp.length,
              tone: followUp.length > 0 ? "warn" : undefined,
              note: "A reviewer asked for more",
              pressed: filter === "follow-up-required",
              onPress: () => setFilter("follow-up-required"),
            },
            {
              label: "Recorded this session",
              value: reviewable.length,
              note: "Every action, accepted or refused",
              pressed: filter === "all",
              onPress: () => setFilter("all"),
            },
            { label: "Overrides", value: overrides.length, note: "On movements, with a recorded reason" },
            { label: "Changes", value: changes.length, note: "Legal status, urgency, stage and pulled beds" },
          ]}
        />

        <div className={styles.grid2}>
          <Panel
            title="Review queue"
            question="Every action recorded this session, newest first. Select one to review it."
            meta={
              <Segmented
                label="Show"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "waiting", label: `Waiting (${waiting.length})` },
                  { value: "follow-up-required", label: `Follow-up (${followUp.length})` },
                  { value: "all", label: `All (${reviewable.length})` },
                ]}
              />
            }
            flush
          >
            {queue.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.empty}>
                  {reviewable.length === 0
                    ? "Nothing has been recorded yet. Referrals, overrides, legal status and form changes, discharges and settings changes appear here as people make them."
                    : filter === "waiting"
                      ? "Every recorded action has a review."
                      : "No action is marked for follow-up."}
                </p>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Action</th>
                      <th scope="col">About</th>
                      <th scope="col">Result</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((event) => {
                      const state = stateOf(event);
                      return (
                        <tr key={event.id} aria-selected={selected?.id === event.id}>
                          <td className={styles.mono}>
                            {event.at === null ? "Not recorded" : formatInstantWithDay(event.at, now)}
                          </td>
                          <td>
                            <button type="button" className={styles.rowButton} onClick={() => setSelectedId(event.id)}>
                              {CATEGORY[event.category]}
                            </button>
                          </td>
                          <td>{subjectName(event)}</td>
                          <td>
                            <Pill tone={OUTCOME[event.outcome].tone}>{OUTCOME[event.outcome].label}</Pill>
                          </td>
                          <td>
                            <Pill tone={REVIEW[state].tone}>{REVIEW[state].label}</Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Selected action" question={selected ? CATEGORY[selected.category] : "Nothing selected"}>
            {selected ? (
              <div className={styles.stack}>
                <dl className={styles.detail}>
                  <dt>When</dt>
                  <dd>{selected.at === null ? "Not recorded" : formatInstantWithDay(selected.at, now)}</dd>
                  <dt>About</dt>
                  <dd>
                    {selected.subject.kind === "movement" ? (
                      <a className={styles.link} href={movementHref(selected.subject.movementId)}>
                        {subjectName(selected)}
                      </a>
                    ) : (
                      subjectName(selected)
                    )}
                  </dd>
                  <dt>By</dt>
                  <dd>{selected.actor.role ? WARD_FLOW_ROLE_LABELS[selected.actor.role] : "Role not recorded"}</dd>
                  <dt>Result</dt>
                  <dd>{OUTCOME[selected.outcome].label}</dd>
                  <dt>Review</dt>
                  <dd>{REVIEW[stateOf(selected)].label}</dd>
                </dl>
                <div className={styles.toolbar}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonPrimary}`}
                    onClick={() => review("reviewed")}
                  >
                    Mark reviewed
                  </button>
                  <button type="button" className={styles.button} onClick={() => review("follow-up-required")}>
                    Needs follow-up
                  </button>
                </div>
                {historyOf(selected).length > 0 ? (
                  <ol className={styles.list} aria-label="Review history">
                    {historyOf(selected).map((entry) => (
                      <li key={entry.id} className={styles.listItem}>
                        <p className={styles.listTitle}>{REVIEW[entry.decision].label}</p>
                        <span className={styles.mono}>{formatInstantWithDay(entry.at, now)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.note}>
                    No review recorded yet. A review records who looked and when; it never changes the action.
                  </p>
                )}
              </div>
            ) : (
              <p className={styles.empty}>Select an action in the queue to see what happened and record a review.</p>
            )}
          </Panel>
        </div>

        <div className={styles.grid2Even}>
          <Panel
            title="Changes to movements"
            question="Legal status, urgency, stage and pulled-bed changes, newest first"
            meta={plural(changes.length, "change")}
            flush
          >
            {changes.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.empty}>No movement has been changed.</p>
              </div>
            ) : (
              <ol className={styles.list}>
                {changes.map((entry, index) => (
                  <li key={`${entry.movementId}-${entry.at}-${index}`} className={styles.listItem}>
                    <div>
                      <p className={styles.listTitle}>
                        {CHANGE_KIND[entry.kind]} ·{" "}
                        <a className={styles.link} href={movementHref(entry.movementId)}>
                          {patientOf({ movementId: entry.movementId }).displayName}
                        </a>
                      </p>
                      <p className={styles.listSub}>
                        {entry.detail} · {entry.by}
                      </p>
                    </div>
                    <span className={styles.mono}>{formatInstantWithDay(entry.at, now)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel
            title="Overrides"
            question="A check overridden by a coordinator, with the recorded reason"
            meta={plural(overrides.length, "override")}
            flush
          >
            {overrides.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.empty}>
                  No override has been recorded. An override appears here the moment a coordinator records one.
                </p>
              </div>
            ) : (
              <ol className={styles.list}>
                {overrides.map(({ movement, override }, index) => (
                  <li key={`${movement.id}-${override.at}-${index}`} className={styles.listItem}>
                    <div>
                      <p className={styles.listTitle}>
                        <a className={styles.link} href={movementHref(movement.id)}>
                          {patientOf({ movementId: movement.id }).displayName}
                        </a>
                      </p>
                      <p className={styles.listSub}>
                        {override.reason} · by {override.by}
                      </p>
                    </div>
                    <span className={styles.mono}>{formatInstantWithDay(override.at, now)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <Panel title="How well placement is working" question="Shown only once enough movements have the fact recorded">
          <dl className={styles.facts}>
            <Measure
              label="Median time to acceptance"
              measure={effectiveness.medianMinutesToAcceptance}
              unit="min"
              population="accepted movements"
            />
            <Measure
              label="Average wards contacted"
              measure={effectiveness.averageUnitsContacted}
              unit="wards"
              population="movements, open and closed"
            />
          </dl>
        </Panel>

        <details className={styles.disclosure}>
          <summary>Why the sample registers are not here</summary>
          <div className={styles.disclosureBody}>
            <p className={styles.note}>
              The current screen also shows fixed sample overrides, decisions, restraint, seclusion and search records
              that are not in this session&apos;s records, so its headline counts disagree with its own register. Every
              figure on this page comes from the session&apos;s recorded actions instead. Whether to keep restrictive
              practice and search registers at all is a product decision.
            </p>
          </div>
        </details>
      </main>
    </>
  );
}

function Measure({
  label,
  measure,
  unit,
  population,
}: {
  label: string;
  measure: EffectivenessMeasure;
  unit: string;
  population: string;
}) {
  const enough = measure.value !== undefined && measure.sampleSize >= MINIMUM_EFFECTIVENESS_SAMPLE;
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>
        {enough ? (
          <span className={styles.mono}>
            {Math.round(measure.value! * 10) / 10} {unit}
          </span>
        ) : (
          "Not enough data yet"
        )}
      </dd>
      <dd className={styles.note}>
        From {measure.sampleSize} of {measure.population} {population}
      </dd>
    </div>
  );
}
