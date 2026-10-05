"use client";

import { edWaitBands, edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { unitById } from "@/components/ward-management/ward-sites";

import { KpiStrip, Panel, ProposalHeader, Verdict, type Attention, proposalHref } from "./statistics-proposal-parts";
import { SERVICE_COLOUR, edShort, hoursLabel } from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

const DAY = 24 * 60;

function ordinal(value: number): string {
  const suffix =
    value % 10 === 1 && value !== 11
      ? "st"
      : value % 10 === 2 && value !== 12
        ? "nd"
        : value % 10 === 3 && value !== 13
          ? "rd"
          : "th";
  return `${value}${suffix}`;
}

/**
 * Proposed emergency-department statistics. The current page draws the same few people four times
 * (lollipop chart, dot plot, table, band bars); this shows them once, one row each, with the 24-
 * and 48-hour guides drawn on the same scale. Initials only: a statistics page does not need names.
 */
export function EdStatisticsProposal({ edId }: { edId?: string }) {
  const { eds, asAt, now, world } = useStatisticsProposal();
  const ed = eds.find((candidate) => candidate.id === edId) ?? eds[0];
  const figures = edWaitFigures(world.movements, ed.id, now);
  const scaleMax = Math.max(DAY * 2, ...figures.waitingMovements.map((entry) => entry.waitMinutes)) * 1.05;
  const ranked = eds.slice().sort((a, b) => b.longestMinutes - a.longestMinutes);
  const bands = edWaitBands(world.movements, ed.id, now);
  const bandMax = Math.max(1, ...bands.map((band) => band.count));
  const rank = ranked.findIndex((row) => row.id === ed.id) + 1;
  const networkWaiting = eds.reduce((sum, row) => sum + row.waiting, 0);
  const attention: Attention[] = [];
  if (ed.over24h) attention.push({ tone: "danger", label: `${ed.over24h} waiting over 24 hours` });
  if (ed.unplaced) attention.push({ tone: "warn", label: `${ed.unplaced} with no ward yet` });
  if (ed.urgent) attention.push({ tone: "warn", label: `${ed.urgent} marked urgent` });
  if (ed.waiting - ed.unplaced)
    attention.push({ tone: "good", label: `${ed.waiting - ed.unplaced} accepted, awaiting transfer` });

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-ed">
      <ProposalHeader
        crumbs={[
          { label: "Statistics", href: proposalHref("statewide") },
          ...(ed.service ? [{ label: ed.service, href: proposalHref("service", ed.service) }] : []),
          { label: "Emergency departments" },
        ]}
        title={edShort(ed.name)}
        swatch={ed.service ? SERVICE_COLOUR[ed.service] : undefined}
        asAt={asAt}
      />

      <Verdict attention={attention}>
        {ed.waiting ? (
          <>
            <strong>
              {ed.waiting} {ed.waiting === 1 ? "person is" : "people are"} waiting for a mental health bed
            </strong>
            , the longest for {hoursLabel(ed.longestMinutes)}. This department has the{" "}
            {rank === 1 ? "" : `${ordinal(rank)} `}
            longest wait in the network and {Math.round((ed.waiting / Math.max(1, networkWaiting)) * 100)}% of everyone
            waiting.
          </>
        ) : (
          <strong>Nobody from this department is waiting for a mental health bed.</strong>
        )}
      </Verdict>

      <KpiStrip
        label="Emergency department headline figures"
        items={[
          { label: "Waiting for a bed", value: ed.waiting, tone: ed.waiting ? "warn" : undefined },
          { label: "Marked urgent", value: ed.urgent },
          { label: "No ward yet", value: ed.unplaced, note: "no ward has accepted" },
          { label: "Over 24 hours", value: ed.over24h, tone: ed.over24h ? "danger" : undefined },
          {
            label: "Longest wait",
            value: ed.waiting ? hoursLabel(ed.longestMinutes) : "–",
            tone: ed.longestMinutes >= DAY ? "danger" : undefined,
          },
          { label: "Median wait", value: ed.waiting ? hoursLabel(ed.medianMinutes) : "–" },
        ]}
      />

      <Panel
        title="Everyone waiting"
        question="Longest first. Time since the request for a bed was opened."
        meta={`${ed.waiting} people`}
        foot={<span>Dashed lines mark 24 and 48 hours. They are prototype guides, not legal limits.</span>}
      >
        {figures.waitingMovements.length === 0 ? (
          <p className={styles.empty}>Nobody from this department is waiting for a bed.</p>
        ) : (
          <>
            <div className={styles.scaleRow} aria-hidden="true" style={{ marginBottom: "1.25rem" }}>
              <span />
              <span style={{ position: "relative", height: "1rem" }}>
                <span className={styles.hbarMarkerLabel} style={{ left: `${(DAY / scaleMax) * 100}%`, top: 0 }}>
                  24h
                </span>
                <span className={styles.hbarMarkerLabel} style={{ left: `${((DAY * 2) / scaleMax) * 100}%`, top: 0 }}>
                  48h
                </span>
              </span>
              <span />
            </div>
            <ul className={styles.hbars}>
              {figures.waitingMovements.map(({ movement, waitMinutes }) => {
                const person = resolveSubjectPatient(movement, world);
                const accepted = movement.acceptedUnitId ? unitById(movement.acceptedUnitId) : undefined;
                const tone =
                  waitMinutes >= DAY * 2 ? styles.hbarFillDanger : waitMinutes >= DAY ? styles.hbarFillWarn : "";
                return (
                  <li className={styles.hbar} key={movement.id}>
                    <span className={styles.rowName}>
                      <span>
                        <strong>{person.initials}</strong>
                        {movement.flaggedUrgent ? (
                          <span
                            className={`${styles.pill} ${styles.pillDanger}`}
                            style={{ marginLeft: 8, minWidth: 0 }}
                          >
                            Urgent
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.rowSub}>{accepted ? `Accepted: ${accepted.name}` : "No ward yet"}</span>
                    </span>
                    <span className={styles.hbarTrack}>
                      <span
                        className={`${styles.hbarFill} ${tone}`}
                        style={{ width: `${(waitMinutes / scaleMax) * 100}%` }}
                      />
                      <span className={styles.hbarMarker} style={{ left: `${(DAY / scaleMax) * 100}%` }} />
                      <span className={styles.hbarMarker} style={{ left: `${((DAY * 2) / scaleMax) * 100}%` }} />
                    </span>
                    <span className={styles.hbarValue}>{hoursLabel(waitMinutes)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="How long people have waited" question="Everyone waiting, by band. Each person counted once.">
        <div className={styles.columns}>
          {bands.map((band) => (
            <div className={styles.column} key={band.label}>
              <span className={styles.columnValue}>{band.count}</span>
              <span
                className={`${styles.columnBar} ${band.label === "Over 24 hours" ? styles.meterDanger : ""}`}
                style={{ height: `${(band.count / bandMax) * 8}rem` }}
              />
            </div>
          ))}
        </div>
        <div className={styles.columnLabels}>
          {bands.map((band) => (
            <span key={band.label}>{band.label}</span>
          ))}
        </div>
      </Panel>

      <Panel title="All emergency departments" question="Where this department sits in the network." flush>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Department</th>
              <th scope="col">Service</th>
              <th scope="col" className={styles.num}>
                Waiting
              </th>
              <th scope="col" className={styles.num}>
                Over 24h
              </th>
              <th scope="col" className={styles.num}>
                Longest
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((row) => (
              <tr key={row.id} aria-current={row.id === ed.id ? "true" : undefined}>
                <td>
                  <span className={styles.rowName}>
                    {row.id === ed.id ? (
                      <strong>{edShort(row.name)} (this department)</strong>
                    ) : (
                      <a href={proposalHref("ed", row.id)}>{edShort(row.name)}</a>
                    )}
                  </span>
                </td>
                <td>{row.service ?? "–"}</td>
                <td className={styles.num}>{row.waiting}</td>
                <td className={`${styles.num} ${row.over24h ? styles.toneDanger : ""}`}>{row.over24h}</td>
                <td className={styles.num}>{row.waiting ? hoursLabel(row.longestMinutes) : "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </main>
  );
}
