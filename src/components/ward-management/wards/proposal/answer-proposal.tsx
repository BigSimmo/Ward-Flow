"use client";

import { useState, type FormEvent } from "react";

import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import { BedBar } from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import { SERVICE_COLOUR, percent } from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { Instant } from "@/components/ward-management/ward-clock";
import { DECLINE_REASONS, type DeclineReason } from "@/components/ward-management/ward-model";

import { waitedLabel } from "./ward-pages-proposal-figures";
import { Answer, PageHeader, Row, Section, WardSubnav, plural, wardPagesHref } from "./ward-pages-proposal-parts";
import { useWardPagesProposal } from "./use-ward-pages-proposal";
import styles from "./ward-pages-proposal.module.css";

/**
 * Proposed bed-requests screen (today's "ward answer"). Each request is one row with its two real
 * answers; accepting and declining dispatch the same reducer events the current screen does, and
 * the ward's ready-bed confirmation sits beside them because that is the figure being promised.
 */
export function AnswerProposal({ unitId }: { unitId?: string }) {
  const { ward, detail, asAt, now, world } = useWardPagesProposal(unitId);
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [reason, setReason] = useState<DeclineReason | "">("");
  const [capacity, setCapacity] = useState<string | null>(null);
  const [pending, setPending] = useState<{ before: number; done: string } | null>(null);
  // A refused event appends a rejection; say what the engine said rather than claiming success.
  const refused = pending && world.rejections.length > pending.before ? world.rejections.at(-1) : undefined;
  const message = pending ? (refused ? `Not recorded: ${refused.reason}` : pending.done) : null;
  if (!ward || !detail) return <p className={styles.empty}>No wards in this network.</p>;
  const { unit } = ward;
  const { requests } = detail;
  const revision = unit.allocatable.revision ?? 0;

  const after = (before: number, done: string) => setPending({ before, done });

  const accept = (movementId: string) => {
    const before = world.rejections.length;
    world.dispatch({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId, unitId: unit.id });
    after(before, "Accepted in principle. The request moves to Coming in once a bed is given.");
  };

  const decline = (event: FormEvent<HTMLFormElement>, movementId: string) => {
    event.preventDefault();
    if (!reason) return;
    const before = world.rejections.length;
    world.dispatch({ type: "DECLINE", role: "ward", now, movementId, unitId: unit.id, reason });
    setDeclineFor(null);
    setReason("");
    after(before, "Declined. The referring team sees your reason.");
  };

  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(capacity ?? unit.allocatable.value);
    if (!Number.isFinite(value) || value < 0) return;
    const before = world.rejections.length;
    world.dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      value: Math.floor(value),
      expectedRevision: revision,
    });
    setCapacity(null);
    after(before, `Ready beds confirmed for ${unit.name}.`);
  };

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
            ? [{ tone: "danger", label: "No ready bed: accepting puts the person on this ward's wait list" }]
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
                              {DECLINE_REASONS.map((value) => (
                                <option key={value} value={value}>
                                  {declineReasonLabels[value]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button type="submit" className={styles.secondary} disabled={!reason}>
                            Record decline
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
              <button type="submit" className={styles.secondary}>
                Confirm
              </button>
            </form>
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
