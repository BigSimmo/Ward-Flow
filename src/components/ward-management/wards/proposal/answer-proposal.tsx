"use client";

import { useState, type FormEvent } from "react";

import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import { BedBar } from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import { SERVICE_COLOUR, percent } from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { Instant } from "@/components/ward-management/ward-clock";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import {
  GENDER_MISMATCH_DECLINE_REASON,
  WAITLIST_INSTEAD_OF_DECLINE_REASONS,
} from "@/components/ward-management/ward-legal-clock";
import { DECLINE_REASONS, type DeclineReason } from "@/components/ward-management/ward-model";

import { waitedLabel } from "./ward-pages-proposal-figures";
import {
  Answer,
  PageHeader,
  Row,
  Section,
  WardNotFound,
  WardSubnav,
  plural,
  refusalSentence,
  wardPagesHref,
} from "./ward-pages-proposal-parts";
import { useWardPagesProposal } from "./use-ward-pages-proposal";
import styles from "./ward-pages-proposal.module.css";

type Pending = { before: number; movementId: string; done: string };

/** Sex mix never declines a referral; the reducer refuses it, so it is not offered. */
const OFFERED_DECLINE_REASONS = DECLINE_REASONS.filter((value) => value !== GENDER_MISMATCH_DECLINE_REASON);

/**
 * Proposed bed-requests screen (today's "ward answer"). Each request is one row with its two real
 * answers; accepting and declining dispatch the same reducer events the current screen does, and
 * the ward's ready-bed confirmation sits beside them because that is the figure being promised.
 */
