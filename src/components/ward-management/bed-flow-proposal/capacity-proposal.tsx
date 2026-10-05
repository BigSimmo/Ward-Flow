"use client";

import { useState, type ReactNode } from "react";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BedMeetingSheetLauncher } from "@/components/ward-management/capacity/bed-meeting-sheet";
import { forecastHeadline, forecastRangeEnd } from "@/components/ward-management/capacity/beds-forecast";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  BedGrid,
  BedGridLegend,
  BedLegend,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import {
  SERVICE_COLOUR,
  percent,
  releasesToday,
  type WardFigures,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

import { BedFlowDefinitions } from "./bed-flow-definitions";
import { Answer, FactLine, Figures, ReleaseList, Section, type Concern } from "./bed-flow-parts";
import { confirmationIsFresh, useBedFlowProposal } from "./use-bed-flow-proposal";
import styles from "./bed-flow-proposal.module.css";

type Highlight = "none" | "no-ready" | "locked-ready" | "stale" | "overdue";
type Sort = "service" | "ready" | "occupancy" | "confirmed";

/**
 * Proposed Capacity screen. For a bed flow coordinator at the morning bed meeting: where can the
 * next person go, and where will we run short? One sentence answers it, then the bed-kind
 * mismatch, when beds come free, one bed map with ward detail beside it, and one ward table.
 * Every bed figure is the statistics proposal's `bedStates` split.
 */
export function CapacityProposal() {
  const data = useBedFlowProposal();
  const { world, now, wards, network, asAt, gaps, gapTotals, needing, open, releases, freeToday, forecast } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Highlight>("none");
  const [sort, setSort] = useState<Sort>("service");
  const selected = wards.find((ward) => ward.unit.id === selectedId);

  const noReady = wards.filter((ward) => ward.ready === 0);
  const shortKinds = gaps.filter((row) => row.gap < 0).sort((a, b) => a.gap - b.gap);
  const lockedReadyOf = (ward: WardFigures) => data.lockedReadyByUnit.get(ward.unit.id) ?? 0;
  const highlightRule: Record<Highlight, (ward: WardFigures) => boolean> = {
    none: () => false,
    "no-ready": (ward) => ward.ready === 0,
    "locked-ready": (ward) => lockedReadyOf(ward) > 0,
    stale: (ward) => !confirmationIsFresh(ward.unit, now),
    overdue: (ward) => ward.releases.overdue.expected > 0,
  };
  const highlightCount = wards.filter(highlightRule[highlight]).length;
  // Spare youth beds cannot take an adult, so the shortfall adds the short kinds rather than netting them.
  const shortfall = shortKinds.reduce((total, row) => total - row.gap, 0);

  const concerns: Concern[] = [
    ...shortKinds.map((row) => ({ tone: "danger" as const, label: `${kindName(row.need)}: ${-row.gap} short` })),
    ...(noReady.length
      ? [
          {
            tone: "danger" as const,
            label: `${noReady.length} ${noReady.length === 1 ? "ward has" : "wards have"} no ready bed`,
          },
        ]
      : []),
    ...(releases.overdue.expected
      ? [
          {
            tone: "warn" as const,
            label: `${releases.overdue.expected} expected ${releases.overdue.expected === 1 ? "discharge is" : "discharges are"} past their date`,
          },
        ]
      : []),
    ...data.stale.map((ward) => ({
      tone: "warn" as const,
      label: `${ward.unit.name}: bed state not confirmed recently`,
    })),
  ];

  return (
    <main id="main-content" className={styles.page} data-testid="capacity-proposal">
      <PageHeader
        title="Capacity"
        asAt={asAt}
        links={
          <>
            <BedMeetingSheetLauncher
              now={now}
              buttonClassName={styles.textLink}
              buildSheet={() =>
                bedMeetingSheet({
                  units: world.units,
                  movements: world.movements,
                  bedReleases: world.bedReleases,
                  admissions: world.admissions,
                  leaveBeds: world.leaveBeds,
                  now,
                  service: null,
                  nameOf: (movement) => movement.id,
                })
              }
            />
            <a className={styles.textLink} href="/mockups/ward-flow/network/proposal">
              Network
            </a>
          </>
        }
      />

      <Answer concerns={concerns}>
        {needing.length === 0 ? (
          <strong>
            Nobody is waiting for a bed. {network.ready} {network.ready === 1 ? "bed is" : "beds are"} ready.
          </strong>
        ) : (
          <>
            <strong>
              {network.ready} {network.ready === 1 ? "bed is" : "beds are"} ready for {needing.length}{" "}
              {needing.length === 1 ? "person" : "people"} still waiting
            </strong>
            {shortfall > 0
              ? `, but ${shortfall} ${shortfall === 1 ? "person has" : "people have"} no bed of the right kind now`
              : ", and every person has a bed that fits"}
            . {shortKinds.length ? `The biggest gap is ${kindName(shortKinds[0].need).toLowerCase()}s. ` : ""}
            {freeToday} more {freeToday === 1 ? "is" : "are"} expected free before midnight.
          </>
        )}
      </Answer>

      <Figures
        label="Network bed figures"
        items={[
          { label: "Beds", value: network.beds, note: `${wards.length} wards` },
          {
            label: "Occupied",
            value: network.occupied,
            note: `${network.beds ? percent(network.occupied / network.beds, 1) : "0%"} · ${network.onLeave} on leave`,
          },
          { label: "Pulled", value: network.pulled, note: "Bed given, not arrived" },
          { label: "Closed", value: network.closed, note: "Empty, not offered" },
          {
            label: "Ready",
            value: network.ready,
            note: `${data.lockedReady} locked · ${network.beingMadeReady} being made ready`,
          },
          {
            label: "Still need a bed",
            value: needing.length,
            tone: needing.length > network.ready ? "danger" : undefined,
            note: `of ${open.length} on emergency department lists`,
          },
          { label: "Free by midnight", value: freeToday, note: "Confirmed and expected" },
        ]}
      />

      <div className={styles.twoUp}>
        <Section
          title="Where the mismatch is"
          question="Ready beds that suit each kind of need, against the people still waiting for one."
          meta={`${gapTotals.waiting} waiting · ${gapTotals.bedsThatFit} fit`}
          foot={`Counts people at placement requested, destination review or accepted. The ${open.length - needing.length} with a bed already pulled, or on their way, are left out.`}
        >
          <MismatchRows gaps={gaps} />
        </Section>

        <Section
          title="When beds come free"
          question="Discharges by when the bed is expected back."
          meta="Whole network"
        >
          <ReleaseList releases={releases} pastHref="/mockups/ward-flow/discharges" />
          <div className={styles.forecast}>
            <p className={styles.label}>After today (estimate)</p>
            {forecast.horizons.map((horizon) => (
              <ForecastRange key={horizon.hours} {...horizon} />
            ))}
            <p className={styles.note}>
              Ready beds plus discharges due, minus the {needing.length} people still waiting. New arrivals at emergency
              departments are not predicted.
            </p>
          </div>
        </Section>
      </div>

      <Section
        title="Bed map"
        question="Every ward, one square per bed. Select a ward to see its detail."
        meta={`${network.beds} beds · ${wards.length} wards`}
        foot={<BedGridLegend />}
      >
        <div className={styles.toolbar}>
          <div className={styles.toolbarLabel}>
            Highlight
            <div className={styles.segmented} role="group" aria-label="Highlight wards">
              {(
                [
                  ["none", "Nothing"],
                  ["no-ready", `No ready bed · ${wards.filter(highlightRule["no-ready"]).length}`],
                  ["locked-ready", `Locked bed ready · ${wards.filter(highlightRule["locked-ready"]).length}`],
                  ["overdue", `Discharge past date · ${wards.filter(highlightRule.overdue).length}`],
                  ["stale", `Not confirmed recently · ${data.stale.length}`],
                ] as [Highlight, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={highlight === id} onClick={() => setHighlight(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <span className={styles.note} aria-live="polite">
            {highlight === "none"
              ? "Highlighting marks wards. It never hides one."
              : `${highlightCount} of ${wards.length} wards marked. Every ward stays on the map.`}
          </span>
        </div>
        <div className={styles.mapLayout}>
          <div className={styles.services}>
            {HEALTH_SERVICES.map((service) => {
              const own = wards.filter((ward) => ward.service === service);
              if (own.length === 0) return null;
              return (
                <section key={service} className={styles.service} aria-label={`${service} wards`}>
                  <div className={styles.serviceHead}>
                    <h3 className={styles.serviceName}>
                      <span className={styles.dot} style={{ background: SERVICE_COLOUR[service] }} aria-hidden="true" />
                      {service}
                    </h3>
                    <span className={styles.rowBeds}>
                      {own.reduce((sum, ward) => sum + ward.ready, 0)} ready ·{" "}
                      {own.reduce((sum, ward) => sum + ward.beds, 0)} beds
                    </span>
                  </div>
                  <ul className={styles.rows}>
                    {own.map((ward) => (
                      <li key={ward.unit.id}>
                        <WardRow
                          ward={ward}
                          lockedReady={lockedReadyOf(ward)}
                          stale={!confirmationIsFresh(ward.unit, now)}
                          selected={ward.unit.id === selectedId}
                          dim={highlight !== "none" && !highlightRule[highlight](ward)}
                          match={highlight !== "none" && highlightRule[highlight](ward)}
                          onSelect={() => setSelectedId((current) => (current === ward.unit.id ? null : ward.unit.id))}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <p className={styles.note}>CAHS has no inpatient unit reporting to this board.</p>
          </div>
          <aside className={styles.sticky} aria-label="Ward detail">
            {selected ? (
              <WardDetail
                ward={selected}
                now={now}
                lockedReady={lockedReadyOf(selected)}
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
              <Section title="Whole network" raised meta={asAt.replace("As at ", "")}>
                <BedGrid figures={network} size="sm" />
                <BedLegend figures={network} />
                <p className={styles.note}>Select a ward on the map or in the table to see its detail here.</p>
              </Section>
            )}
          </aside>
        </div>
      </Section>

      <Section
        title="Wards"
        question="The same figures as the map, to sort and compare."
        meta={
          <label className={styles.toolbarLabel}>
            Order
            <select
              id="capacity-proposal-order"
              className={styles.select}
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
            >
              <option value="service">By health service</option>
              <option value="ready">Most ready beds</option>
              <option value="occupancy">Highest occupancy</option>
              <option value="confirmed">Oldest confirmation</option>
            </select>
          </label>
        }
      >
        <WardTable
          wards={wards}
          sort={sort}
          lockedReadyOf={lockedReadyOf}
          selectedId={selectedId}
          onSelect={setSelectedId}
          now={now}
        />
      </Section>

      <BedFlowDefinitions />
      <WardPrototypeFooter testId="capacity-proposal-governance" note="Statewide bed capacity · Not a medical device" />
    </main>
  );
}

/** The page header shared by both proposal screens: crumbs, title, as-at time, quiet links. */
export function PageHeader({ title, asAt, links }: { title: string; asAt: string; links?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.crumbs}>Operations › {title}</p>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.headerSide}>
        {links}
        <span>{asAt}</span>
        <span className={styles.rowName}>
          <span className={styles.dot} aria-hidden="true" />
          Synthetic data
        </span>
      </div>
    </header>
  );
}

function kindName(need: string): string {
  return need.replace(/^An? /, "").replace(/^./, (first) => first.toUpperCase());
}

function MismatchRows({ gaps }: { gaps: ReturnType<typeof useBedFlowProposal>["gaps"] }) {
  const max = Math.max(1, ...gaps.flatMap((row) => [row.waiting, row.bedsThatFit]));
  return (
    <ul className={styles.gapRows}>
      {gaps.map((row) => (
        <li key={row.id} className={styles.gapRow}>
          <span className={styles.gapName}>
            {kindName(row.need)}
            <span className={styles.factLine}>{row.who}</span>
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
            className={`${styles.gapVerdict} ${row.gap < 0 ? styles.dangerText : ""}`}
            aria-label={`${row.waiting} waiting, ${row.bedsThatFit} beds that fit`}
          >
            {row.gap < 0 ? `${-row.gap} short` : row.gap === 0 ? "Enough" : `${row.gap} spare`}
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
      <span className={styles.factLine}>In {hours} hours</span>
      <div>
        <strong className={likely < 0 ? styles.dangerText : undefined}>{forecastHeadline(likely)}</strong>
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

function WardRow({
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
      className={`${styles.row} ${dim ? styles.rowDim : ""} ${match ? styles.rowMatch : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
      aria-label={`${ward.unit.name}${match ? " (marked)" : ""}: ${ward.ready} ready${lockedReady ? `, ${lockedReady} locked` : ""}, ${ward.occupied} occupied, ${ward.pulled} pulled, ${ward.closed} closed, of ${ward.beds} beds`}
    >
      <span className={styles.rowHead}>
        <span className={styles.rowName}>
          {ward.ready === 0 ? <span className={`${styles.dot} ${styles.dotDanger}`} aria-hidden="true" /> : null}
          {ward.unit.name}
        </span>
        <span className={styles.rowBeds}>{ward.beds} beds</span>
      </span>
      <BedGrid figures={ward} size="sm" />
      <FactLine
        parts={[
          <span key="ready" className={ward.ready === 0 ? styles.dangerText : undefined}>
            {ward.ready} ready{lockedReady ? ` (${lockedReady} locked)` : ""}
          </span>,
          today ? `${today} free today` : null,
          ward.releases.overdue.expected ? <span key="past">{ward.releases.overdue.expected} past date</span> : null,
          stale ? <span key="stale">Not confirmed recently</span> : null,
        ]}
      />
    </button>
  );
}

function WardDetail({
  ward,
  now,
  lockedReady,
  requestedAt,
  onRequest,
  onClose,
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
    <Section
      title={ward.unit.name}
      raised
      meta={
        <button type="button" className={styles.linkButton} onClick={onClose}>
          Close
        </button>
      }
    >
      <span className={styles.factLine}>
        {ward.hospital} · {ward.service}
      </span>
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
        <dd>{percent(ward.occupancy)}</dd>
        <dt>Free before midnight</dt>
        <dd>
          {today} ({confirmedToday} confirmed)
        </dd>
        <dt>Expected discharges past their date</dt>
        <dd>{ward.releases.overdue.expected}</dd>
        <dt>Referrals waiting for this ward&apos;s answer</dt>
        <dd>{ward.askedAndWaiting}</dd>
      </dl>
      <p className={styles.note}>
        Bed state confirmed {formatInstantWithDay(ward.unit.allocatable.confirmedAt, now)}
        {fresh ? ", within the ward's window." : ", outside the ward's window."}
        {requestedAt !== undefined ? ` Update requested ${formatInstantWithDay(requestedAt, now)}.` : ""}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onRequest}>
          Request ward update
        </button>
        <a className={styles.textLink} href={`/mockups/ward-flow/board/${ward.unit.id}`}>
          Open ward
        </a>
        <a className={styles.textLink} href="/mockups/ward-flow/discharges">
          Discharges
        </a>
      </div>
      <p className={styles.note}>A request records who asked and when. No message leaves the prototype.</p>
    </Section>
  );
}

function WardTable({
  wards,
  sort,
  lockedReadyOf,
  selectedId,
  onSelect,
  now,
}: {
  wards: WardFigures[];
  sort: Sort;
  lockedReadyOf: (ward: WardFigures) => number;
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
  const sum = (pick: (ward: WardFigures) => number) => wards.reduce((total, ward) => total + pick(ward), 0);
  const beds = sum((ward) => ward.beds);
  return (
    <div className={styles.tableScroll} role="region" aria-label="Wards table" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ward</th>
            <th className={styles.num}>Beds</th>
            <th className={styles.num}>Ready</th>
            <th className={styles.num}>Locked ready</th>
            <th className={styles.num}>Pulled</th>
            <th className={styles.num}>Closed</th>
            <th className={styles.num}>Occupied</th>
            <th className={styles.num}>Occupancy</th>
            <th className={styles.num}>Free today</th>
            <th className={styles.num}>Past date</th>
            <th>Confirmed</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <WardGroup
              key={group.service ?? "all"}
              label={group.service}
              rows={group.rows}
              lockedReadyOf={lockedReadyOf}
              selectedId={selectedId}
              onSelect={onSelect}
              now={now}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Network</td>
            <td className={styles.num}>{beds}</td>
            <td className={styles.num}>{sum((ward) => ward.ready)}</td>
            <td className={styles.num}>{sum(lockedReadyOf)}</td>
            <td className={styles.num}>{sum((ward) => ward.pulled)}</td>
            <td className={styles.num}>{sum((ward) => ward.closed)}</td>
            <td className={styles.num}>{sum((ward) => ward.occupied)}</td>
            <td className={styles.num}>{beds ? percent(sum((ward) => ward.occupied) / beds, 1) : "0%"}</td>
            <td className={styles.num}>{sum((ward) => releasesToday(ward.releases))}</td>
            <td className={styles.num}>{sum((ward) => ward.releases.overdue.expected)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function WardGroup({
  label,
  rows,
  lockedReadyOf,
  selectedId,
  onSelect,
  now,
}: {
  label: string | null;
  rows: WardFigures[];
  lockedReadyOf: (ward: WardFigures) => number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  return (
    <>
      {label ? (
        <tr className={styles.groupRow}>
          <td colSpan={11}>
            {label} · {rows.length} wards · {rows.reduce((total, ward) => total + ward.ready, 0)} ready of{" "}
            {rows.reduce((total, ward) => total + ward.beds, 0)} beds
          </td>
        </tr>
      ) : null}
      {rows.map((ward) => {
        const fresh = confirmationIsFresh(ward.unit, now);
        return (
          <tr key={ward.unit.id} className={ward.unit.id === selectedId ? styles.selectedRow : undefined}>
            <td>
              <span className={styles.cellName}>
                <button type="button" className={styles.rowButton} onClick={() => onSelect(ward.unit.id)}>
                  {ward.unit.name}
                </button>
                <span className={styles.factLine}>{ward.hospital}</span>
              </span>
            </td>
            <td className={styles.num}>{ward.beds}</td>
            <td className={`${styles.num} ${ward.ready === 0 ? styles.dangerText : ""}`}>{ward.ready}</td>
            <td className={styles.num}>{lockedReadyOf(ward)}</td>
            <td className={styles.num}>{ward.pulled}</td>
            <td className={styles.num}>{ward.closed}</td>
            <td className={styles.num}>{ward.occupied}</td>
            <td className={styles.num}>{percent(ward.occupancy)}</td>
            <td className={styles.num}>{releasesToday(ward.releases)}</td>
            <td className={styles.num}>{ward.releases.overdue.expected}</td>
            <td className={styles.factLine}>
              {formatInstantWithDay(ward.unit.allocatable.confirmedAt, now)}
              {fresh ? "" : " · not recent"}
            </td>
          </tr>
        );
      })}
    </>
  );
}
