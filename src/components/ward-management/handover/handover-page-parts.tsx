"use client";

// Handover page pieces outside the main component: the History tab, the scope filter control and
// the sign-off status icon. Split out of handover-page.tsx to keep that file under the line cap.
import { useId, useMemo } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { HEALTH_SERVICES, type Unit } from "@/components/ward-management/ward-model";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { accessIsWholeNetwork, edInScope, unitInScope } from "@/components/ward-management/ward-role-access";
import { useOptionalWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { Card, Select, SrOnly, StatusGlyph } from "@/components/wf";
import { HANDOVER_SHIFTS, handoverAt, handoverSignedAt } from "./handover-model";
import styles from "./handover-refined.module.css";
import { NETWORK_SCOPE_VALUE, handoverScopeValue } from "./handover-scope";
import { allRecordsScopeLabel } from "./handover-scope-rules";

export function StatusCheckIcon(signed: boolean) {
  return signed ? CheckCircle2 : Check;
}

/** History: past items only. Sign-offs come from the engine; the rest is this session only. */
export function HandoverHistory({
  signOffs,
  meetings,
  preparedAt,
  now,
}: {
  signOffs: readonly { at: Instant; by: WardFlowRole; unitId?: string }[];
  meetings: { at: Instant; minutes: number }[];
  preparedAt: Instant | null;
  now: Instant;
}) {
  // Decision 41 (Josh, 31 Oct 2026): each sign-off says whose ward's sheet it signed. One saved
  // before sign-offs named a ward reads "Ward not recorded"; a ward is never guessed for it.
  const units = useOptionalWardFlowSelect("units")?.units;
  const wardOf = (unitId: string | undefined) =>
    (unitId === undefined ? undefined : units?.find((unit) => unit.id === unitId)?.name) ?? "Ward not recorded";
  const unsigned = HANDOVER_SHIFTS.filter((shift) => {
    return handoverAt(shift.id, now) <= now && handoverSignedAt(signOffs, shift.id, now) === null;
  });
  return (
    <Card as="section" aria-label="Handover history" data-testid="ward-handover-history">
      <ul className={styles.history}>
        {[...signOffs].reverse().map((record) => (
          <li key={`sign-${record.at}-${record.by}-${record.unitId ?? ""}`}>
            <span className={styles.mono}>{formatInstantWithDay(record.at, now)}</span>
            <StatusGlyph tone="success" size={9} />
            <span>
              Handover signed off as {record.by === "coordinator" ? "bed coordinator" : record.by} ·{" "}
              {wardOf(record.unitId)}
            </span>
          </li>
        ))}
        {preparedAt !== null ? (
          <li>
            <span className={styles.mono}>{formatInstantWithDay(preparedAt, now)}</span>
            <StatusGlyph tone="success" size={9} />
            <span>Copy prepared for printing, this session only; printing not confirmed</span>
          </li>
        ) : null}
        {meetings.map((meeting) => (
          <li key={`meet-${meeting.at}-${meeting.minutes}`}>
            <span className={styles.mono}>{formatInstantWithDay(meeting.at, now)}</span>
            <StatusGlyph tone="success" size={9} />
            <span>Bed flow meeting, {meeting.minutes} min, this session only</span>
          </li>
        ))}
        {unsigned.map((shift) => (
          <li key={`unsigned-${shift.id}`}>
            <span className={styles.mono}>{formatInstantWithDay(handoverAt(shift.id, now), now)}</span>
            <StatusGlyph tone="neutral" size={9} />
            <span>No sign-off recorded for the {shift.label.toLowerCase()} handover</span>
          </li>
        ))}
        {signOffs.length === 0 && preparedAt === null && meetings.length === 0 && unsigned.length === 0 ? (
          <li>
            <span />
            <StatusGlyph tone="neutral" size={9} />
            <span>Nothing has happened yet on this shift</span>
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

/** THE ONE CONTROL — `<select aria-label="Filter the sheet">` */
export function HandoverScopeControl({
  value,
  onChange,
  units,
}: {
  value: string;
  onChange: (value: string) => void;
  units: Unit[];
}) {
  const access = useEffectiveWardAccess();
  const { sites } = useWardNetwork();
  // Only the places this desk may read are offered: a ward desk never lists another ward's name.
  const whole = accessIsWholeNetwork(access);
  const places = useMemo(() => wardPlaceLookup(units), [units]);
  const sortedUnits = useMemo(
    () =>
      units
        .filter((unit) => whole || unitInScope(access.scope, unit.id, places))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [units, whole, access.scope, places],
  );
  const services = useMemo(
    () =>
      whole
        ? HEALTH_SERVICES
        : HEALTH_SERVICES.filter((service) => sortedUnits.some((unit) => places.unitService(unit.id) === service)),
    [whole, sortedUnits, places],
  );
  const sortedEds = useMemo(
    () =>
      sites
        .flatMap((site) => (site.emergencyDepartment ? [site.emergencyDepartment] : []))
        .filter((ed) => whole || edInScope(access.scope, ed.id, places))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [sites, whole, access.scope, places],
  );
  const sortedTeams = useMemo(
    () =>
      COMMUNITY_TEAM_PAGES.filter(
        (team) => whole || (access.scope.kind === "team" && access.scope.teamName === team.name),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [whole, access.scope],
  );
  const scopeId = useId();

  return (
    <label htmlFor={scopeId} className={styles.barSelect} data-print-hide>
      <SrOnly>Filter the sheet</SrOnly>
      <Select
        id={scopeId}
        aria-label="Filter the sheet"
        data-testid="ward-handover-scope-select"
        boxClassName={styles.barSelect}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={NETWORK_SCOPE_VALUE}>{allRecordsScopeLabel(access)}</option>
        <optgroup label="Service">
          {services.map((service) => (
            <option key={service} value={handoverScopeValue({ kind: "service", id: service })}>
              {service}
            </option>
          ))}
        </optgroup>
        <optgroup label="Ward">
          {sortedUnits.map((unit) => (
            <option key={unit.id} value={handoverScopeValue({ kind: "ward", id: unit.id })}>
              {unit.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Emergency department">
          {sortedEds.map((ed) => (
            <option key={ed.id} value={handoverScopeValue({ kind: "ed", id: ed.id })}>
              {ed.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Community team">
          {sortedTeams.map((team) => (
            <option key={team.id} value={handoverScopeValue({ kind: "team", id: team.id })}>
              {team.name}
            </option>
          ))}
        </optgroup>
      </Select>
    </label>
  );
}
