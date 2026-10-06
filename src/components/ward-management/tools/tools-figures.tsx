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
      <div className={styles.meterTop}>
        <span>{label}</span>
        <strong>{percent}</strong>
      </div>
      <div className={styles.track} aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      <p className={styles.meterNote}>
        {occupied} occupied of {beds} staffed · {pulled} pulled
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
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          {row.detail ? <small>{row.detail}</small> : null}
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

  return (
    <div className={styles.wrap} data-testid="ward-stats-drawer-content">
      <p className={styles.context}>
        {model.scopeLabel} · synthetic figures · {formatInstant(now)}
      </p>
      <div className={styles.groups} role="group" aria-label="Figure groups">
        {GROUPS.map((item) => (
          <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => onGroup(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {group === "beds" ? (
        <>
          <Meter
            label={model.networkContext && role !== "ed" ? "This ward occupied" : "Occupied"}
            occupied={model.occupancy.occupied}
            beds={model.occupancy.beds}
            percent={model.occupancy.percent}
            pulled={model.occupancy.pulled}
            note={model.notAllEligible ? "Not all eligible for this department" : undefined}
          />
          {model.networkOccupancy ? (
            <Meter
              label="Whole network occupied"
              occupied={model.networkOccupancy.occupied}
              beds={model.networkOccupancy.beds}
              percent={model.networkOccupancy.percent}
              pulled={model.networkOccupancy.pulled}
            />
          ) : null}
        </>
      ) : null}
      <h3 className={styles.groupTitle}>{GROUPS.find((item) => item.id === group)?.label}</h3>
      <Ledger rows={rows} label={GROUPS.find((item) => item.id === group)?.label ?? "Figures"} />
      {group === "beds" && model.services.length > 0 ? (
        <div className={styles.services} aria-label="Occupancy by service">
          <p className={styles.sectionLabel}>Occupancy by service</p>
          {model.services.map((service) => {
            const width = service.beds <= 0 ? 0 : Math.min(100, Math.round((service.occupied / service.beds) * 100));
            return (
              <div key={service.service} className={styles.service}>
                <span>{service.service}</span>
                <i aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </i>
                <b>
                  {service.percent} · {service.occupied}/{service.beds}
                </b>
              </div>
            );
          })}
        </div>
      ) : null}
      {group === "pressure" ? (
        <div className={styles.kinds} aria-label="Waiting against beds that fit">
          <p className={styles.sectionLabel}>Waiting against beds that fit</p>
          {model.bedKinds.map((kind) => (
            <div key={kind.id} className={styles.kind}>
              <span>{kind.need}</span>
              <b>{kind.waiting} waiting</b>
              <small>{kind.bedsThatFit} beds that fit</small>
            </div>
          ))}
        </div>
      ) : null}
      {group === "due" ? (
        <div className={styles.legal}>
          <LegalLimitsNotChecked variant="tag" />
          <p className={styles.meterNote}>Recorded due times only. Synthetic figures.</p>
        </div>
      ) : null}
    </div>
  );
}
