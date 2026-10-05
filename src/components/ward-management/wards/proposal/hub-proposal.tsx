"use client";

import { useMemo, useState } from "react";

import { BedBar } from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import {
  SERVICE_COLOUR,
  percent,
  releasesToday,
  type WardFigures,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import statStyles from "@/components/ward-management/statistics/proposal/statistics-proposal.module.css";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";

import { peopleAwaitingAnswer, requestsFor } from "./ward-pages-proposal-figures";
import {
  Answer,
  Figures,
  PageHeader,
  Section,
  plural,
  wardPagesHref,
  type Attention,
} from "./ward-pages-proposal-parts";
import { useWardPagesProposal } from "./use-ward-pages-proposal";
import styles from "./ward-pages-proposal.module.css";

type Sort = "service" | "fewest-ready" | "occupancy" | "requests";

/**
 * Proposed Ward Hub. Answers "where is there a bed, and which ward needs a call?" in one sentence,
 * then lists every ward as one flat row on the same four-box bed figures as statistics.
 */
export function HubProposal() {
  const { wards, network, asAt, world, now } = useWardPagesProposal();
  const [service, setService] = useState<HealthService | "all">("all");
  const [query, setQuery] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("service");

  const rows = useMemo(
    () =>
      wards.map((ward) => ({
        ward,
        requests: requestsFor(ward.unit.id, world.movements, now).length,
        freeToday: releasesToday(ward.releases),
        overdue: ward.releases.overdue.expected,
      })),
    [wards, world.movements, now],
  );

  // One person asked of several wards is one person waiting; the rows still count per ward.
  const totalRequests = peopleAwaitingAnswer(
    wards.map((ward) => ward.unit.id),
    world.movements,
    now,
  );
  const totalFreeToday = rows.reduce((sum, row) => sum + row.freeToday, 0);
  const totalOverdue = rows.reduce((sum, row) => sum + row.overdue, 0);
  const noReady = rows.filter((row) => row.ward.ready === 0);
  const askedNoReady = rows.filter((row) => row.ward.ready === 0 && row.requests > 0);

  const needle = query.trim().toLowerCase();
  const visible = rows
    .filter((row) => service === "all" || row.ward.service === service)
    .filter((row) => !readyOnly || row.ward.ready > 0)
    .filter(
      (row) =>
        !needle || `${row.ward.unit.name} ${row.ward.hospital} ${row.ward.service}`.toLowerCase().includes(needle),
    );
  const sorted = [...visible].sort((a, b) =>
    sort === "fewest-ready"
      ? a.ward.ready - b.ward.ready || b.ward.occupancy - a.ward.occupancy
      : sort === "occupancy"
        ? b.ward.occupancy - a.ward.occupancy
        : sort === "requests"
          ? b.requests - a.requests
          : 0,
  );
  const groups: { service: HealthService | null; rows: typeof sorted }[] =
    sort === "service"
      ? HEALTH_SERVICES.map((name) => ({
          service: name,
          rows: sorted.filter((row) => row.ward.service === name),
        })).filter((group) => group.rows.length)
      : [{ service: null, rows: sorted }];

  const attention: Attention[] = [];
  if (askedNoReady.length)
    attention.push({
      tone: "danger",
      label: `${plural(askedNoReady.length, "ward")} asked for a bed with none ready: ${askedNoReady
        .map((row) => row.ward.unit.name)
        .join(", ")}`,
    });
  if (totalRequests)
    attention.push({ tone: "warn", label: `${plural(totalRequests, "person", "people")} waiting for a ward's answer` });
  if (totalOverdue)
    attention.push({
      tone: "warn",
      label: `${plural(totalOverdue, "expected discharge")} dated on an earlier day, not confirmed`,
    });
  if (totalFreeToday)
    attention.push({ tone: "good", label: `${plural(totalFreeToday, "bed")} expected to come free today` });

  return (
    <main id="main-content" className={styles.page} data-testid="ward-pages-proposal-hub">
      <PageHeader
        crumbs={[{ label: "Ward Flow" }, { label: "Wards" }]}
        title="Ward Hub"
        subline={`${plural(wards.length, "ward")} in ${new Set(wards.map((ward) => ward.service)).size} health services`}
        asAt={asAt}
      />

      <Answer attention={attention}>
        <strong>
          {network.ready} {network.ready === 1 ? "bed is" : "beds are"} ready across {plural(wards.length, "ward")}
        </strong>
        , and {network.occupied} of {network.beds} beds are occupied (
        {percent(network.occupied / Math.max(1, network.beds), 1)}).{" "}
        {noReady.length
          ? `${plural(noReady.length, "ward")} ${noReady.length === 1 ? "has" : "have"} no ready bed.`
          : "Every ward has at least one ready bed."}
      </Answer>

      <Figures
        label="Network bed figures"
        items={[
          { label: "Beds", value: network.beds, note: plural(wards.length, "ward") },
          {
            label: "Occupied",
            value: network.occupied,
            note: `${percent(network.occupied / Math.max(1, network.beds), 1)} · ${network.onLeave} on leave`,
            keyClass: statStyles.segOccupied,
          },
          {
            label: "Ready",
            value: network.ready,
            note: `${plural(noReady.length, "ward")} with none`,
            keyClass: statStyles.segReady,
            tone: "good",
          },
          { label: "Pulled", value: network.pulled, note: "given, not arrived", keyClass: statStyles.segPulled },
          { label: "Closed", value: network.closed, note: "empty, not offered", keyClass: statStyles.segClosed },
          { label: "Free today", value: totalFreeToday, note: "confirmed and expected" },
          { label: "Bed requests", value: totalRequests, note: "people waiting for an answer" },
        ]}
      />

      <Section title="Every ward" meta={`Showing ${visible.length} of ${wards.length}`}>
        <div className={styles.toolbar} role="group" aria-label="Filter wards">
          <div className={styles.filters}>
            <button
              type="button"
              className={styles.filter}
              aria-pressed={service === "all"}
              onClick={() => setService("all")}
            >
              All <span className={styles.count}>{wards.length}</span>
            </button>
            {HEALTH_SERVICES.filter((name) => wards.some((ward) => ward.service === name)).map((name) => (
              <button
                key={name}
                type="button"
                className={styles.filter}
                aria-pressed={service === name}
                onClick={() => setService(name)}
              >
                <span className={styles.dot} style={{ background: SERVICE_COLOUR[name] }} aria-hidden="true" />
                {name} <span className={styles.count}>{wards.filter((ward) => ward.service === name).length}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.filter}
            aria-pressed={readyOnly}
            onClick={() => setReadyOnly((value) => !value)}
          >
            Ready bed only
          </button>
          <input
            className={styles.search}
            type="search"
            placeholder="Find a ward or hospital"
            aria-label="Find a ward or hospital"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className={styles.toolbarEnd}>
            Order{" "}
            <select className={styles.select} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="service">By health service</option>
              <option value="fewest-ready">Fewest ready first</option>
              <option value="occupancy">Fullest first</option>
              <option value="requests">Most requests first</option>
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <p className={styles.empty}>No ward matches these filters.</p>
        ) : (
          <table className={styles.table}>
            <caption className={styles.srOnly}>Every ward with its bed figures</caption>
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col">Beds now</th>
                <th scope="col" className={styles.numCol}>
                  Beds
                </th>
                <th scope="col" className={styles.numCol}>
                  Occupied
                </th>
                <th scope="col" className={styles.numCol}>
                  Ready
                </th>
                <th scope="col" className={styles.numCol}>
                  Pulled
                </th>
                <th scope="col" className={styles.numCol}>
                  Closed
                </th>
                <th scope="col" className={styles.numCol}>
                  Free today
                </th>
                <th scope="col" className={styles.numCol}>
                  Bed requests
                </th>
                <th scope="col">
                  <span className={styles.srOnly}>Open</span>
                </th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.service ?? "all"}>
                {group.service ? (
                  <tr className={styles.groupRow}>
                    <th colSpan={10} scope="colgroup">
                      {group.service}
                      <span>
                        {plural(group.rows.length, "ward")} · {group.rows.reduce((sum, row) => sum + row.ward.ready, 0)}{" "}
                        ready
                      </span>
                    </th>
                  </tr>
                ) : null}
                {group.rows.map((row) => (
                  <HubRow key={row.ward.unit.id} ward={row.ward} requests={row.requests} freeToday={row.freeToday} />
                ))}
              </tbody>
            ))}
          </table>
        )}
        <p className={styles.note}>
          Occupied counts people in a bed, including on leave. Pulled is a bed given to someone not yet arrived. Closed
          is empty but not offered. The four add up to the ward&rsquo;s beds, and these are the same figures as
          Statistics.
        </p>
      </Section>
    </main>
  );
}

