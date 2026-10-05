"use client";

import { useMemo, useState } from "react";

import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { releaseBand } from "@/components/ward-management/ward-bed-availability";
import { formatInstantWithDay, formatSheetMoment } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { HEALTH_SERVICES, type BedRelease, type HealthService } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";

import { dischargeFigures } from "./flow-proposal-figures";
import { KpiStrip, NOT_WIRED, Panel, Pill, PreviewBar, ProposalHeader, Verdict, plural } from "./flow-proposal-parts";
import styles from "./flow-proposal.module.css";

type GroupId = "held" | "confirmed" | "late" | "later" | "freed";

const GROUP_COPY: Record<GroupId, { title: string; note: string }> = {
  held: { title: "Held up", note: "Something recorded is stopping the person leaving. Act on these first." },
  confirmed: { title: "Confirmed", note: "The ward has confirmed the discharge; nothing recorded is holding it." },
  late: { title: "Expected, past the time the ward wrote", note: "Not confirmed yet. Ask the ward for a new time." },
  later: { title: "Expected later today or tomorrow", note: "Not confirmed yet, and the written time has not passed." },
  freed: { title: "Bed freed in the last 24 hours", note: "Already discharged. Shown so the morning count adds up." },
};

/**
 * Proposed discharges screen. Groups by what someone has to do, never by a time of day the record
 * does not hold: the current board files every expected release under "Wave 3 · Afternoon" even
 * when its written time passed days ago. Updating a discharge is a ward action in this engine
 * (`CONFIRM_BED_RELEASE` and its siblings are ward-only), so each row opens the ward rather than
 * pretending a coordinator can change it here.
 */
