"use client";

import { useMemo, useState } from "react";

import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { getReferralPriority } from "@/components/ward-management/referrals/referral-priority";
import { referralWaitLine } from "@/components/ward-management/referrals/referral-wait";
import { formatInstantWithDay, formatSheetMoment, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { genderReviewNeeded, type Referral } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  candidateAccepts,
  matchReason,
  referralAddressingStateLabel,
  referralCandidates,
  referralDecidedAt,
  referralDestinationLabel,
  referralPersonFactsStatingSex,
  referralState,
  referralSuburbLabel,
} from "@/components/ward-management/ward-referrals";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { headlineFigures, referralBoardFigures, unitRollups } from "./flow-proposal-figures";
import {
  KpiStrip,
  Panel,
  Pill,
  PreviewBar,
  PROPOSAL_ROUTES,
  ProposalHeader,
  Segmented,
  TierBadge,
  Verdict,
  plural,
} from "./flow-proposal-parts";
import styles from "./flow-proposal.module.css";

type View = "waiting" | "accepted" | "declined";

function siteName(code: string): string {
  return siteByCode(code)?.name ?? code;
}

function wardArm(referral: Referral) {
  const arm = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  return arm && arm.destination.kind === "psychiatric_ward"
    ? { addressing: arm, destination: arm.destination }
    : undefined;
}

/**
 * Proposed referral board: the queue answers "who is waiting for a decision, and for how long"
 * before anything else, and the chosen referral lists the wards that can take the person now, with
 * their ready beds. Accepting, declining, overrides and gender placement stay in the current,
 * shared `ReferralMatchView`, reused unchanged and open beneath, so this screen adds no second
 * accept path for the override guard to police.
 */
