"use client";

import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";

import {
  buildToolsFigures,
  type ToolsFigureGroup,
  type ToolsFigureRow,
  type ToolsFiguresInput,
} from "./tools-figures-model";
import styles from "./tools-figures.module.css";

const GROUPS: readonly { id: ToolsFigureGroup; label: string }[] = [
  { id: "beds", label: "Beds" },
  { id: "pressure", label: "Pressure" },
  { id: "due", label: "Due" },
  { id: "movement", label: "Movement" },
];

function Meter({
  label,
  occupied,
  beds,
  percent,
  pulled,
  note,
}: {
  label: string;
  occupied: number;
  beds: number;
  percent: string;
  pulled: number;
  note?: string;
}) {
  const width = beds <= 0 ? 0 : Math.min(100, Math.round((occupied / beds) * 100));
  return (
    <div className={styles.meter}>
      <span className={styles.meterLabel}>{label}</span>
      <strong>{percent}</strong>
      <div className={styles.track} aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      <p className={styles.meterNote}>
        {occupied} of {beds} staffed · {pulled} pulled
        {note ? ` · ${note}` : ""}
      </p>
    </div>
  );
}

function Ledger({ rows, label }: { rows: readonly ToolsFigureRow[]; label: string }) {
  return (
    <ul className={styles.ledger} aria-label={label}>
      {rows.map((row) => (
        <li key={row.id} data-flagged={row.flagged ? "true" : "false"}>
          <span>
            {row.label}
            {row.detail ? <small>{row.detail}</small> : null}
          </span>
          <strong>{row.value}</strong>
        </li>
      ))}
    </ul>
  );
}

export function ToolsFigures({
  group,
  onGroup,
  now,
  role,
  placeId,
  placeName,
  movements,
  units,
  admissions,
  referrals,
  bedReleases,
  leaveBeds,
}: {
  group: ToolsFigureGroup;
  onGroup: (group: ToolsFigureGroup) => void;
  now: Instant;
  role: WardChromeRole;
  placeId?: string;
  placeName?: string;
} & Omit<ToolsFiguresInput, "now" | "role" | "placeId" | "placeName"> & {
    movements: Movement[];
    units: Unit[];
    admissions: readonly Admission[];
    referrals: Referral[];
    bedReleases: BedRelease[];
    leaveBeds: readonly LeaveBed[];
  }) {
  const model = buildToolsFigures({
    movements,
    units,
    admissions,
    referrals,
    bedReleases,
    leaveBeds,
    now,
    role,
    placeId,
    placeName,
  });
  const rows = model[group];
  const groupLabel = GROUPS.find((item) => item.id === group)?.label ?? "Figures";

  return (
    <div className={styles.wrap} data-testid="ward-stats-drawer-content">
      <p className={styles.context}>
        {model.scopeLabel}
        <span>Synthetic figures · {formatInstant(now)}</span>
      </p>
      <div className={styles.groups} role="group" aria-label="Figure groups">
        {GROUPS.map((item) => (
          <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => onGroup(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className={group === "beds" ? styles.bedsBento : undefined}>
        {group === "beds" ? (
          <div className={styles.meters}>
            <Meter
              label={model.networkContext && role !== "ed" ? "This ward" : "Occupied"}
              occupied={model.occupancy.occupied}
              beds={model.occupancy.beds}
              percent={model.occupancy.percent}
              pulled={model.occupancy.pulled}
              note={model.notAllEligible ? "Not all eligible for this department" : undefined}
            />
            {model.networkOccupancy ? (
              <Meter
                label="Whole network"
                occupied={model.networkOccupancy.occupied}
                beds={model.networkOccupancy.beds}
                percent={model.networkOccupancy.percent}
                pulled={model.networkOccupancy.pulled}
              />
            ) : null}
          </div>
        ) : null}
        <Ledger rows={rows} label={groupLabel} />
      </div>
      {group === "beds" && model.services.length > 0 ? (
        <div className={styles.services}>
          <p className={styles.sectionLabel}>By service</p>
          <ul aria-label="Occupancy by service">
            {model.services.map((service) => {
              const width = service.beds <= 0 ? 0 : Math.min(100, Math.round((service.occupied / service.beds) * 100));
              return (
                <li key={service.service}>
                  <span>{service.service}</span>
                  <i aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </i>
                  <b>{service.percent}</b>
                  <small>
                    {service.occupied}/{service.beds}
                  </small>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {group === "pressure" && model.bedKinds.length > 0 ? (
        <div className={styles.services}>
          <p className={styles.sectionLabel}>Waiting against beds that fit</p>
          <ul className={styles.kinds} aria-label="Waiting against beds that fit">
            {model.bedKinds.map((kind) => (
              <li key={kind.id}>
                <span>{kind.need}</span>
                <b>{kind.waiting} waiting</b>
                <small>{kind.bedsThatFit} beds</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {group === "due" ? (
        <p className={styles.legal}>
          <LegalLimitsNotChecked variant="tag" />
          Recorded due times only.
        </p>
      ) : null}
    </div>
  );
}
