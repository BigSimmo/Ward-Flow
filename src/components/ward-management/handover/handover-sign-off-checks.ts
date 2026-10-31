import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { groupOf, wardIsStale, type HandoverRow, type HandoverWard } from "./handover-model";
import type { SignOffCheck } from "./handover-panels";

/**
 * The sign-off checklist, shared by the side panel and the sign-off bar so the two never disagree.
 * `onCheckBeds` is left out on the phone, which keeps its own Beds tab and has no print sheet.
 */
export function handoverSignOffChecks({
  rows,
  wards,
  now,
  cutoff,
  dueCount,
  preparedAt,
  meetings,
  onCheckBeds,
}: {
  rows: readonly HandoverRow[];
  wards: readonly HandoverWard[];
  now: Instant;
  cutoff: Instant;
  dueCount: number;
  preparedAt: Instant | null;
  meetings: readonly { at: Instant; minutes: number }[];
  onCheckBeds?: () => void;
}): SignOffCheck[] {
  // Audit S-31: a ward is stale on the sign-off when either its feed or its ward-confirmed count is
  // past that figure's own limit, the rule the Wards page counts by (allocatable), so sign-off can
  // never say every feed is current while Wards shows a stale ward.
  const staleWards = wards.filter(
    (ward) =>
      wardIsStale(ward, now) || now - ward.unit.allocatable.confirmedAt > ward.unit.allocatable.staleAfterMinutes,
  );
  const actRows = rows.filter((row) => groupOf(row, now, cutoff) === "act");
  // Flagged urgent rows need an owner too; they are counted on their own line.
  const urgentRows = rows.filter((row) => groupOf(row, now, cutoff) === "urg");
  const actOwnedRows = [...actRows, ...urgentRows];
  const actOwned = actOwnedRows.every((row) => row.owner !== "No owner recorded");
  // A flagged urgent row left off Alerts' act-now list (snoozed there) can still be past its time.
  const actPassed = actOwnedRows.filter(
    (row) =>
      (row.pullExpiresAt !== undefined && row.pullExpiresAt <= now) ||
      (row.formDueAt !== undefined && row.formDueAt <= now),
  ).length;
  return [
    {
      id: "act",
      // A4-27 (audit round 2): an act-now row whose bed pull or form time has passed is not settled,
      // whoever owns it, so the tick stays open until that time is dealt with.
      done: actOwned && actPassed === 0,
      text: `${actRows.length} act now${urgentRows.length > 0 ? ` and ${urgentRows.length} flagged urgent` : ""}, ${actPassed > 0 ? `${actPassed} past ${actPassed === 1 ? "its" : "their"} time` : actOwned ? "each has an owner" : "some have no owner"}`,
    },
    { id: "due", done: true, text: `${dueCount} due by ${formatInstantWithDay(cutoff, now)} listed` },
    staleWards.length
      ? {
          id: "feeds",
          done: false,
          text:
            staleWards.length === 1
              ? `${staleWards[0]!.name} counts are stale`
              : `${staleWards.length} wards with stale counts: ${staleWards.map((ward) => ward.name).join(", ")}`,
          action: onCheckBeds ? { label: "Check beds", onClick: onCheckBeds } : undefined,
        }
      : { id: "feeds", done: true, text: "Every ward feed is current" },
    preparedAt !== null
      ? { id: "print", done: true, text: `Copy prepared for printing ${formatInstantWithDay(preparedAt, now)}` }
      : // Print and the meeting timer live once, in the hero (device audit 11 Oct 2026).
        { id: "print", done: false, text: "No copy prepared for printing yet" },
    meetings.length
      ? { id: "meet", done: true, text: `Meeting timed, ${meetings[0]!.minutes} min` }
      : { id: "meet", done: false, text: "Meeting not timed" },
  ];
}