export function ReferralBoardProposal() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const { referrals, patients = [], movements, dayZero } = world;
  const [view, setView] = useState<View>("waiting");
  const [query, setQuery] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);

  const board = useMemo(() => referralBoardFigures(referrals), [referrals]);
  const headline = headlineFigures(world, now);
  const rollups = useMemo(() => unitRollups(world, now), [world, now]);
  const initials = (referral: Referral) => resolveSubjectPatient(referral, { patients, referrals, movements });

  const listed = { waiting: board.queued, accepted: board.accepted, declined: board.declined }[view];
  const q = query.trim().toLowerCase();
  const shown = q
    ? listed.filter((referral) =>
        [
          referral.id,
          initials(referral).umrn,
          siteName(referral.originSiteCode),
          referral.ageBand,
          referral.homeRegion,
          referralSuburbLabel(referral.suburb),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : listed;
  const selected = shown.find((referral) => referral.id === chosenId) ?? shown[0];

  const oldest = board.oldest;
  const overdue = board.queued.filter((referral) => getReferralPriority(referral, now) === "overdue");

  return (
    <>
      <PreviewBar screen="board" />
      <main id="main-content" className={styles.page} data-testid="flow-proposal-referral-board">
        <ProposalHeader
          crumbs={[{ label: "Care coordination" }, { label: "Referral board" }]}
          title="Referral board"
          asAt={`As at ${formatSheetMoment(now, dayZero)}`}
          actions={
            <a className={styles.buttonQuiet} href={PROPOSAL_ROUTES.intake.href}>
              Make a new referral
            </a>
          }
        />

        <Verdict
          attention={[
            ...(board.tier1 ? [{ tone: "danger" as const, label: `${board.tier1} Tier 1 waiting` }] : []),
            ...(overdue.length
              ? [
                  {
                    tone: "warn" as const,
                    label: `${plural(overdue.length, "referral")} past the service's usual wait`,
                  },
                ]
              : []),
            { tone: "info", label: `${headline.bedsReadyNow} beds ready now`, href: "/mockups/ward-flow/capacity" },
          ]}
        >
          {board.queued.length === 0 ? (
            <strong>No referral is waiting for a decision.</strong>
          ) : (
            <>
              <strong>{plural(board.queued.length, "referral")} waiting for a decision.</strong>{" "}
              {oldest
                ? `The longest has waited ${referralWaitLine(oldest, now).replace(" waiting", "")} (${urgencyTierLabel(oldest.urgency)}). `
                : ""}
              {board.wantsWard} {board.wantsWard === 1 ? "asks" : "ask"} for a ward bed.
            </>
          )}
        </Verdict>

        <KpiStrip
          label="Referral figures"
          items={[
            {
              label: "Waiting for a decision",
              value: board.queued.length,
              note: "Sent, with no ward decision yet",
            },
            {
              label: "Longest wait",
              value: oldest ? splitDuration(now - oldest.raisedAt) : "None",
              note: oldest ? `${initials(oldest).initials} · ${urgencyTierLabel(oldest.urgency)}` : undefined,
            },
            { label: "Ask for a ward bed", value: board.wantsWard, note: `${headline.bedsReadyNow} beds ready now` },
            { label: "Accepted", value: board.accepted.length, note: "All time on this board" },
            { label: "Declined by every destination", value: board.declined.length, note: "All time on this board" },
          ]}
        />

        <div className={styles.workspace}>
          <Panel
            title={view === "waiting" ? "Waiting for a decision" : view === "accepted" ? "Accepted" : "Declined"}
            question={
              view === "waiting" ? "Most urgent tier first, then longest wait." : "Most recently decided first."
            }
            flush
          >
            <div className={styles.panelBody}>
              <div className={styles.toolbar}>
                <Segmented<View>
                  label="Show referrals"
                  value={view}
                  onChange={(next) => {
                    setView(next);
                    setChosenId(null);
                  }}
                  options={[
                    { id: "waiting", label: "Waiting", count: board.queued.length },
                    { id: "accepted", label: "Accepted", count: board.accepted.length },
                    { id: "declined", label: "Declined", count: board.declined.length },
                  ]}
                />
                <input
                  className={styles.search}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search UMRN, hospital, region"
                  aria-label="Search referrals"
                />
              </div>
            </div>
            {shown.length === 0 ? (
              <p className={styles.empty} style={{ margin: "0 1rem 1rem" }}>
                {q ? "No referral matches that search." : "Nothing here right now."}
              </p>
            ) : (
              <ul className={styles.rows} aria-label="Referrals">
                {shown.map((referral) => {
                  const person = initials(referral);
                  const late = view === "waiting" && getReferralPriority(referral, now) === "overdue";
                  const decidedAt = referralDecidedAt(referral);
                  return (
                    <li key={referral.id}>
                      <button
                        type="button"
                        className={styles.row}
                        aria-current={selected?.id === referral.id ? "true" : undefined}
                        onClick={() => setChosenId(referral.id)}
                      >
                        <span className={styles.avatar} aria-hidden="true">
                          {person.initials}
                        </span>
                        <span>
                          <span className={styles.rowTitle} style={{ display: "flex", gap: "0.75rem" }}>
                            <TierBadge urgency={referral.urgency} label={urgencyTierLabel(referral.urgency)} />
                          </span>
                          <span className={styles.rowLine} style={{ display: "block" }}>
                            {referralPersonFactsStatingSex(referral).join(" · ")} · from{" "}
                            {siteName(referral.originSiteCode)}
                          </span>
                          <span className={styles.rowLine} style={{ display: "block" }}>
                            Asked:{" "}
                            {referral.destinations
                              .map((addressing) => referralDestinationLabel(addressing.destination))
                              .join(", ")}
                          </span>
                        </span>
                        <span className={styles.rowAside}>
                          {view === "waiting" ? (
                            <span className={styles.wait}>{splitDuration(now - referral.raisedAt)}</span>
                          ) : (
                            <span className={styles.wait}>
                              {decidedAt !== undefined ? formatInstantWithDay(decidedAt, now) : "Time not recorded"}
                            </span>
                          )}
                          {late ? <Pill tone="warn">Past usual wait</Pill> : null}
                          {view === "accepted" ? <Pill tone="good">Accepted</Pill> : null}
                          {view === "declined" ? <Pill tone="danger">Declined</Pill> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className={styles.sticky}>
            {selected ? (
              <ReferralDetail
                key={selected.id}
                referral={selected}
                rollups={rollups}
                patientInfo={initials(selected)}
              />
            ) : (
              <Panel title="Referral">
                <p className={styles.empty}>Choose a referral to see who can take the person.</p>
              </Panel>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function ReferralDetail({
  referral,
  rollups: unitBeds,
  patientInfo,
}: {
  referral: Referral;
  rollups: ReturnType<typeof unitRollups>;
  patientInfo: ReturnType<typeof resolveSubjectPatient>;
}) {
  const { units, dispatch, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const [decideOpen, setDecideOpen] = useState(false);
  const arm = wardArm(referral);

  function openDecision() {
    setDecideOpen(true);
    requestAnimationFrame(() => document.getElementById(`decide-${referral.id}`)?.scrollIntoView({ block: "start" }));
  }
  const queued = referralState(referral) === "queued";
  const candidates = arm ? referralCandidates(referral, arm.destination, units, now) : [];
  const accepting = candidates
    .filter(candidateAccepts)
    .sort(
      (a, b) =>
        (unitBeds.get(b.unit.id)?.breakdown.availableNow ?? 0) - (unitBeds.get(a.unit.id)?.breakdown.availableNow ?? 0),
    );
  const notAccepting = candidates.filter((candidate) => !candidateAccepts(candidate));
  const needsGenderReview = arm ? genderReviewNeeded(arm.destination.gender, arm.destination.sex) : false;
  const needs = arm
    ? [
        arm.destination.secureBedNeeded ? "Secure bed" : null,
        arm.destination.involuntaryBedNeeded ? "Bed that can hold someone involuntarily" : null,
        arm.destination.highAcuityNursingNeeded ? "High-acuity nursing" : null,
        referral.transportNeeded ? "Transport" : null,
      ].filter((item): item is string => item !== null)
    : [];

  return (
    <Panel
      title="Referral"
      meta={<span className={styles.mono}>{patientInfo.umrn}</span>}
      foot={
        <>
          <span>Raised {formatInstantWithDay(referral.raisedAt, now)}</span>
          <span>{referralWaitLine(referral, now)}</span>
        </>
      }
    >
      <div className={styles.detailHead}>
        <h3 className={styles.detailTitle}>
          <span>
            {patientInfo.initials}
            <span className={styles.rowLine} style={{ display: "block", fontWeight: 500 }}>
              {referralPersonFactsStatingSex(referral).join(" · ")}
            </span>
          </span>
        </h3>
        <TierBadge urgency={referral.urgency} label={urgencyTierLabel(referral.urgency)} />
      </div>

      <dl className={styles.facts} style={{ marginTop: "1rem" }}>
        <div className={styles.fact}>
          <dt>From</dt>
          <dd style={{ fontWeight: 500 }}>{siteName(referral.originSiteCode)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Home region</dt>
          <dd style={{ fontWeight: 500 }}>
            {referral.homeRegion} · {referralSuburbLabel(referral.suburb)}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Needs</dt>
          <dd style={{ fontWeight: 500 }}>
            {needs.length ? needs.join(", ") : arm ? "None of the listed needs" : "Not a ward referral"}
          </dd>
        </div>
      </dl>

      <h4 className={styles.sectionTitle}>Asked of</h4>
      <ul className={styles.checklist}>
        {referral.destinations.map((addressing) => (
          <li key={addressing.destination.kind}>
            <span>{referralDestinationLabel(addressing.destination)}</span>
            <span className={addressing.state === "accepted" ? styles.checkDone : styles.checkTodo}>
              {referralAddressingStateLabel(addressing).replace(/\.$/, "")}
            </span>
          </li>
        ))}
      </ul>

      {arm && queued ? (
        <>
          <h4 className={styles.sectionTitle}>
            Wards that can take this person now · {accepting.length} of {candidates.length}
          </h4>
          {needsGenderReview ? (
            <p className={`${styles.callout} ${styles.calloutWarn}`}>
              Gender or sex is not recorded as female or male. Record the placement check in the full decision tools
              below before accepting.
            </p>
          ) : null}
          {accepting.length ? (
            <ul className={styles.candidates}>
              {accepting.slice(0, 6).map(({ unit }) => {
                const beds = unitBeds.get(unit.id)?.breakdown.availableNow ?? 0;
                return (
                  <li key={unit.id} className={styles.candidate}>
                    <div>
                      <p className={styles.candidateName}>{unit.name}</p>
                      <p className={styles.candidateLine}>
                        {siteName(unit.siteCode)} · {unit.cohort} · {plural(beds, "bed")} ready now
                      </p>
                    </div>
                    <button type="button" className={styles.buttonQuiet} onClick={openDecision}>
                      Decide
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.empty}>No ward can take this person right now. See the reasons below.</p>
          )}
          {accepting.length > 6 ? (
            <p className={styles.note}>{accepting.length - 6} more in the decision tools below.</p>
          ) : null}
          {notAccepting.length ? (
            <details className={styles.disclosure}>
              <summary>Why {plural(notAccepting.length, "ward")} cannot</summary>
              <ul className={styles.checklist}>
                {notAccepting.map((candidate) => (
                  <li key={candidate.unit.id}>
                    <span>{candidate.unit.name}</span>
                    <span className={styles.checkTodo}>{matchReason(candidate)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}

      <details
        className={styles.disclosure}
        id={`decide-${referral.id}`}
        open={decideOpen}
        onToggle={(event) => setDecideOpen(event.currentTarget.open)}
      >
        <summary>Decide: accept, decline or record an override</summary>
        <ReferralMatchView
          referral={referral}
          units={units}
          now={now}
          dispatch={dispatch}
          rejections={rejections}
          patientInfo={patientInfo}
          hideDossierHeader
        />
      </details>
    </Panel>
  );
}
