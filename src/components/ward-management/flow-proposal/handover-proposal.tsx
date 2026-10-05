"use client";

import { useMemo, useState } from "react";

import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { formatSheetMoment, splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { HEALTH_SERVICES, type Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";

import { currentShift, handoverFigures, type ProposalScope } from "./flow-proposal-figures";
import {
  KpiStrip,
  NOT_WIRED,
  Panel,
  Pill,
  PreviewBar,
  ProposalHeader,
  TableScroll,
  Verdict,
  plural,
} from "./flow-proposal-parts";
import styles from "./flow-proposal.module.css";

const LIST_LIMIT = 10;

/** The day shift's end as a clock face. A fixed rule of the roster, not an instant on any day. */

/**
 * Proposed shift handover: one printable sheet in the order a receiving coordinator reads it. What
 * to act on first, who is still waiting for a ward, who is on the way in, then beds and discharges
 * by hospital. Every figure narrows with the chosen scope (the current page keeps the network's
 * vacancy figure when a service is chosen) and, for the whole network, equals the sidebar's.
 */
export function HandoverProposal() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const { units, patients = [], referrals, movements, dayZero } = world;
  const [scope, setScope] = useState<ProposalScope>("network");
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [showAllInbound, setShowAllInbound] = useState(false);
  const [notes, setNotes] = useState("");

  const figures = useMemo(() => handoverFigures(world, scope, now), [world, scope, now]);
  const scopeLabel = scope === "network" ? "the whole network" : scope;
  const person = (movement: Movement) => resolveSubjectPatient(movement, { patients, referrals, movements });
  const edName = (movement: Movement) => edById(movement.originEdId)?.name ?? "Emergency department not recorded";
  const unitName = (id: string | undefined) =>
    id ? (units.find((unit) => unit.id === id)?.name ?? id) : "No ward yet";
  const waited = (movement: Movement) => splitDuration(Math.max(0, now - movement.openedAt));
  const shift = currentShift(now);
  const handoverLine = `${shift.name} hands over at ${shift.endsAt}${shift.endsTomorrow ? " tomorrow" : ""}, in ${splitDuration(shift.minutesLeft)}`;

  const waitingShown = showAllWaiting ? figures.waitingForWard : figures.waitingForWard.slice(0, LIST_LIMIT);

  function sheetText(): string {
    return [
      `Ward Flow shift handover (synthetic prototype) · ${formatSheetMoment(now, dayZero)} · ${scopeLabel}`,
      `Waiting for a ward: ${figures.waitingForWard.length}`,
      `On the way in: ${figures.inbound.length}`,
      `At a time limit or with nowhere to go: ${figures.severeCount}`,
      `Beds ready now: ${figures.bedsReadyNow}`,
      `Discharges held up: ${figures.dischargesHeldUp}`,
      `Referrals awaiting a decision: ${figures.referralsAwaitingDecision.length}`,
      "",
      "Act on first:",
      ...figures.severe.flatMap((group) =>
        group.movements.map(
          (movement) =>
            `- ${person(movement).initials} (${person(movement).umrn}) · ${group.title} · ${waited(movement)}`,
        ),
      ),
    ].join("\n");
  }

  function copySheet() {
    const text = sheetText();
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      announceToWardShell("Copy did not work in this browser. Use Print instead.");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => announceToWardShell("Handover copied as text, initials only."),
      () => announceToWardShell("Copy did not work in this browser. Use Print instead."),
    );
  }

  return (
    <>
      <PreviewBar screen="handover" />
      <main id="main-content" className={styles.page} data-testid="flow-proposal-handover">
        <ProposalHeader
          crumbs={[{ label: "Care coordination" }, { label: "Handover" }]}
          title="Shift handover"
          asAt={`As at ${formatSheetMoment(now, dayZero)} · ${handoverLine}`}
          actions={
            <span className={`${styles.toolbar} ${styles.noPrint}`}>
              <button type="button" className={styles.buttonQuiet} onClick={copySheet}>
                Copy as text
              </button>
              <button type="button" className={styles.buttonPrimary} onClick={() => window.print()}>
                Print
              </button>
            </span>
          }
        />

        <div className={`${styles.toolbar} ${styles.noPrint}`}>
          <label className={styles.fieldHint} htmlFor="handover-proposal-scope">
            Handover for
          </label>
          <select
            id="handover-proposal-scope"
            className={styles.select}
            value={scope}
            onChange={(event) => setScope(event.target.value as ProposalScope)}
          >
            <option value="network">Whole network</option>
            {HEALTH_SERVICES.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
          <span className={styles.fieldHint}>
            A person moving between two services appears in both services&apos; handovers.
          </span>
        </div>

        <Verdict
          attention={[
            ...figures.severe.map((group) => ({
              tone: "danger" as const,
              label: `${group.movements.length} ${group.title.toLowerCase()}`,
              href: "/mockups/ward-flow/delays",
            })),
            ...(figures.dischargesHeldUp
              ? [
                  {
                    tone: "warn" as const,
                    label: `${plural(figures.dischargesHeldUp, "discharge")} held up`,
                    href: "/mockups/ward-flow/discharges/proposal",
                  },
                ]
              : []),
            ...(figures.referralsAwaitingDecision.length
              ? [
                  {
                    tone: "info" as const,
                    label: `${plural(figures.referralsAwaitingDecision.length, "referral")} awaiting a decision`,
                    href: "/mockups/ward-flow/referrals/proposal",
                  },
                ]
              : []),
          ]}
        >
          {figures.unitCount === 0 ? (
            <>
              <strong>This prototype holds no {scopeLabel} wards,</strong> so every figure below is zero. That is
              missing sample data, not an empty service.{" "}
            </>
          ) : null}
          <strong>
            For {scopeLabel}: {figures.waitingForWard.length} still need a ward to accept them
          </strong>{" "}
          and {figures.inbound.length} are on the way in.{" "}
          {figures.severeCount === 0
            ? "Nobody is"
            : `${figures.severeCount} ${figures.severeCount === 1 ? "is" : "are"}`}{" "}
          at a time limit or with nowhere to go. {plural(figures.bedsReadyNow, "bed")} ready now.
        </Verdict>

        <KpiStrip
          label="Handover figures"
          items={[
            {
              label: "Waiting for a ward",
              value: figures.waitingForWard.length,
              note: "Placement requested or under review",
            },
            { label: "On the way in", value: figures.inbound.length, note: "Accepted, bed pulled, ready or moving" },
            {
              label: "Time limit or nowhere to go",
              value: figures.severeCount,
              tone: figures.severeCount ? "danger" : "good",
              note: "Recorded form time, or no bed anywhere",
            },
            { label: "Beds ready now", value: figures.bedsReadyNow, note: "Free, staffed and confirmed by the ward" },
            {
              label: "Discharges held up",
              value: figures.dischargesHeldUp,
              tone: figures.dischargesHeldUp ? "warn" : undefined,
              note: "A recorded reason stops them leaving",
            },
          ]}
        />

        <Panel title="Act on first" question="People at a recorded form time, or with no suitable bed anywhere.">
          {figures.severeCount === 0 ? (
            <p className={styles.empty}>Nobody in {scopeLabel} is at a recorded form time or without a suitable bed.</p>
          ) : (
            <ul className={styles.candidates}>
              {figures.severe.flatMap((group) =>
                group.movements.map((movement) => (
                  <li key={`${group.cause}-${movement.id}`} className={styles.candidate}>
                    <div>
                      <p className={styles.candidateName}>
                        {person(movement).initials} <span className={styles.mono}>{person(movement).umrn}</span>
                      </p>
                      <p className={styles.candidateLine}>
                        {group.title} · {edName(movement)} · {stageCopy[movement.stage].label} · waited{" "}
                        {waited(movement)}
                      </p>
                    </div>
                    <a className={styles.buttonQuiet} href={movementHref(movement.id)}>
                      Open movement
                    </a>
                  </li>
                )),
              )}
            </ul>
          )}
        </Panel>

        <div className={styles.grid2Even}>
          <Panel
            title="Waiting for a ward to accept"
            question="Longest wait first."
            meta={`${figures.waitingForWard.length} people`}
            flush
            foot={
              figures.waitingForWard.length > LIST_LIMIT ? (
                <button
                  type="button"
                  className={`${styles.buttonQuiet} ${styles.noPrint}`}
                  onClick={() => setShowAllWaiting((value) => !value)}
                >
                  {showAllWaiting ? "Show the longest ten" : `Show all ${figures.waitingForWard.length}`}
                </button>
              ) : undefined
            }
          >
            <MovementTable
              rows={waitingShown}
              person={person}
              edName={edName}
              waited={waited}
              unitName={unitName}
              label="Waiting for a ward"
            />
          </Panel>
          <Panel
            title="On the way in"
            question="A ward has said yes. Longest wait first."
            meta={`${figures.inbound.length} people`}
            flush
            foot={
              figures.inbound.length > LIST_LIMIT ? (
                <button
                  type="button"
                  className={`${styles.buttonQuiet} ${styles.noPrint}`}
                  onClick={() => setShowAllInbound((value) => !value)}
                >
                  {showAllInbound ? "Show the longest ten" : `Show all ${figures.inbound.length}`}
                </button>
              ) : undefined
            }
          >
            <MovementTable
              rows={showAllInbound ? figures.inbound : figures.inbound.slice(0, LIST_LIMIT)}
              person={person}
              edName={edName}
              waited={waited}
              unitName={unitName}
              showDestination
              label="On the way in"
            />
          </Panel>
        </div>

        <Panel
          title="Beds and discharges by hospital"
          question="Where the beds are, and where discharges are held up."
          flush
        >
          <TableScroll label="Beds and discharges by hospital">
            <table className={styles.sheet}>
              <thead>
                <tr>
                  <th scope="col">Hospital</th>
                  <th scope="col">Service</th>
                  <th scope="col" className={styles.num}>
                    Beds ready now
                  </th>
                  <th scope="col" className={styles.num}>
                    Discharges held up
                  </th>
                </tr>
              </thead>
              <tbody>
                {figures.sites.map((site) => (
                  <tr key={site.site.code}>
                    <td>{site.site.name}</td>
                    <td>{site.site.service}</td>
                    <td className={styles.num}>{site.rollup.availableNow}</td>
                    <td className={styles.num}>
                      {site.rollup.blockedToday ? <Pill tone="warn">{site.rollup.blockedToday}</Pill> : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total, {scopeLabel}</td>
                  <td className={styles.num}>{figures.bedsReadyNow}</td>
                  <td className={styles.num}>{figures.dischargesHeldUp}</td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>
        </Panel>

        <Panel title="Notes for the next shift" className={styles.noPrint}>
          <label className={styles.fieldHint} htmlFor="handover-proposal-notes">
            Anything the next coordinator should know. Use initials, never names.
          </label>
          <textarea
            id="handover-proposal-notes"
            className={styles.textarea}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
          />
          <div className={styles.toolbar} style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className={styles.buttonQuiet}
              title={NOT_WIRED}
              onClick={() => announceToWardShell(NOT_WIRED)}
            >
              Save notes
            </button>
            <span className={styles.fieldHint}>{NOT_WIRED}</span>
          </div>
        </Panel>

        <dl className={styles.definitions}>
          <dt>Waiting for a ward</dt>
          <dd>
            Open requests at placement requested or destination review. Not the same as referrals on the referral board.
          </dd>
          <dt>Time limit</dt>
          <dd>
            A form due time someone recorded has passed or is within the hour. Ward Flow does not calculate legal time
            limits.
          </dd>
          <dt>Beds ready now</dt>
          <dd>Beds a ward has confirmed are free and can be given out. The same count as Capacity in the menu.</dd>
        </dl>
      </main>
    </>
  );
}

function MovementTable({
  rows,
  person,
  edName,
  waited,
  unitName,
  showDestination = false,
  label,
}: {
  rows: Movement[];
  person: (movement: Movement) => ReturnType<typeof resolveSubjectPatient>;
  edName: (movement: Movement) => string;
  waited: (movement: Movement) => string;
  unitName: (id: string | undefined) => string;
  showDestination?: boolean;
  label: string;
}) {
  if (rows.length === 0)
    return (
      <p className={styles.empty} style={{ margin: "1rem" }}>
        Nobody right now.
      </p>
    );
  return (
    <TableScroll label={label}>
      <table className={styles.sheet}>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">From</th>
            <th scope="col">{showDestination ? "To" : "Stage"}</th>
            <th scope="col" className={styles.num}>
              Waited
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((movement) => (
            <tr key={movement.id}>
              <td>
                <span className={styles.rowName}>
                  <a href={movementHref(movement.id)}>{person(movement).initials}</a>
                </span>
                <span className={`${styles.rowSub} ${styles.mono}`} style={{ display: "block" }}>
                  {person(movement).umrn}
                </span>
              </td>
              <td>{edName(movement)}</td>
              <td>
                {showDestination
                  ? `${unitName(movement.acceptedUnitId)} · ${stageCopy[movement.stage].shortLabel}`
                  : stageCopy[movement.stage].label}
              </td>
              <td className={`${styles.num} ${styles.mono}`}>{waited(movement)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
