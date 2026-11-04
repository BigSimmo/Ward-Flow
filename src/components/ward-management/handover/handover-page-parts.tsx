"use client";

// Handover page pieces outside the main component: the History tab, the scope filter control and
// the sign-off status icon. Split out of handover-page.tsx to keep that file under the line cap.
import { useMemo } from "react";
import { Check, ChevronDown, CircleCheck } from "lucide-react";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { HEALTH_SERVICES, type Unit } from "@/components/ward-management/ward-model";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { accessIsWholeNetwork, edInScope, unitInScope } from "@/components/ward-management/ward-role-access";
import { useOptionalWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { Button, Card, Menu, StatusGlyph, type MenuItem } from "@/components/wf";
import { HANDOVER_SHIFTS, handoverAt, handoverSignOffPlace, handoverSignedAt } from "./handover-model";
import styles from "./handover-refined.module.css";
import { NETWORK_SCOPE_VALUE, handoverScopeValue } from "./handover-scope";
import { allRecordsScopeLabel } from "./handover-scope-rules";

export function StatusCheckIcon(signed: boolean) {
  return signed ? CircleCheck : Check;
}

/** History: past items only. Sign-offs come from the engine; the rest is this session only. */
export function HandoverHistory({
  signOffs,
  meetings,
  preparedAt,
  now,
  unitId,
}: {
  signOffs: readonly { at: Instant; by: WardFlowRole; unitId?: string; network?: true }[];
  meetings: { at: Instant; minutes: number }[];
  preparedAt: Instant | null;
  now: Instant;
  /** The sheet's ward, or undefined for a wider sheet (as `sheetSignOff` reads it). */
  unitId: string | undefined;
}) {
  // Decision 41 (Josh, 31 Oct 2026): each sign-off says whose ward's sheet it signed; Q67: a
  // whole-network desk's reads "Whole network". One saved before sign-offs named a ward reads "Ward
  // not recorded"; a ward is never guessed for it (`handoverSignOffPlace`).
  const units = useOptionalWardFlowSelect("units")?.units;
  // A missed sign-off counts only this sheet's own sign-offs: its ward's, or for a wider sheet those
  // naming no ward, so another ward's sign-off never hides this sheet's missed one.
  const sheetSignOffs = signOffs.filter((record) => record.unitId === unitId);
  const unsigned = HANDOVER_SHIFTS.filter((shift) => {
    return handoverAt(shift.id, now) <= now && handoverSignedAt(sheetSignOffs, shift.id, now) === null;
  });
  return (
    <Card as="section" aria-label="Handover history" data-testid="ward-handover-history">
      <ul className={styles.history}>
        {[...signOffs].reverse().map((record) => (
          <li key={`sign-${record.at}-${record.by}-${record.unitId ?? (record.network ? "network" : "")}`}>
            <span className={styles.mono}>{formatInstantWithDay(record.at, now)}</span>
            <StatusGlyph tone="success" size={9} />
            <span>
              Handover signed off as {record.by === "coordinator" ? "bed coordinator" : record.by} ·{" "}
              {handoverSignOffPlace(record, units)}
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

/** One choice in a choice menu, or the heading that starts a group of them. */
export type HandoverChoice =
  { kind: "heading"; id: string; label: string } | { kind?: undefined; id: string; label: string };

/**
 * A kit Menu of radio choices behind one quiet button that names the current choice (it replaced
 * the browser drop-downs, Josh, 3 Nov 2026). `context` is a short muted word before the choice
 * ("Show"); the accessible name is `label: choice`. The menu fits the window and scrolls inside it.
 */
export function HandoverChoiceMenu({
  label,
  context,
  value,
  choices,
  onChange,
  align,
  testId,
}: {
  label: string;
  context?: string;
  value: string;
  choices: readonly HandoverChoice[];
  onChange: (value: string) => void;
  align?: "start" | "end";
  testId?: string;
}) {
  const current = choices.find((choice) => choice.kind === undefined && choice.id === value)?.label ?? "";
  const items: MenuItem[] = choices.map((choice) =>
    choice.kind === "heading"
      ? choice
      : {
          id: choice.id,
          label: choice.label,
          checkable: "radio" as const,
          checked: choice.id === value,
          onSelect: () => onChange(choice.id),
        },
  );
  return (
    <Menu
      label={label}
      align={align}
      items={items}
      trigger={(props) => (
        <Button
          {...props}
          variant="sec"
          size="sm"
          iconEnd={ChevronDown}
          aria-label={`${label}: ${current}`}
          className={styles.choiceTrigger}
          data-testid={testId}
          data-value={value}
          data-print-hide
        >
          {context ? <span className={styles.choiceContext}>{context}</span> : null}
          <span className={styles.choiceValue}>{current}</span>
        </Button>
      )}
    />
  );
}

/** THE ONE CONTROL: the Show menu that filters the sheet to the places this desk may read. */
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

  // A group with nothing this desk may read is left out, heading and all.
  const group = (id: string, heading: string, entries: HandoverChoice[]): HandoverChoice[] =>
    entries.length === 0 ? [] : [{ kind: "heading", id: `scope-head-${id}`, label: heading }, ...entries];
  const choices: HandoverChoice[] = [
    { id: NETWORK_SCOPE_VALUE, label: allRecordsScopeLabel(access) },
    ...group(
      "service",
      "Service",
      services.map((service) => ({ id: handoverScopeValue({ kind: "service", id: service }), label: service })),
    ),
    ...group(
      "ward",
      "Ward",
      sortedUnits.map((unit) => ({ id: handoverScopeValue({ kind: "ward", id: unit.id }), label: unit.name })),
    ),
    ...group(
      "ed",
      "Emergency department",
      sortedEds.map((ed) => ({ id: handoverScopeValue({ kind: "ed", id: ed.id }), label: ed.name })),
    ),
    ...group(
      "team",
      "Community team",
      sortedTeams.map((team) => ({ id: handoverScopeValue({ kind: "team", id: team.id }), label: team.name })),
    ),
  ];

  return (
    <HandoverChoiceMenu
      label="Show"
      context="Show"
      value={value}
      choices={choices}
      onChange={onChange}
      testId="ward-handover-scope-select"
    />
  );
}
