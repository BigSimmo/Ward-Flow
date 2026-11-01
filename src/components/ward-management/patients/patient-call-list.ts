import { minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  SERVICE_META,
  availability,
  buildOnCallDirectory,
  hhmm,
  numberAt,
  type DirectoryEntry,
} from "@/components/ward-management/on-call/on-call-directory";
import type { HealthService } from "@/components/ward-management/ward-model";

/**
 * Who to call, with a number (device audit 11 Oct 2026, Patient: "show the number and a 48px round
 * call button like On-call"). Every number comes from the On-call directory, whose numbers are all
 * mocks in the unassigned (08) 0000 exchange; nothing here dials. A row whose place has no line in
 * the directory says so rather than inventing one.
 */

let directory: DirectoryEntry[] | undefined;
function entries(): DirectoryEntry[] {
  directory ??= buildOnCallDirectory();
  return directory;
}

/** A contact the patient page wants to show, named by what the directory can look it up by. */
export type CallTarget =
  | { kind: "ed"; name: string; role: string; siteCode: string; line: "liaison" | "epic" | "registrar" }
  | { kind: "ward"; name: string; role: string; unitId: string }
  | { kind: "team"; name: string; role: string }
  | { kind: "bedFlow"; name: string; role: string; service: HealthService | undefined }
  | { kind: "transport"; name: string; role: string }
  /** The consultant psychiatrist on call at a site, else that service's (escalation, ops-6). */
  | { kind: "consultant"; name: string; role: string; siteCode: string | undefined; service: HealthService | undefined }
  /** A health service's executive on call (escalation, ops-6). */
  | { kind: "executive"; name: string; role: string; service: HealthService | undefined }
  /** A person whose own line the record holds (a case manager); mock-up round 2, 1 Nov 2026. */
  | { kind: "plain"; name: string; role: string; phone?: string };

export type CallRow = {
  key: string;
  name: string;
  role: string;
  /** The mock number answering now, or null when the place holds no line here. */
  number: string | null;
  /** "until 17:00", "all day" or "opens 08:30". */
  hours?: string;
  /** The directory row, for the call action's accessible name. */
  lineLabel?: string;
};

function findEntry(target: CallTarget): DirectoryEntry | undefined {
  const all = entries();
  switch (target.kind) {
    case "ed": {
      const kind = target.line === "epic" ? "epic" : target.line === "registrar" ? "registrar" : "edLiaison";
      return (
        all.find((entry) => entry.siteCode === target.siteCode && entry.kind === kind) ??
        all.find((entry) => entry.siteCode === target.siteCode && entry.kind === "switchboard")
      );
    }
    case "ward":
      return all.find((entry) => entry.id === `${target.unitId}-nic`);
    case "team": {
      // The record names a team ("Midland Community Team"); the directory names the service
      // ("Midland Community Mental Health Service"). Match the exact name, then the place word.
      const place = target.name.replace(/\s+Community(\s+Mental Health)?\s+(Team|Service)$/iu, "").trim();
      const community = all.filter((entry) => entry.kind === "community");
      return (
        community.find((entry) => entry.name === target.name) ??
        community.find((entry) => entry.name.startsWith(`${place} Community`))
      );
    }
    case "bedFlow": {
      const short = target.service ? SERVICE_META[target.service]?.short.toLowerCase() : undefined;
      return (
        (short ? all.find((entry) => entry.id === `${short}-bfc`) : undefined) ?? all.find((e) => e.id === "sw-bfc")
      );
    }
    case "transport":
      return all.find((entry) => entry.id === "sw-pts");
    case "consultant":
      return (
        (target.siteCode
          ? all.find((entry) => entry.siteCode === target.siteCode && entry.kind === "consultant")
          : undefined) ?? all.find((entry) => entry.kind === "serviceConsultant" && entry.service === target.service)
      );
    case "executive":
      return (
        all.find((entry) => entry.kind === "executive" && entry.service === target.service) ??
        all.find((entry) => entry.id === "sw-gov")
      );
    default:
      return undefined;
  }
}

export function callRows(targets: readonly CallTarget[], now: Instant): CallRow[] {
  const minute = minuteOfDay(now);
  return targets.map((target, index) => {
    const entry = findEntry(target);
    if (!entry)
      return {
        key: `${index}-${target.name}`,
        name: target.name,
        role: target.role,
        number: target.kind === "plain" ? (target.phone ?? null) : null,
      };
    const state = availability(entry, minute);
    const hours =
      state.kind === "on"
        ? state.allDay
          ? "Answers all day"
          : `Until ${hhmm(state.until)}`
        : state.kind === "off" && "opens" in state
          ? `Opens ${hhmm(state.opens)}`
          : undefined;
    return {
      key: `${index}-${target.name}`,
      name: target.name,
      role: target.role,
      number: numberAt(entry, minute),
      hours,
      lineLabel: `${entry.name}, ${entry.place}`,
    };
  });
}
