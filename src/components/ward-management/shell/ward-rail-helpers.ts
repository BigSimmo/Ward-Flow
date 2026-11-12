/**
 * Pure helpers shared by the side rail's three copies: the live rail (ward-rail.tsx), the next
 * shell's rail (shell-next/next-rail-body.tsx) and the redesign preview's rail
 * (ward-redesign/shell/preview-rail-body.tsx). They were copied identically into each; one home
 * keeps the shift figures and the desk line from drifting apart.
 */
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { currentDeskId } from "@/components/ward-management/settings/workstation-desks";
import { shiftAtMinute } from "@/components/ward-management/ward-board-time-features";
import { CHROME_ROLE_LABELS, wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { HANDOVER_DUE_PROMPT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { edById } from "@/components/ward-management/ward-sites";

/** "at a time limit…" → "At a time limit…", for the closed rail's hover card. */
export function sentenceStart(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The desk a page belongs to, when it is not the person's own kind of desk: "Viewing RPH ED as Bed
 * coordinator". Null on the person's own kind of desk and on every network page. Place names only,
 * never a patient.
 */
export function viewingDeskLine(
  pathname: string,
  personaRole: WardChromeRole,
  units: readonly { id: string; name: string }[],
  personaLabel: string,
): string | null {
  const pageRole = wardChromeRole(pathname);
  if (pageRole === "coordinator" || pageRole === personaRole) return null;
  const deskId = currentDeskId(pathname);
  const place =
    pageRole === "ed"
      ? `${(deskId ? edById(deskId)?.siteCode : undefined) ?? "this"} ED`
      : pageRole === "ward"
        ? (units.find((unit) => unit.id === deskId)?.name ?? "this ward")
        : pageRole === "officer"
          ? "the transport desk"
          : pageRole === "community"
            ? // PR #489 review: the team by name when its page names one; the index has none.
              ((deskId ? communityTeamById(deskId)?.name : undefined) ?? "a community team")
            : CHROME_ROLE_LABELS[pageRole];
  return `Viewing ${place} as ${personaLabel}`;
}

export interface ShiftProgress {
  shiftTitle: string;
  /** "Day shift": the pattern's name in sentence case. */
  shiftName: string;
  /** "07:00–15:00": clock times, so colons are right here. */
  shiftHours: string;
  elapsedHours: number;
  elapsedMins: number;
  percent: number;
  /** Minutes until the shift ends. */
  remainingMinutes: number;
  /** True inside the handover prompt window (`HANDOVER_DUE_PROMPT_MINUTES`) before the shift ends. */
  handoverDue: boolean;
  countdownStr: string;
  dashOffset: number;
}

/** "07:00" from a minute-of-day figure — used only to word `SHIFT_PATTERN`'s own entries. */
function formatMinuteOfDay(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Minutes from `from` to `to`, wrapping through midnight when `to` is earlier in the day. */
function minutesFrom(from: number, to: number): number {
  return (((to - from) % 1440) + 1440) % 1440;
}

export function computeShiftProgress(nowInput?: number | Date): ShiftProgress {
  const CIRCUMFERENCE = 81.68;

  let currentMinute: number;
  if (typeof nowInput === "number") {
    // Normalise minute of day 0..1439
    currentMinute = ((nowInput % 1440) + 1440) % 1440;
  } else {
    const d = nowInput instanceof Date ? nowInput : new Date();
    // AWST is UTC+8
    const awstHours = (d.getUTCHours() + 8) % 24;
    const awstMins = d.getUTCMinutes();
    currentMinute = awstHours * 60 + awstMins;
  }

  // The shift pattern itself (07:00/15:00/23:00) is a labelled default, not a legal roster rule —
  // owner ruling 26 September 2026 (decisions.md D-22) — read from `SHIFT_PATTERN` through `shiftAtMinute` (the rule `currentShift` uses too), never
  // hand-typed here, so the one figure and its three titles cannot drift apart.
  const shift = shiftAtMinute(currentMinute);

  const shiftHours = `${formatMinuteOfDay(shift.startMinute)}–${formatMinuteOfDay(shift.endMinute)}`;
  const shiftTitle = `${shift.name} (${shiftHours})`;
  const shiftName = shift.name.charAt(0) + shift.name.slice(1).toLowerCase();
  const shiftDuration = minutesFrom(shift.startMinute, shift.endMinute);
  const elapsedTotal = minutesFrom(shift.startMinute, currentMinute);
  const remainingTotal = shiftDuration - elapsedTotal;

  const elapsedHours = Math.floor(elapsedTotal / 60);
  const elapsedMins = elapsedTotal % 60;
  const percent = Math.min(100, Math.max(0, Math.round((elapsedTotal / shiftDuration) * 100)));
  const dashOffset = Number((CIRCUMFERENCE * (1 - percent / 100)).toFixed(2));
  const handoverDue = remainingTotal <= HANDOVER_DUE_PROMPT_MINUTES;

  let countdownStr: string;
  if (handoverDue) {
    countdownStr = "Handover Due";
  } else {
    const remainingHours = Math.floor(remainingTotal / 60);
    const remainingRemMins = remainingTotal % 60;
    countdownStr = remainingHours > 0 ? `${remainingHours}h ${remainingRemMins}m` : `${remainingRemMins}m`;
  }

  return {
    shiftTitle,
    shiftName,
    shiftHours,
    elapsedHours,
    elapsedMins,
    percent,
    remainingMinutes: remainingTotal,
    handoverDue,
    countdownStr,
    dashOffset,
  };
}