export function DischargesProposal() {
  const world = useWardFlow();
  const now = useWardFlowClock();
  const { units, admissions, patients = [], referrals, movements, dayZero } = world;
  const [service, setService] = useState<"all" | HealthService>("all");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<GroupId[]>([]);
  const limitFor = (id: GroupId) => (expanded.includes(id) ? Number.POSITIVE_INFINITY : id === "later" ? 6 : 12);
  const toggleGroup = (id: GroupId) =>
    setExpanded((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));

  const figures = useMemo(() => dischargeFigures(world, now), [world, now]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const inService = (release: BedRelease) => {
    if (service === "all") return true;
    const unit = unitsById.get(release.unitId);
    return unit ? unitHealthService(unit) === service : false;
  };

  const { groups } = figures;
  const late = groups.expected.filter((release) => release.expectedAt < now);
  const later = groups.expected.filter((release) => release.expectedAt >= now);
  const grouped: Record<GroupId, BedRelease[]> = {
    held: groups.blocked.filter(inService),
    confirmed: groups.confirmed.filter(inService),
    late: late.filter(inService).sort((a, b) => a.expectedAt - b.expectedAt),
    later: later.filter(inService),
    freed: groups["discharged-today"].filter(inService),
  };
  const all = (Object.keys(grouped) as GroupId[]).flatMap((id) => grouped[id]);
  const expectedCount = grouped.late.length + grouped.later.length;
  const selected = all.find((release) => release.id === chosenId) ?? all[0];

  const blockerCounts = new Map<string, number>();
  for (const release of grouped.held) {
    const reason = release.blocker ?? "Reason not recorded";
    blockerCounts.set(reason, (blockerCounts.get(reason) ?? 0) + 1);
  }
  const blockers = [...blockerCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxBlocker = Math.max(1, ...blockers.map(([, count]) => count));

  const person = (release: BedRelease) => {
    const admission = admissions.find((candidate) => candidate.id === release.admissionId);
    return resolveSubjectPatient(admission, { patients, referrals, movements });
  };
  const wardName = (release: BedRelease) => unitsById.get(release.unitId)?.name ?? "Ward not recorded";
  const serviceName = (release: BedRelease) => {
    const unit = unitsById.get(release.unitId);
    return (unit && unitHealthService(unit)) ?? "Service not recorded";
  };
  const timing = (release: BedRelease) => {
    if (release.state === "discharged") return `Freed ${formatInstantWithDay(release.confirmedAt, now)}`;
    const written = formatInstantWithDay(release.expectedAt, now);
    return `Written for ${written}`;
  };

  return (
    <>
      <PreviewBar screen="discharges" />
      <main id="main-content" className={styles.page} data-testid="flow-proposal-discharges">
        <ProposalHeader
          crumbs={[{ label: "Care coordination" }, { label: "Discharges" }]}
          title="Discharges"
          asAt={`As at ${formatSheetMoment(now, dayZero)}`}
          actions={
            <button
              type="button"
              className={styles.buttonQuiet}
              title={NOT_WIRED}
              onClick={() => announceToWardShell(NOT_WIRED)}
            >
              Plan a departure
            </button>
          }
        />

        <div className={`${styles.toolbar} ${styles.noPrint}`}>
          <label className={styles.fieldHint} htmlFor="discharge-proposal-service">
            Discharges for
          </label>
          <select
            id="discharge-proposal-service"
            className={styles.select}
            value={service}
            onChange={(event) => setService(event.target.value as "all" | HealthService)}
          >
            <option value="all">Whole network</option>
            {HEALTH_SERVICES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>

        <Verdict
          attention={[
            ...blockers
              .slice(0, 3)
              .map(([reason, count]) => ({ tone: "warn" as const, label: `${count} ${reason.toLowerCase()}` })),
            ...(grouped.late.length
              ? [{ tone: "warn" as const, label: `${grouped.late.length} past the written time` }]
              : []),
          ]}
        >
          <strong>
            {service === "all" ? "" : `For ${service}: `}
            {grouped.held.length === 0
              ? "No discharge is held up."
              : `${plural(grouped.held.length, "discharge")} ${grouped.held.length === 1 ? "is" : "are"} held up`}
          </strong>
          {grouped.held.length === 0 ? " " : " and need someone to act. "}
          {grouped.confirmed.length} confirmed, and {expectedCount} more expected by tomorrow, {grouped.late.length} of
          them already past the time the ward wrote.
        </Verdict>

        <KpiStrip
          label="Discharge figures"
          items={[
            {
              label: "Held up",
              value: grouped.held.length,
              tone: grouped.held.length ? "warn" : "good",
              note: "A recorded reason stops them leaving",
            },
            { label: "Confirmed", value: grouped.confirmed.length, note: "Not held up" },
            {
              label: "Expected by tomorrow",
              value: expectedCount,
              note: `${grouped.late.length} past the written time`,
              tone: grouped.late.length ? "warn" : undefined,
            },
            { label: "Freed, last 24 hours", value: grouped.freed.length },
            {
              label: "Expected later",
              value: groups.excludedBeyondToday,
              note: service === "all" ? "Two or more days away" : "Whole network; not split by service",
            },
          ]}
        />

        <div className={styles.workspace}>
          <Panel
            title="Discharge worklist"
            question="Grouped by what needs doing, held up first."
            meta={service === "all" ? `${all.length} listed` : `${all.length} of ${figures.shown} listed`}
            flush
            foot={
              <>
                <span>
                  {groups.excludedBeyondToday} expected two or more days away and {groups.completedBeforeToday} freed
                  more than a day ago are not listed.
                </span>
                <span>Total {figures.total}</span>
              </>
            }
          >
            {service !== "all" && !units.some((unit) => unitHealthService(unit) === service) ? (
              <p className={styles.callout} style={{ margin: "0 1rem 0.75rem" }}>
                This prototype holds no {service} wards, so nothing is listed. That is missing sample data, not an empty
                service.
              </p>
            ) : null}
            {(Object.keys(grouped) as GroupId[]).map((id) => (
              <section key={id} aria-label={GROUP_COPY[id].title}>
                <h3 className={styles.groupHead}>
                  <span>
                    <strong>{GROUP_COPY[id].title}</strong> · {grouped[id].length}
                  </span>
                  <span className={styles.groupNote}>{GROUP_COPY[id].note}</span>
                </h3>
                {grouped[id].length === 0 ? (
                  <p className={styles.note} style={{ margin: "0.5rem 1rem 0.75rem" }}>
                    None.
                  </p>
                ) : (
                  <ul className={styles.rows}>
                    {grouped[id].slice(0, limitFor(id)).map((release) => (
                      <li key={release.id}>
                        <button
                          type="button"
                          className={styles.row}
                          aria-current={selected?.id === release.id ? "true" : undefined}
                          onClick={() => setChosenId(release.id)}
                        >
                          <span className={styles.avatar} aria-hidden="true">
                            {person(release).initials}
                          </span>
                          <span>
                            <span className={styles.rowTitle} style={{ display: "block" }}>
                              {wardName(release)}
                            </span>
                            <span className={styles.rowLine} style={{ display: "block" }}>
                              {serviceName(release)} · {timing(release)}
                            </span>
                          </span>
                          <span className={styles.rowAside}>
                            {release.blocker ? <Pill tone="warn">{release.blocker}</Pill> : null}
                            {!release.blocker && release.waitingOn ? <Pill>{release.waitingOn}</Pill> : null}
                            {release.state === "confirmed" && !release.blocker ? (
                              <Pill tone="good">Confirmed</Pill>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {grouped[id].length > (id === "later" ? 6 : 12) ? (
                  <div className={styles.panelFoot}>
                    <span>
                      {expanded.includes(id)
                        ? `All ${grouped[id].length} shown`
                        : `${limitFor(id)} of ${grouped[id].length} shown`}
                    </span>
                    <button type="button" className={styles.buttonQuiet} onClick={() => toggleGroup(id)}>
                      {expanded.includes(id) ? "Show fewer" : `Show all ${grouped[id].length}`}
                    </button>
                  </div>
                ) : null}
              </section>
            ))}
          </Panel>

          <div className={styles.stack}>
            {selected ? (
              <Panel title="Discharge" meta={<span className={styles.mono}>{person(selected).umrn}</span>}>
                <div className={styles.detailHead}>
                  <h3 className={styles.detailTitle}>
                    <span className={styles.avatar} aria-hidden="true">
                      {person(selected).initials}
                    </span>
                    <span>
                      {wardName(selected)}
                      <span className={styles.rowLine} style={{ display: "block", fontWeight: 500 }}>
                        {serviceName(selected)}
                      </span>
                    </span>
                  </h3>
                  {selected.blocker ? (
                    <Pill tone="warn">Held up</Pill>
                  ) : (
                    <Pill>
                      {selected.state === "discharged"
                        ? "Freed"
                        : selected.state === "confirmed"
                          ? "Confirmed"
                          : "Expected"}
                    </Pill>
                  )}
                </div>
                <h4 className={styles.sectionTitle}>What is recorded</h4>
                <ul className={styles.checklist}>
                  <li>
                    <span>Discharge time the ward wrote</span>
                    <span>{formatInstantWithDay(selected.expectedAt, now)}</span>
                  </li>
                  <li>
                    <span>Release window</span>
                    <span>{releaseBandLabel(releaseBand(selected, now))}</span>
                  </li>
                  <li>
                    <span>Holding it up</span>
                    <span className={selected.blocker ? undefined : styles.checkTodo}>
                      {selected.blocker ?? "Nothing recorded"}
                    </span>
                  </li>
                  <li>
                    <span>Waiting on</span>
                    <span className={styles.checkTodo}>{selected.waitingOn ?? "Nothing recorded"}</span>
                  </li>
                  <li>
                    <span>Last confirmed by</span>
                    <span>
                      {selected.confirmedBy} · {formatInstantWithDay(selected.confirmedAt, now)}
                    </span>
                  </li>
                  <li>
                    <span>Bed being made ready</span>
                    <span className={styles.checkTodo}>{selected.preparing ? "Yes" : "No"}</span>
                  </li>
                </ul>
                <p className={styles.callout}>
                  The ward updates a discharge: confirm it, record or clear what is holding it, or record the departure.
                </p>
                <div className={styles.toolbar} style={{ marginTop: "0.75rem" }}>
                  <a className={styles.buttonPrimary} href={unitHref(selected.unitId)}>
                    Open {wardName(selected)}
                  </a>
                  <button
                    type="button"
                    className={styles.buttonQuiet}
                    title={NOT_WIRED}
                    onClick={() => announceToWardShell(NOT_WIRED)}
                  >
                    Chase the ward
                  </button>
                </div>
              </Panel>
            ) : (
              <Panel title="Discharge">
                <p className={styles.empty}>No discharge in this service right now.</p>
              </Panel>
            )}

            <Panel title="What is holding discharges up" question="Recorded reasons on held-up discharges.">
              {blockers.length ? (
                <ul className={styles.hbars}>
                  {blockers.map(([reason, count]) => (
                    <li key={reason} className={styles.hbar}>
                      <span className={styles.hbarLabel}>{reason}</span>
                      <span className={styles.hbarTrack}>
                        <span className={styles.hbarFill} style={{ width: `${(count / maxBlocker) * 100}%` }} />
                      </span>
                      <span className={styles.hbarValue}>{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>Nothing is holding up a discharge in this service.</p>
              )}
            </Panel>

            <dl className={styles.definitions}>
              <dt>Held up</dt>
              <dd>
                A recorded reason is stopping the person leaving. The Discharges count in the menu is this figure.
              </dd>
              <dt>Expected</dt>
              <dd>The ward has written a time but not confirmed it. A passed time is not a confirmed discharge.</dd>
              <dt>Freed</dt>
              <dd>The person has left and the bed counts as free. Listed until the next day.</dd>
            </dl>
          </div>
        </div>
      </main>
    </>
  );
}

function releaseBandLabel(band: ReturnType<typeof releaseBand>): string {
  switch (band) {
    case "now":
      return "Now";
    case "by-midday":
      return "By midday";
    case "by-1600":
      return "By 4pm";
    case "tonight":
      return "Tonight";
    case "tomorrow":
      return "Tomorrow";
    default:
      return "Two or more days away";
  }
}