function HubRow({ ward, requests, freeToday }: { ward: WardFigures; requests: number; freeToday: number }) {
  return (
    <tr>
      <td>
        <span className={styles.wardName}>
          <span className={styles.dot} style={{ background: SERVICE_COLOUR[ward.service] }} aria-hidden="true" />
          <span>
            <a href={wardPagesHref("ward", ward.unit.id)}>{ward.unit.name}</a>
            <span className={styles.wardHospital}>{ward.hospital}</span>
          </span>
        </span>
      </td>
      <td className={styles.barCell}>
        <BedBar figures={ward} />
      </td>
      <td className={styles.numCol}>{ward.beds}</td>
      <td className={styles.numCol}>
        {ward.occupied} <span className={styles.inlineNote}>{percent(ward.occupancy)}</span>
      </td>
      <td className={`${styles.numCol} ${ward.ready === 0 ? styles.dangerText : ""}`}>{ward.ready}</td>
      <td className={styles.numCol}>{ward.pulled}</td>
      <td className={styles.numCol}>{ward.closed}</td>
      <td className={styles.numCol}>{freeToday}</td>
      <td className={`${styles.numCol} ${requests && ward.ready === 0 ? styles.dangerText : ""}`}>
        {requests ? (
          <a className={styles.link} href={wardPagesHref("answer", ward.unit.id)}>
            {requests}
          </a>
        ) : (
          0
        )}
      </td>
      <td>
        <a
          className={styles.link}
          href={wardPagesHref("board", ward.unit.id)}
          aria-label={`Bed board for ${ward.unit.name}`}
        >
          Bed board
        </a>
      </td>
    </tr>
  );
}
