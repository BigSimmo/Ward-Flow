"use client";

import { useState } from "react";

import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { daysInBed } from "@/components/ward-management/ward-admissions";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { outOfAreaLedger, type OutOfAreaEntry } from "@/components/ward-management/ward-referrals";
import { siteByCode } from "@/components/ward-management/ward-sites";

import {
  KpiStrip,
  NotWiredButton,
  Panel,
  Pill,
  ProposalHeader,
  ProposalPreviewBar,
  Verdict,
  type Attention,
} from "./oversight-proposal-parts";
import styles from "./oversight-proposal.module.css";

type BandFilter = "all" | OutOfAreaEntry["band"];

/** People-page link for a resolved patient; the same rule the current out-of-area screen uses. */
function personHref(patientId: string | undefined): string | null {
  return patientId ? `/mockups/ward-flow/people/${encodeURIComponent(patientId)}` : null;
}

export function OutOfAreaProposal() {
  const { admissions, units, dayZero } = useWardFlow();
  const now = useWardFlowClock();
  const patientOf = usePatientOf();
  const [band, setBand] = useState<BandFilter>("all");
  const [region, setRegion] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { entries, notBanded } = outOfAreaLedger(admissions, units, now);
  const days = (entry: OutOfAreaEntry) => daysInBed(entry.admission, now) ?? 0;
  const sorted = [...entries].sort((a, b) => days(b) - days(a));
  const air = entries.filter((entry) => entry.band === "air_transport_only").length;
  const road = entries.length - air;
  const longest = sorted[0];
  const regionOf = (entry: OutOfAreaEntry) => entry.admission.homeRegion ?? "Not recorded";
  const regions = Object.entries(
    entries.reduce<Record<string, number>>((acc, entry) => {
      acc[regionOf(entry)] = (acc[regionOf(entry)] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxRegion = regions[0]?.[1] ?? 0;
  const visible = sorted.filter(
    (entry) => (band === "all" || entry.band === band) && (region === "all" || regionOf(entry) === region),
  );
  const selected = sorted.find((entry) => entry.admission.id === selectedId) ?? visible[0] ?? null;
  const over30 = entries.filter((entry) => days(entry) >= 30).length;

  const attention: Attention[] = [];
  if (air > 0) attention.push({ tone: "danger", label: `${air} reachable only by air` });
  if (over30 > 0) attention.push({ tone: "warn", label: `${over30} away 30 days or more` });
  if (notBanded > 0) attention.push({ tone: "quiet", label: `${notBanded} occupied beds with travel time unknown` });

  return (
    <>
      <ProposalPreviewBar active="out-of-area" />
      <main id="main-content" className={styles.page} data-testid="out-of-area-proposal">
        <ProposalHeader
          crumb="Oversight"
          title="Out of area"
          subtitle="People in a bed three hours or more from home, longest away first, and who could go home."
          asAt={`As at ${formatSheetMoment(now, dayZero)}`}
        />

        <Verdict attention={attention}>
          {entries.length === 0 ? (
            <>
              <strong>Nobody is in a bed far from home.</strong>
            </>
          ) : (
            <>
              <strong>
                {notBanded > 0 ? "At least " : ""}
                {entries.length} {entries.length === 1 ? "person is" : "people are"} in a bed far from home.
              </strong>{" "}
              {longest ? (
                <>
                  The longest away is {patientOf(longest.admission).displayName}, {days(longest)} days from{" "}
                  {regionOf(longest)}.
                </>
              ) : null}
            </>
          )}
        </Verdict>

        <p className={styles.caveat} role="note">
          <span className={`${styles.dot} ${styles.dotWarn}`} aria-hidden="true" />
          Travel times are invented for this demonstration, by a rule that ignores real geography, so some read as
          plainly wrong (a Perth home &ldquo;reachable only by air&rdquo; from a Perth hospital). Use them to test the
          screen, never to judge a real distance.
        </p>

        <KpiStrip
          label="Out-of-area figures"
          items={[
            {
              label: "Far from home",
              value: entries.length,
              note: "Three hours or more, or air only",
              pressed: band === "all",
              onPress: () => setBand("all"),
            },
            {
              label: "Reachable only by air",
              value: air,
              tone: air > 0 ? "danger" : undefined,
              note: TRAVEL_BAND_LABELS.air_transport_only,
              pressed: band === "air_transport_only",
              onPress: () => setBand(band === "air_transport_only" ? "all" : "air_transport_only"),
            },
            {
              label: "By road",
              value: road,
              note: TRAVEL_BAND_LABELS.three_hours_or_more,
              pressed: band === "three_hours_or_more",
              onPress: () => setBand(band === "three_hours_or_more" ? "all" : "three_hours_or_more"),
            },
            {
              label: "Longest away",
              value: longest ? `${days(longest)}d` : "None",
              note: longest ? regionOf(longest) : "Nobody far from home",
            },
            {
              label: "Travel time unknown",
              value: notBanded,
              note: "Occupied beds with no home region or no recorded travel time; some may be far from home",
            },
          ]}
        />

        <div className={styles.grid2}>
          <Panel
            title="People far from home"
            question={`${visible.length} of ${entries.length} shown, longest away first`}
            meta={
              <label className={styles.toolbar}>
                <span>Home region</span>
                <select className={styles.select} value={region} onChange={(event) => setRegion(event.target.value)}>
                  <option value="all">All regions ({entries.length})</option>
                  {regions.map(([name, count]) => (
                    <option key={name} value={name}>
                      {name} ({count})
                    </option>
                  ))}
                </select>
              </label>
            }
            flush
          >
            {visible.length === 0 ? (
              <div className={styles.panelBody}>
                <p className={styles.empty}>Nobody matches these filters.</p>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Home region</th>
                      <th scope="col">In a bed at</th>
                      <th scope="col">Travel home</th>
                      <th scope="col" className={styles.num}>
                        Days away
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((entry) => {
                      const person = patientOf(entry.admission);
                      return (
                        <tr key={entry.admission.id} aria-selected={selected?.admission.id === entry.admission.id}>
                          <td>
                            <span className={styles.rowName}>
                              <button
                                type="button"
                                className={styles.rowButton}
                                onClick={() => setSelectedId(entry.admission.id)}
                              >
                                {person.displayName}
                              </button>
                              <span className={styles.rowSub}>UMRN {person.umrn}</span>
                            </span>
                          </td>
                          <td>{regionOf(entry)}</td>
                          <td>
                            <span className={styles.rowName}>
                              <a className={styles.link} href={unitHref(entry.unit.id)}>
                                {entry.unit.name}
                              </a>
                              <span className={styles.rowSub}>
                                {siteByCode(entry.unit.siteCode)?.name ?? entry.unit.siteCode}
                              </span>
                            </span>
                          </td>
                          <td>
                            <Pill tone={entry.band === "air_transport_only" ? "danger" : "warn"}>
                              {TRAVEL_BAND_LABELS[entry.band]}
                            </Pill>
                          </td>
                          <td className={styles.num}>{days(entry)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className={`${styles.stack} ${styles.sticky}`}>
            <Panel
              title="Selected person"
              question={selected ? patientOf(selected.admission).displayName : "Nothing selected"}
            >
              {selected ? (
                <div className={styles.stack}>
                  <dl className={styles.detail}>
                    <dt>Home region</dt>
                    <dd>{regionOf(selected)}</dd>
                    <dt>In a bed at</dt>
                    <dd>
                      {selected.unit.name}, {siteByCode(selected.unit.siteCode)?.name ?? selected.unit.siteCode}
                    </dd>
                    <dt>Travel home</dt>
                    <dd>{TRAVEL_BAND_LABELS[selected.band]}</dd>
                    <dt>Days away</dt>
                    <dd>{days(selected)}</dd>
                  </dl>
                  <div className={styles.toolbar}>
                    {personHref(patientOf(selected.admission).patient?.id) ? (
                      <a className={styles.button} href={personHref(patientOf(selected.admission).patient?.id)!}>
                        Open person
                      </a>
                    ) : null}
                    <a className={styles.button} href={unitHref(selected.unit.id)}>
                      Open ward
                    </a>
                  </div>
                  <NotWiredButton>Arrange return</NotWiredButton>
                </div>
              ) : (
                <p className={styles.empty}>Select a person to see where they are and how they get home.</p>
              )}
            </Panel>

            <Panel title="Where people are from" question="Select a region to filter the list" flush>
              <ul className={styles.list}>
                {regions.map(([name, count]) => (
                  <li key={name} className={styles.listItem}>
                    <button
                      type="button"
                      className={styles.rowButton}
                      aria-pressed={region === name}
                      onClick={() => setRegion(region === name ? "all" : name)}
                    >
                      {name}
                    </button>
                    <span className={styles.toolbar}>
                      <span className={styles.meterTrack} aria-hidden="true">
                        <span
                          className={styles.meterFill}
                          style={{ width: `${maxRegion ? (count / maxRegion) * 100 : 0}%` }}
                        />
                      </span>
                      <span className={styles.mono}>{count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
