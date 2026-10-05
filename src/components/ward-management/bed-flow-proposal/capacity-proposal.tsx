"use client";

import { useState } from "react";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BedMeetingSheetLauncher } from "@/components/ward-management/capacity/bed-meeting-sheet";
import { forecastHeadline, forecastRangeEnd } from "@/components/ward-management/capacity/beds-forecast";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  BedGrid,
  BedGridLegend,
  BedLegend,
  KpiStrip,
  OccupancyPill,
  Panel,
  ProposalHeader,
  ReleaseTimeline,
  TableScroll,
  Verdict,
  type Attention,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import {
  SERVICE_COLOUR,
  percent,
  releasesToday,
  type WardFigures,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import stats from "@/components/ward-management/statistics/proposal/statistics-proposal.module.css";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import { BedFlowDefinitions } from "./bed-flow-definitions";
import { confirmationIsFresh, useBedFlowProposal } from "./use-bed-flow-proposal";
import styles from "./bed-flow-proposal.module.css";

type Highlight = "none" | "no-ready" | "locked-ready" | "stale" | "overdue";
type Sort = "service" | "ready" | "occupancy" | "confirmed";

/**
 * Proposed Capacity screen. Answers "where can the next person go, and where will we run short?"
 * in one sentence, then the bed-kind mismatch, when beds come free, one bed map with ward detail
 * beside it, and one ward table. Every bed figure is the statistics proposal's `bedStates` split.
 */
export function CapacityProposal() {
  const data = useBedFlowProposal();
  const { world, now, wards, network, asAt, gaps, gapTotals, needing, open, releases, freeToday, forecast } = data;
  const patientOf = usePatientOf();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Highlight>("none");
  const [sort, setSort] = useState<Sort>("service");
  const selected = wards.find((ward) => ward.unit.id === selectedId);

  const noReady = wards.filter((ward) => ward.ready === 0);
  const shortKinds = gaps.filter((row) => row.gap < 0).sort((a, b) => a.gap - b.gap);
  const highlightRule: Record<Highlight, (ward: WardFigures) => boolean> = {
    none: () => false,
    "no-ready": (ward) => ward.ready === 0,
    "locked-ready": (ward) => (data.lockedReadyByUnit.get(ward.unit.id) ?? 0) > 0,
    stale: (ward) => !confirmationIsFresh(ward.unit, now),
    overdue: (ward) => ward.releases.overdue.expected > 0,
  };
  const highlightCount = wards.filter(highlightRule[highlight]).length;

  const attention: Attention[] = [
    ...shortKinds.map((row) => ({
      tone: "danger" as const,
      label: `${capitalise(row.need.replace(/^An? /, ""))}: ${-row.gap} short`,
    })),
    ...(noReady.length ? [{ tone: "warn" as const, label: `${noReady.length} wards with no ready bed` }] : []),
    ...(releases.overdue.expected
      ? [{ tone: "warn" as const, label: `${releases.overdue.expected} discharges past their date, not confirmed` }]
      : []),
    ...data.stale.map((ward) => ({ tone: "info" as const, label: `${ward.unit.name}: bed state needs confirming` })),
  ];

  return (
    <main id="main-content" className={stats.page} data-testid="capacity-proposal">
      <ProposalHeader crumbs={[{ label: "Operations" }, { label: "Capacity" }]} title="Capacity" asAt={asAt} />
      <div className={styles.headerActions}>
        <BedMeetingSheetLauncher
          now={now}
          buttonClassName={styles.button}
          buildSheet={() =>
            bedMeetingSheet({
              units: world.units,
              movements: world.movements,
              bedReleases: world.bedReleases,
              admissions: world.admissions,
              leaveBeds: world.leaveBeds,
              now,
              service: null,
              nameOf: (movement) => patientOf(movement).displayName,
            })
          }
        />
        <a className={styles.button} href="/mockups/ward-flow/network/proposal">
          Network view ›
        </a>
      </div>

      <Verdict attention={attention}>
        <strong>
          {network.ready} beds are ready for {needing.length} people still waiting for one
        </strong>
        {gapTotals.gap < 0 ? `, so the network is ${-gapTotals.gap} beds short today` : ""}.{" "}
        {shortKinds.length
          ? `The biggest gap is ${shortKinds[0].need.replace(/^An? /, "").toLowerCase()}s (${-shortKinds[0].gap} short). `
          : ""}
        {freeToday} more {freeToday === 1 ? "bed is" : "beds are"} expected to come free before midnight.
      </Verdict>

      <KpiStrip
        label="Network bed figures"
        items={[
          { label: "Beds", value: network.beds, note: `${wards.length} wards` },
          {
            label: "Occupied",
            value: network.occupied,
            note: `${percent(network.occupied / network.beds, 1)} · ${network.onLeave} on leave`,
            keyClass: stats.segOccupied,
          },
          { label: "Pulled", value: network.pulled, note: "bed given, not arrived", keyClass: stats.segPulled },
          { label: "Closed", value: network.closed, note: "empty, not offered", keyClass: stats.segClosed },
          {
            label: "Ready",
            value: network.ready,
            tone: "good",
            note: `${data.lockedReady} locked · ${network.beingMadeReady} being made ready`,
            keyClass: stats.segReady,
          },
          {
            label: "Still need a bed",
            value: needing.length,
            tone: needing.length > network.ready ? "danger" : undefined,
            note: `of ${open.length} on ED lists`,
          },
          { label: "Free by midnight", value: freeToday, tone: "good", note: "confirmed and expected" },
        ]}
      />

      <div className={stats.grid2}>
        <Panel
          title="Where the mismatch is"
          question="Ready beds that suit each kind of need, against the people still waiting for one."
          meta={`${gapTotals.waiting} waiting · ${gapTotals.bedsThatFit} fit`}
          foot={
            <span className={stats.rowSub}>
              Counts people at placement requested, destination review or accepted. The {open.length - needing.length}{" "}
              with a bed already pulled or on their way are not counted.
            </span>
          }
        >
          <MismatchRows gaps={gaps} />
        </Panel>

        <Panel title="When beds come free" question="Discharges by when the bed is expected back." meta="Whole network">
          <ReleaseTimeline releases={releases} />
          <div className={styles.forecast}>
            <p className={styles.sectionTitle}>Estimate after today</p>
            {forecast.horizons.map((horizon) => (
              <ForecastRange key={horizon.hours} {...horizon} />
            ))}
            <p className={stats.note}>
              Ready beds plus discharges due, minus the {needing.length} people still waiting. New arrivals at emergency
              departments are not predicted.
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        title="Bed map"
        question="Every ward, one square per bed. Select a ward for its detail."
        meta={`${network.beds} beds · ${wards.length} wards`}
      >
        <div className={styles.toolbar}>
          <div className={styles.toolbarLabel}>
            Highlight
            <div className={stats.segmented} role="group" aria-label="Highlight wards">
              {(
                [
                  ["none", "Nothing"],
                  ["no-ready", `No ready bed (${wards.filter(highlightRule["no-ready"]).length})`],
                  ["locked-ready", `Locked bed ready (${wards.filter(highlightRule["locked-ready"]).length})`],
                  ["overdue", `Discharge past date (${wards.filter(highlightRule.overdue).length})`],
                  ["stale", `Needs confirming (${data.stale.length})`],
                ] as [Highlight, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={highlight === id} onClick={() => setHighlight(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <span className={stats.rowSub}>
            {highlight === "none"
              ? "Highlighting marks wards; it never hides one."
              : `${highlightCount} of ${wards.length} wards marked. Every ward stays on the map.`}
          </span>
        </div>
        <div className={styles.mapLayout}>
          <div className={styles.services}>
            {HEALTH_SERVICES.map((service) => {
              const own = wards.filter((ward) => ward.service === service);
              if (own.length === 0) return null;
              const ready = own.reduce((sum, ward) => sum + ward.ready, 0);
              const beds = own.reduce((sum, ward) => sum + ward.beds, 0);
              return (
                <section key={service} className={styles.serviceStack} aria-label={`${service} wards`}>
                  <div className={stats.serviceHead} style={{ borderBottomColor: SERVICE_COLOUR[service] }}>
                    <h3>{service}</h3>
                    <span className={styles.serviceHeadSub}>
                      {ready} ready · {beds} beds
                    </span>
                  </div>
                  {own.map((ward) => (
                    <WardTile
                      key={ward.unit.id}
                      ward={ward}
                      lockedReady={data.lockedReadyByUnit.get(ward.unit.id) ?? 0}
                      stale={!confirmationIsFresh(ward.unit, now)}
                      selected={ward.unit.id === selectedId}
                      dim={highlight !== "none" && !highlightRule[highlight](ward)}
                      match={highlight !== "none" && highlightRule[highlight](ward)}
                      onSelect={() => setSelectedId((current) => (current === ward.unit.id ? null : ward.unit.id))}
                    />
                  ))}
                </section>
              );
            })}
            <p className={stats.rowSub}>CAHS has no inpatient unit reporting to this board.</p>
          </div>
          <aside className={styles.sticky} aria-label="Ward detail">
            {selected ? (
              <WardDetail
                ward={selected}
                lockedReady={data.lockedReadyByUnit.get(selected.unit.id) ?? 0}
                now={now}
                onClose={() => setSelectedId(null)}
                requestedAt={data.lastRefreshRequest(selected.unit.id)}
                onRequest={() =>
                  world.dispatch({
                    type: "REQUEST_CAPACITY_REFRESH",
                    role: "coordinator",
                    now,
                    unitId: selected.unit.id,
                  })
                }
              />
            ) : (
              <Panel title="Network" meta={asAt.replace("As at ", "")}>
                <BedGrid figures={network} size="sm" />
                <BedLegend figures={network} />
                <p className={stats.note}>Select any ward on the map or in the table to see its detail here.</p>
              </Panel>
            )}
          </aside>
        </div>
        <div className={stats.note}>
          <BedGridLegend />
        </div>
      </Panel>

      <Panel
        title="Wards"
        question="The same figures as the map, for sorting and comparing."
        meta={`${wards.length} wards`}
        flush
      >
        <div className={styles.toolbar} style={{ padding: "0.75rem 1rem 0" }}>
          <label className={styles.toolbarLabel}>
            Order
            <select className={stats.select} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="service">By health service</option>
              <option value="ready">Most ready beds</option>
              <option value="occupancy">Highest occupancy</option>
              <option value="confirmed">Oldest confirmation</option>
            </select>
          </label>
        </div>
        <WardTable
          wards={wards}
          sort={sort}
          lockedReadyByUnit={data.lockedReadyByUnit}
          selectedId={selectedId}
          onSelect={setSelectedId}
          now={now}
        />
      </Panel>

      <BedFlowDefinitions />
      <WardPrototypeFooter testId="capacity-proposal-governance" note="Statewide bed capacity · Not a medical device" />
    </main>
  );
}

function MismatchRows({ gaps }: { gaps: ReturnType<typeof useBedFlowProposal>["gaps"] }) {
  const max = Math.max(1, ...gaps.flatMap((row) => [row.waiting, row.bedsThatFit]));
  return (
    <ul className={styles.gapRows}>
      {gaps.map((row) => (
        <li key={row.id} className={styles.gapRow}>
          <span className={styles.gapName}>
            {capitalise(row.need.replace(/^An? /, ""))}
            <span className={stats.rowSub}>{row.who}</span>
          </span>
          <span className={styles.gapBars} aria-hidden="true">
            <span className={styles.gapBar}>
              Waiting
              <span className={styles.gapTrack}>
                <span className={styles.gapFillNeed} style={{ width: `${(row.waiting / max) * 100}%` }} />
              </span>
              <strong>{row.waiting}</strong>
            </span>
            <span className={styles.gapBar}>
              Fit
              <span className={styles.gapTrack}>
                <span className={styles.gapFillFit} style={{ width: `${(row.bedsThatFit / max) * 100}%` }} />
              </span>
              <strong>{row.bedsThatFit}</strong>
            </span>
          </span>
          <span
            className={`${styles.gapVerdict} ${row.gap < 0 ? styles.dangerText : styles.goodText}`}
            aria-label={`${row.waiting} waiting, ${row.bedsThatFit} beds that fit`}
          >
            {row.gap < 0 ? `${-row.gap} short` : row.gap === 0 ? "Exactly enough" : `${row.gap} spare`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ForecastRange({ hours, low, likely, high }: { hours: number; low: number; likely: number; high: number }) {
  const min = Math.min(low, 0);
  const max = Math.max(high, 0);
  const span = Math.max(1, max - min);
  const at = (value: number) => `${((value - min) / span) * 100}%`;
  return (
    <div className={styles.forecastRow}>
      <span className={stats.rowSub}>In {hours} hours</span>
      <div>
        <strong className={likely < 0 ? styles.dangerText : styles.goodText}>{forecastHeadline(likely)}</strong>
        <div
          className={styles.range}
          role="img"
          aria-label={`Range ${forecastRangeEnd(low)} to ${forecastRangeEnd(high)}, likely ${forecastRangeEnd(likely)}`}
        >
          <span className={styles.rangeLine} style={{ left: at(low), right: `calc(100% - ${at(high)})` }} />
          <span className={styles.rangeZero} style={{ left: at(0) }} />
          <span className={styles.rangeLikely} style={{ left: at(likely) }} />
        </div>
        <div className={styles.rangeLabels}>
          <span>{forecastRangeEnd(low)} if only confirmed discharges go</span>
          <span>{forecastRangeEnd(high)} if every one goes</span>
        </div>
      </div>
    </div>
  );
}

function WardTile({
  ward,
  lockedReady,
  stale,
  selected,
  dim,
  match,
  onSelect,
}: {
  ward: WardFigures;
  lockedReady: number;
  stale: boolean;
  selected: boolean;
  dim: boolean;
  match: boolean;
  onSelect: () => void;
}) {
  const today = releasesToday(ward.releases);
  return (
    <button
      type="button"
      className={`${styles.tile} ${ward.ready === 0 ? styles.tileHot : ""} ${dim ? styles.tileDim : ""} ${
        match ? styles.tileMatch : ""
      }`}
      aria-pressed={selected}
      onClick={onSelect}
      aria-label={`${ward.unit.name}: ${ward.ready} ready${lockedReady ? `, ${lockedReady} locked` : ""}, ${ward.occupied} occupied, ${ward.pulled} pulled, ${ward.closed} closed, of ${ward.beds} beds`}
    >
      <span className={styles.tileHead}>
        <span>{ward.unit.name}</span>
        <span className={styles.tileBeds}>{ward.beds} beds</span>
      </span>
      <BedGrid figures={ward} size="sm" />
      <span className={styles.tileFacts}>
        <span className={ward.ready === 0 ? styles.dangerText : undefined}>
          <strong>{ward.ready}</strong> ready{lockedReady ? ` (${lockedReady} locked)` : ""}
        </span>
        {today ? (
          <span>
            <strong>{today}</strong> free today
          </span>
        ) : null}
        {ward.releases.overdue.expected ? (
          <span className={styles.warnText}>{ward.releases.overdue.expected} past date</span>
        ) : null}
        {stale ? <span className={styles.warnText}>Needs confirming</span> : null}
      </span>
    </button>
  );
}

function WardDetail({
  ward,
  lockedReady,
  requestedAt,
  onRequest,
  onClose,
  now,
}: {
  ward: WardFigures;
  now: number;
  lockedReady: number;
  requestedAt: number | undefined;
  onRequest: () => void;
  onClose: () => void;
}) {
  const fresh = confirmationIsFresh(ward.unit, now);
  const today = releasesToday(ward.releases);
  const confirmedToday =
    ward.releases.now.confirmed +
    ward.releases["by-midday"].confirmed +
    ward.releases["by-1600"].confirmed +
    ward.releases.tonight.confirmed;
  return (
    <Panel
      title="Ward detail"
      meta={
        <button type="button" className={styles.button} onClick={onClose}>
          Back to network
        </button>
      }
    >
      <div className={stats.stack}>
        <div className={styles.detailHead}>
          <h3>{ward.unit.name}</h3>
          <span className={stats.rowSub}>
            {ward.hospital} · {ward.service}
          </span>
        </div>
        <BedGrid figures={ward} />
        <BedLegend figures={ward} />
        <dl className={styles.dl}>
          <dt>Ready</dt>
          <dd>
            {ward.ready}
            {lockedReady ? ` (${lockedReady} locked)` : ""}
          </dd>
          <dt>Being made ready</dt>
          <dd>{ward.beingMadeReady}</dd>
          <dt>On leave (bed held)</dt>
          <dd>{ward.onLeave}</dd>
          <dt>Occupancy</dt>
          <dd>
            <OccupancyPill value={ward.occupancy} />
          </dd>
          <dt>Free before midnight</dt>
          <dd>
            {today} ({confirmedToday} confirmed)
          </dd>
          <dt>Discharges past their date</dt>
          <dd className={ward.releases.overdue.expected ? styles.warnText : undefined}>
            {ward.releases.overdue.expected}
          </dd>
          <dt>Asked and waiting</dt>
          <dd>{ward.askedAndWaiting}</dd>
        </dl>
        <p className={stats.note}>
          <span className={fresh ? undefined : styles.warnText}>
            Bed state confirmed {formatInstantWithDay(ward.unit.allocatable.confirmedAt, now)}
            {fresh ? ", within the ward's window." : ", past the ward's window."}
          </span>
          {requestedAt !== undefined ? ` Update requested ${formatInstantWithDay(requestedAt, now)}.` : ""}
        </p>
        <div className={styles.detailActions}>
          <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={onRequest}>
            Request ward update
          </button>
          <a className={styles.button} href={`/mockups/ward-flow/board/${ward.unit.id}`}>
            Open ward
          </a>
          <a className={styles.button} href="/mockups/ward-flow/discharges">
            Discharges
          </a>
        </div>
        <p className={stats.rowSub}>A request records who asked and when. No message leaves the prototype.</p>
      </div>
    </Panel>
  );
}

function WardTable({
  wards,
  sort,
  lockedReadyByUnit,
  selectedId,
  onSelect,
  now,
}: {
  wards: WardFigures[];
  sort: Sort;
  lockedReadyByUnit: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  const sorted = [...wards].sort((a, b) => {
    if (sort === "ready") return b.ready - a.ready || a.unit.name.localeCompare(b.unit.name);
    if (sort === "occupancy") return b.occupancy - a.occupancy || a.unit.name.localeCompare(b.unit.name);
    if (sort === "confirmed") return a.unit.allocatable.confirmedAt - b.unit.allocatable.confirmedAt;
    return (
      HEALTH_SERVICES.indexOf(a.service) - HEALTH_SERVICES.indexOf(b.service) || a.unit.name.localeCompare(b.unit.name)
    );
  });
  const groups =
    sort === "service"
      ? HEALTH_SERVICES.map((service) => ({ service, rows: sorted.filter((ward) => ward.service === service) })).filter(
          (group) => group.rows.length > 0,
        )
      : [{ service: null, rows: sorted }];
  const sum = (rows: WardFigures[], pick: (ward: WardFigures) => number) => rows.reduce((t, w) => t + pick(w), 0);
  return (
    <TableScroll label="Wards">
      <table className={stats.table}>
        <thead>
          <tr>
            <th>Ward</th>
            <th className={stats.num}>Beds</th>
            <th className={stats.num}>Ready</th>
            <th className={stats.num}>Locked ready</th>
            <th className={stats.num}>Pulled</th>
            <th className={stats.num}>Closed</th>
            <th className={stats.num}>Occupied</th>
            <th className={stats.num}>Occupancy</th>
            <th className={stats.num}>Free today</th>
            <th className={stats.num}>Past date</th>
            <th>Confirmed</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <WardGroup
              key={group.service ?? "all"}
              label={group.service}
              rows={group.rows}
              lockedReadyByUnit={lockedReadyByUnit}
              selectedId={selectedId}
              onSelect={onSelect}
              now={now}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Network</td>
            <td className={stats.num}>{sum(wards, (w) => w.beds)}</td>
            <td className={stats.num}>{sum(wards, (w) => w.ready)}</td>
            <td className={stats.num}>{sum(wards, (w) => lockedReadyByUnit.get(w.unit.id) ?? 0)}</td>
            <td className={stats.num}>{sum(wards, (w) => w.pulled)}</td>
            <td className={stats.num}>{sum(wards, (w) => w.closed)}</td>
            <td className={stats.num}>{sum(wards, (w) => w.occupied)}</td>
            <td className={stats.num}>
              {percent(
                sum(wards, (w) => w.occupied) /
                  Math.max(
                    1,
                    sum(wards, (w) => w.beds),
                  ),
                1,
              )}
            </td>
            <td className={stats.num}>{sum(wards, (w) => releasesToday(w.releases))}</td>
            <td className={stats.num}>{sum(wards, (w) => w.releases.overdue.expected)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </TableScroll>
  );
}

function WardGroup({
  label,
  rows,
  lockedReadyByUnit,
  selectedId,
  onSelect,
  now,
}: {
  label: string | null;
  rows: WardFigures[];
  lockedReadyByUnit: Map<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  const beds = rows.reduce((t, w) => t + w.beds, 0);
  const ready = rows.reduce((t, w) => t + w.ready, 0);
  return (
    <>
      {label ? (
        <tr className={styles.groupRow}>
          <td colSpan={11}>
            {label} · {rows.length} wards · {ready} ready of {beds} beds
          </td>
        </tr>
      ) : null}
      {rows.map((ward) => {
        const fresh = confirmationIsFresh(ward.unit, now);
        const locked = lockedReadyByUnit.get(ward.unit.id) ?? 0;
        return (
          <tr key={ward.unit.id} className={ward.unit.id === selectedId ? styles.selectedRow : undefined}>
            <td>
              <span className={stats.rowName}>
                <button type="button" className={styles.rowButton} onClick={() => onSelect(ward.unit.id)}>
                  {ward.unit.name}
                </button>
                <span className={stats.rowSub}>{ward.hospital}</span>
              </span>
            </td>
            <td className={stats.num}>{ward.beds}</td>
            <td className={`${stats.num} ${ward.ready === 0 ? styles.dangerText : ""}`}>{ward.ready}</td>
            <td className={stats.num}>{locked}</td>
            <td className={stats.num}>{ward.pulled}</td>
            <td className={stats.num}>{ward.closed}</td>
            <td className={stats.num}>{ward.occupied}</td>
            <td className={stats.num}>
              <OccupancyPill value={ward.occupancy} />
            </td>
            <td className={stats.num}>{releasesToday(ward.releases)}</td>
            <td className={`${stats.num} ${ward.releases.overdue.expected ? styles.warnText : ""}`}>
              {ward.releases.overdue.expected}
            </td>
            <td className={fresh ? stats.rowSub : styles.warnText}>
              {formatInstantWithDay(ward.unit.allocatable.confirmedAt, now)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function capitalise(text: string): string {
  return text.replace(/^./, (first) => first.toUpperCase());
}
