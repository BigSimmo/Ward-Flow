import type { Site } from "@/components/ward-management/ward-model";

import { availability, buildOnCallDirectory, hhmm, numberAt, type DirectoryEntry } from "./on-call-directory";

/**
 * Feature 32 (Josh, 9 Nov 2026): the ward contact card. One tap on a ward page shows who to ring for
 * that ward now: the nurse in charge, the ward phone, a pager, the hospital's on-call psychiatry
 * consultant and registrar, and the switchboard. Every number comes from the synthetic on-call
 * directory (`on-call-directory.ts`); nothing here dials. A line the directory does not hold reads
 * "Not recorded".
 */

type WardContactRow = {
  key: "nurseInCharge" | "pager" | "consultant" | "registrar" | "switchboard";
  label: string;
  /** The directory entry the number came from, when there is one. */
  entryId: string | null;
  /** The line's own name, e.g. "On-call phone". Null when not recorded. */
  line: string | null;
  number: string | null;
  /** "Until 15:00", "24 hours" or "Opens 08:00". Null when not recorded. */
  availability: string | null;
  /** True when the line answers now. */
  answering: boolean;
};

export type WardContactCard = {
  unitId: string;
  wardName: string;
  siteName: string;
  rows: WardContactRow[];
};

function availabilityText(entry: DirectoryEntry, minute: number): { text: string | null; answering: boolean } {
  const now = availability(entry, minute);
  if (now.kind === "none") return { text: null, answering: false };
  if (now.kind === "on") return { text: now.allDay ? "24 hours" : `Until ${hhmm(now.until)}`, answering: true };
  return { text: `Opens ${hhmm(now.opens)}`, answering: false };
}

function row(key: WardContactRow["key"], label: string, entry: DirectoryEntry | undefined, minute: number) {
  if (!entry) return notRecorded(key, label);
  const now = availability(entry, minute);
  const line = (now.kind === "on" ? now.line : now.kind === "off" ? now.next : null) ?? entry.lines[0] ?? null;
  const { text, answering } = availabilityText(entry, minute);
  return {
    key,
    label,
    entryId: entry.id,
    line: line?.label ?? null,
    number: numberAt(entry, minute),
    availability: text,
    answering,
  } satisfies WardContactRow;
}

const notRecorded = (key: WardContactRow["key"], label: string): WardContactRow => ({
  key,
  label,
  entryId: null,
  line: null,
  number: null,
  availability: null,
  answering: false,
});

/**
 * The contact card for one ward at a minute of the day (0 to 1439), or null when the directory holds
 * no such ward. Pass the scenario's sites so the EMHS and surge networks find their own wards.
 */
export function wardContactCard(
  unitId: string,
  minute: number,
  sites?: readonly Site[],
  entries: readonly DirectoryEntry[] = buildOnCallDirectory(sites),
): WardContactCard | null {
  const nic = entries.find((entry) => entry.id === `${unitId}-nic`);
  if (!nic || !nic.siteCode) return null;
  const site = (kind: DirectoryEntry["kind"]) =>
    entries.find((entry) => entry.kind === kind && entry.siteCode === nic.siteCode && entry.section === "hospitals");
  return {
    unitId,
    wardName: nic.name,
    siteName: nic.groupTitle,
    rows: [
      // The directory holds one ward phone, the nurses' station, which the nurse in charge answers.
      row("nurseInCharge", "Nurse in charge", nic, minute),
      // No pager is held in the directory for any ward.
      notRecorded("pager", "Pager"),
      row("consultant", "Consultant psychiatrist on call", site("consultant"), minute),
      row("registrar", "Psychiatry registrar on call", site("registrar"), minute),
      row("switchboard", "Switchboard", site("switchboard"), minute),
    ],
  };
}