export function AnswerProposal({ unitId }: { unitId?: string }) {
  const { ward, detail, asAt, now, world, missing } = useWardPagesProposal(unitId);
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [reason, setReason] = useState<DeclineReason | "">("");
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [override, setOverride] = useState<OverrideReason | "">("");
  const [capacity, setCapacity] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  // The reducer appends a rejection synchronously when it refuses, so the rejection at the index
  // recorded before dispatch is this action's, and only if it names the same request.
  const refused = pending ? world.rejections[pending.before] : undefined;
  const ours = refused && refused.movementId === pending?.movementId ? refused : undefined;
  if (missing) return <WardNotFound />;
  if (!ward || !detail) return <p className={styles.empty}>No wards in this network.</p>;
  const { unit } = ward;
  const { requests, waitlisted } = detail;
  const revision = unit.allocatable.revision ?? 0;
  const message = pending ? (ours ? refusalSentence(ours.reason, unit.name) : pending.done) : null;
  const needsOverride = ours?.reason.includes("override reason") ? ours.movementId : null;

  const accept = (movementId: string, overrideReason?: OverrideReason) => {
    const before = world.rejections.length;
    world.dispatch({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId, unitId: unit.id, overrideReason });
    setOverrideFor(movementId);
    setOverride("");
    setPending({ before, movementId, done: "Accepted in principle. They now wait for a bed here, under Coming in." });
  };

  const decline = (event: FormEvent<HTMLFormElement>, movementId: string) => {
    event.preventDefault();
    if (!reason) return;
    const before = world.rejections.length;
    world.dispatch({ type: "DECLINE", role: "ward", now, movementId, unitId: unit.id, reason });
    setDeclineFor(null);
    setReason("");
    setPending({
      before,
      movementId,
      done: (WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(reason)
        ? "Added to this ward's wait list. The referring team is told there is no bed yet."
        : "Declined. The referring team sees your reason.",
    });
  };

  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = (capacity ?? String(unit.allocatable.value)).trim();
    if (raw === "") return;
    const before = world.rejections.length;
    // The raw number goes to the reducer, which refuses anything that is not a whole number of beds.
    world.dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      value: Number(raw),
      expectedRevision: revision,
    });
    setCapacity(null);
    setPending({ before, movementId: "", done: `Ready beds confirmed for ${unit.name}.` });
  };
  const capacityEmpty = capacity !== null && capacity.trim() === "";

  const recent = world.movements
    .flatMap((movement) => [
      ...(movement.acceptedUnitId === unit.id
        ? [
            {
              key: `${movement.id}-a`,
              movement,
              outcome: "Accepted",
              at: movement.acceptedAt as Instant | undefined,
              reason: null as string | null,
            },
          ]
        : []),
      ...movement.declines
        .filter((entry) => entry.unitId === unit.id)
        .map((entry, index) => ({
          key: `${movement.id}-d${index}`,
          movement,
          outcome: "Declined",
          at: entry.at as Instant | undefined,
          reason: declineReasonLabels[entry.reason] as string | null,
        })),
    ])
    .sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity))
    .slice(0, 8);

  return (
    <main id="main-content" className={styles.page} data-testid="ward-pages-proposal-answer">
      <PageHeader
        crumbs={[
          { label: "Ward Hub", href: wardPagesHref("hub") },
          { label: unit.name, href: wardPagesHref("ward", unit.id) },
          { label: "Bed requests" },
        ]}
        title="Bed requests"
        dotColour={SERVICE_COLOUR[ward.service]}
        subline={`${unit.name} · ${ward.hospital}`}
        asAt={asAt}
      />
      <WardSubnav unitId={unit.id} active="answer" requests={requests.length} beds={unit.beds} />

      <Answer
        attention={
          requests.length && ward.ready === 0
            ? [{ tone: "danger", label: "No ready bed: if you accept, they wait for a bed here" }]
            : []
        }
      >
        {requests.length ? (
          <>
            <strong>
              {plural(requests.length, "request")} {requests.length === 1 ? "is" : "are"} waiting for your answer
            </strong>
            , longest {waitedLabel(Math.max(...requests.map((request) => request.waitedMinutes)))}. You have{" "}
            {plural(ward.ready, "ready bed")}.
          </>
        ) : (
          <>
            <strong>No request is waiting for {unit.name}.</strong> You have {plural(ward.ready, "ready bed")}.
          </>
        )}
      </Answer>

      {message ? (
        <p className={styles.toast} role="status">
          {message}
        </p>
      ) : null}

      <div className={styles.columns}>
        <div className={styles.stack}>
          <Section title="Waiting for your answer" meta={plural(requests.length, "request")}>
            {requests.length ? (
              <ul className={styles.list}>
                {requests.map((request, index) => {
                  const who = world.resolvePatientIdentity(request.movement).initials || "Initials not recorded";
                  return (
                    <li key={request.movementId} className={styles.row}>
                      <div className={styles.rowMain}>
                        <p className={styles.rowTitle}>
                          {request.urgent ? <span className={`${styles.tag} ${styles.dangerText}`}>Urgent</span> : null}
                          {who} · from an emergency department
                        </p>
                        <p className={styles.rowSub}>
                          Waiting {waitedLabel(request.waitedMinutes)} · {request.movement.cohort} ·{" "}
                          {request.movement.security} · {request.sex}
                          {request.movement.specialling ? " · needs one-to-one staffing" : ""}
                        </p>
                      </div>
                      <div className={styles.rowEnd}>
                        <button
                          type="button"
                          className={index === 0 ? styles.primary : styles.secondary}
                          onClick={() => accept(request.movementId)}
                        >
                          Accept in principle
                        </button>
                        <button
                          type="button"
                          className={styles.textButton}
                          aria-expanded={declineFor === request.movementId}
                          onClick={() => setDeclineFor(declineFor === request.movementId ? null : request.movementId)}
                        >
                          Decline
                        </button>
                      </div>
                      {declineFor === request.movementId ? (
                        <form className={styles.declineForm} onSubmit={(event) => decline(event, request.movementId)}>
                          <label>
                            Reason{" "}
                            <select
                              className={styles.select}
                              value={reason}
                              required
                              onChange={(event) => setReason(event.target.value as DeclineReason)}
                            >
                              <option value="">Choose a reason</option>
                              {OFFERED_DECLINE_REASONS.map((value) => (
                                <option key={value} value={value}>
                                  {declineReasonLabels[value]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="submit" className={styles.textButton} disabled={!reason}>
                            Record decline
                          </button>
                        </form>
                      ) : null}
                      {needsOverride === request.movementId && overrideFor === request.movementId ? (
                        <form
                          className={styles.declineForm}
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (override) accept(request.movementId, override);
                          }}
                        >
                          <label>
                            Override reason{" "}
                            <select
                              className={styles.select}
                              value={override}
                              required
                              onChange={(event) => setOverride(event.target.value as OverrideReason)}
                            >
                              <option value="">Choose a reason</option>
                              {OVERRIDE_REASONS.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="submit" className={styles.textButton} disabled={!override}>
                            Accept with this reason
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.empty}>
                Nothing to answer. New requests from emergency departments appear here with how long they have waited.
              </p>
            )}
          </Section>

          <Section title="On your wait list" meta={plural(waitlisted.length, "person", "people")}>
            {waitlisted.length ? (
              <ul className={styles.list}>
                {waitlisted.map((request) => (
                  <Row
                    key={request.movementId}
                    title={`${world.resolvePatientIdentity(request.movement).initials || "Initials not recorded"} · from an emergency department`}
                    sub={`No bed yet · waiting ${waitedLabel(request.waitedMinutes)}`}
                    end={
                      <button type="button" className={styles.textButton} onClick={() => accept(request.movementId)}>
                        Accept in principle
                      </button>
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>Nobody is waiting on this ward for a bed.</p>
            )}
          </Section>

          <Section title="Recent answers" meta="this ward, newest first">
            {recent.length ? (
              <ul className={styles.list}>
                {recent.map((entry) => (
                  <Row
                    key={entry.key}
                    title={
                      <>
                        <span className={`${styles.tag} ${entry.outcome === "Declined" ? "" : styles.goodText}`}>
                          {entry.outcome}
                        </span>
                        {world.resolvePatientIdentity(entry.movement).initials || "Initials not recorded"}
                      </>
                    }
                    sub={entry.reason ?? "Accepted by this ward"}
                    end={
                      <span className={styles.rowTime}>
                        {entry.at !== undefined ? formatInstantWithDay(entry.at, now) : "Time not recorded"}
                      </span>
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>This ward has not answered a request yet.</p>
            )}
          </Section>
        </div>

        <div className={styles.stack}>
          <Section title="What you can offer" sheet>
            <BedBar figures={ward} large />
            <dl className={styles.factList}>
              <dt>Ready</dt>
              <dd className={`${styles.num} ${ward.ready === 0 ? styles.dangerText : styles.goodText}`}>
                {ward.ready}
              </dd>
              <dt>Pulled, not arrived</dt>
              <dd className={styles.num}>{ward.pulled}</dd>
              <dt>Closed</dt>
              <dd className={styles.num}>{ward.closed}</dd>
              <dt>Occupied</dt>
              <dd className={styles.num}>
                {ward.occupied} of {ward.beds} ({percent(ward.occupancy)})
              </dd>
            </dl>
            <p className={styles.note}>
              {detail.leaving.today} expected to leave today, {detail.leaving.confirmedToday} confirmed.{" "}
              <a className={styles.link} href={wardPagesHref("board", unit.id)}>
                Bed board
              </a>
            </p>
          </Section>

          <Section title="Confirm today's numbers" sheet>
            <form className={styles.declineForm} onSubmit={confirm}>
              <label>
                Ready beds{" "}
                <input
                  className={`${styles.search} ${styles.numberInput}`}
                  type="number"
                  min={0}
                  max={unit.beds}
                  value={capacity ?? String(unit.allocatable.value)}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </label>
              <button type="submit" className={styles.textButton} disabled={capacityEmpty}>
                Confirm
              </button>
            </form>
            {capacityEmpty ? <p className={styles.note}>Enter the number of ready beds, even if it is 0.</p> : null}
            <p className={styles.note}>
              Last confirmed {unit.allocatable.value} at {formatInstantWithDay(unit.allocatable.confirmedAt, now)}. This
              changes {unit.name} only.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
