"use client";

import { useState } from "react";

import { BedBar, BedLegend } from "@/components/ward-management/statistics/proposal/statistics-proposal-parts";
import { SERVICE_COLOUR, percent } from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";

import type { WardBed } from "./ward-pages-proposal-figures";
import {
  Answer,
  NotWiredButton,
  PageHeader,
  Section,
  WardSubnav,
  plural,
  wardPagesHref,
  type Attention,
} from "./ward-pages-proposal-parts";
import { useWardPagesProposal } from "./use-ward-pages-proposal";
import styles from "./ward-pages-proposal.module.css";

type Filter = "all" | "look" | "leaving" | "empty";
type Tile =
  | { kind: "occupied"; key: string; bed: WardBed }
  | { kind: "pulled"; key: string; label: string }
  | { kind: "closed" | "ready"; key: string };

const needsLook = (bed: WardBed) => bed.pastDate || bed.heldUp || bed.awayAtEd;

/**
 * Proposed bed board. One tile per bed in the ruled order (occupied longest stay first, then pulled,
 * closed, ready), the same four counts as every other screen, and a side panel for the chosen bed
 * instead of a separate page.
 */
export function BoardProposal({ unitId }: { unitId?: string }) {
  const { ward, detail, asAt, now, world } = useWardPagesProposal(unitId);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  if (!ward || !detail) return <p className={styles.empty}>No wards in this network.</p>;
  const { unit } = ward;
  const { beds } = detail;
  const initials = (bed: WardBed) => world.resolvePatientIdentity(bed.admission).initials || "Initials not recorded";

  const pulledAdmissions = world.admissions.filter(
    (admission) => admission.unitId === unit.id && admission.state === "pulled",
  );
  const tiles: Tile[] = [
    ...beds.map((bed) => ({ kind: "occupied" as const, key: bed.admission.id, bed })),
    ...Array.from({ length: ward.pulled }, (_, index) => ({
      kind: "pulled" as const,
      key: `pulled-${index}`,
      label: pulledAdmissions[index] ? world.resolvePatientIdentity(pulledAdmissions[index]).initials : "",
    })),
    ...Array.from({ length: ward.closed }, (_, index) => ({ kind: "closed" as const, key: `closed-${index}` })),
    ...Array.from({ length: ward.ready }, (_, index) => ({ kind: "ready" as const, key: `ready-${index}` })),
  ];
  const matches = (tile: Tile) =>
    filter === "all"
      ? true
      : filter === "look"
        ? tile.kind === "occupied" && needsLook(tile.bed)
        : filter === "leaving"
          ? tile.kind === "occupied" && tile.bed.leavingToday
          : tile.kind === "ready" || tile.kind === "closed";
  const counts = {
    all: tiles.length,
    look: beds.filter(needsLook).length,
    leaving: beds.filter((bed) => bed.leavingToday).length,
    empty: ward.ready + ward.closed,
  };
  const chosen = beds.find((bed) => bed.admission.id === selected) ?? null;
  const release = chosen
    ? world.bedReleases.find((entry) => entry.admissionId === chosen.admission.id && entry.state !== "discharged")
    : undefined;

  const attention: Attention[] = [];
  if (detail.pastDate.length)
    attention.push({
      tone: "warn",
      label: `${plural(detail.pastDate.length, "person", "people")} past the ward's expected date`,
    });
  if (detail.heldUp.length)
    attention.push({ tone: "warn", label: `${plural(detail.heldUp.length, "discharge")} held up` });
  if (detail.awayAtEd.length)
    attention.push({
      tone: "info",
      label: `${plural(detail.awayAtEd.length, "bed")} held for someone at an emergency department`,
    });
  const mismatch = beds.length !== ward.occupied;

  return (
    <main id="main-content" className={styles.page} data-testid="ward-pages-proposal-board">
      <PageHeader
        crumbs={[
          { label: "Ward Hub", href: wardPagesHref("hub") },
          { label: unit.name, href: wardPagesHref("ward", unit.id) },
          { label: "Bed board" },
        ]}
        title="Bed board"
        dotColour={SERVICE_COLOUR[ward.service]}
        subline={`${unit.name} · ${ward.hospital}`}
        asAt={asAt}
      />
      <WardSubnav unitId={unit.id} active="board" requests={detail.requests.length} beds={unit.beds} />

      <Answer attention={attention}>
        <strong>
          {ward.occupied} of {ward.beds} beds occupied ({percent(ward.occupancy)})
        </strong>
        , {ward.pulled} pulled, {ward.closed} closed and {ward.ready} ready. {detail.leaving.today} expected to leave
        today.
      </Answer>

      <section className={styles.section} aria-label="Bed split">
        <BedBar figures={ward} large />
        <BedLegend figures={ward} />
      </section>

      <div className={styles.columns}>
        <Section title="Every bed" meta={`Longest stay first · ${tiles.filter(matches).length} shown`}>
          <div className={styles.filters} role="group" aria-label="Show beds">
            {(
              [
                ["all", "All beds"],
                ["look", "Needs a look"],
                ["leaving", "Leaving today"],
                ["empty", "Empty"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={styles.filter}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label} <span className={styles.count}>{counts[value]}</span>
              </button>
            ))}
          </div>
          <div className={styles.bedGrid}>
            {tiles.map((tile) =>
              tile.kind === "occupied" ? (
                <button
                  key={tile.key}
                  type="button"
                  className={styles.bedTile}
                  data-kind="occupied"
                  data-dim={!matches(tile)}
                  aria-pressed={selected === tile.key}
                  onClick={() => setSelected(selected === tile.key ? null : tile.key)}
                >
                  <span className={styles.bedTop}>
                    <span>{initials(tile.bed)}</span>
                    <span>
                      <span className={styles.bedDays}>{tile.bed.days ?? "–"}</span> days
                    </span>
                  </span>
                  <span className={styles.rowSub}>
                    {tile.bed.admission.sex} · {tile.bed.stayLabel.toLowerCase()}
                  </span>
                  <span className={styles.bedFlags}>
                    {tile.bed.pastDate ? <span className={styles.warnText}>Date passed</span> : null}
                    {tile.bed.heldUp ? <span className={styles.warnText}>Held up</span> : null}
                    {tile.bed.awayAtEd ? <span>At an ED</span> : null}
                    {tile.bed.onLeave ? <span>On leave</span> : null}
                    {tile.bed.leavingToday ? <span className={styles.goodText}>Leaving today</span> : null}
                  </span>
                </button>
              ) : (
                <div key={tile.key} className={styles.bedTile} data-kind={tile.kind} data-dim={!matches(tile)}>
                  <span className={styles.bedTop}>
                    <span>{tile.kind === "pulled" ? "Pulled" : tile.kind === "closed" ? "Closed" : "Ready"}</span>
                  </span>
                  <span className={styles.rowSub}>
                    {tile.kind === "pulled"
                      ? `Given to ${tile.label || "someone"}, not yet arrived`
                      : tile.kind === "closed"
                        ? "Empty, not offered"
                        : "Empty and offered"}
                  </span>
                </div>
              ),
            )}
          </div>
          {mismatch ? (
            <p className={styles.note}>
              The ward&rsquo;s count says {ward.occupied} occupied but {beds.length} stays are recorded. The tiles show
              the recorded stays.
            </p>
          ) : null}
          <p className={styles.note}>
            Initials only. Bed numbers are not recorded, so tiles are in stay order, not bed order.
          </p>
        </Section>

        <div className={styles.inspector}>
          <Section title={chosen ? `Bed: ${initials(chosen)}` : "Choose a bed"} sheet>
            {chosen ? (
              <>
                <dl className={styles.factList}>
                  <dt>In bed</dt>
                  <dd className={styles.num}>{chosen.days ?? "Not recorded"} days</dd>
                  <dt>Stay band</dt>
                  <dd>{chosen.stayLabel}</dd>
                  <dt>Ward&rsquo;s expected date</dt>
                  <dd className={chosen.pastDate ? styles.warnText : ""}>
                    {chosen.admission.expectedDischargeAt !== null
                      ? formatInstantWithDay(chosen.admission.expectedDischargeAt, now)
                      : "Not recorded"}
                  </dd>
                  <dt>Discharge</dt>
                  <dd>
                    {release
                      ? `${release.state === "confirmed" ? "Confirmed" : "Expected"} ${formatInstantWithDay(release.expectedAt, now)}`
                      : "None planned"}
                  </dd>
                  <dt>Held up by</dt>
                  <dd>{chosen.admission.blockReason ?? "Nothing recorded"}</dd>
                  <dt>Away</dt>
                  <dd>
                    {chosen.onLeave
                      ? "On leave, bed held"
                      : chosen.awayAtEd
                        ? "At an emergency department, bed held"
                        : "No"}
                  </dd>
                </dl>
                <div className={styles.filters}>
                  <NotWiredButton>They have left</NotWiredButton>
                  <NotWiredButton>Record a blocker</NotWiredButton>
                </div>
              </>
            ) : (
              <p className={styles.empty}>
                Select an occupied bed to see its stay, expected date and anything holding it up.
              </p>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}
