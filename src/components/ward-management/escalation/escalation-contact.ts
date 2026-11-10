import type { Instant } from "@/components/ward-management/ward-clock";
import { minuteOfDay } from "@/components/ward-management/ward-clock";
import type { EdWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import type { HealthService } from "@/components/ward-management/ward-model";
import {
  SERVICE_META,
  availability,
  hhmm,
  numberAt,
  type DirectoryEntry,
} from "@/components/ward-management/on-call/on-call-directory";
import {
  lastCheckOf,
  lastCheckText,
  notCheckedNote,
  type DirectoryCheckRecord,
} from "@/components/ward-management/on-call/on-call-checks";

import { ESCALATION_STEP_ROLE, type EscalationContactRole } from "./escalation-calls";

/**
 * Escalation calls (item 3, D-133): the on-call directory entry for a wait step's role. Every number
 * is a synthetic mock from `on-call-directory.ts`; nothing here dials. Kept apart from
 * `escalation-calls.ts` so the shared engine never loads the directory.
 */

/** The directory entry for a role at an ED's site and service, or nothing when none is held. */
export function escalationEntry(
  role: EscalationContactRole,
  where: { siteCode: string | undefined; service: HealthService | undefined },
  entries: readonly DirectoryEntry[],
): DirectoryEntry | undefined {
  const short = where.service ? SERVICE_META[where.service].short.toLowerCase() : undefined;
  const byId = (id: string) => entries.find((entry) => entry.id === id);
  const serviceCoordinator = () => (short ? byId(`${short}-bfc`) : undefined) ?? byId("sw-bfc");
  switch (role) {
    case "service_bed_coordinator":
      return serviceCoordinator();
    case "site_bed_manager":
      // The site's after-hours nurse manager holds the site's beds ("Bed manager" by day). A site with
      // no wards has none, so its service's bed coordinator is the next call.
      return (
        entries.find(
          (entry) => entry.kind === "afterHours" && entry.siteCode !== undefined && entry.siteCode === where.siteCode,
        ) ?? serviceCoordinator()
      );
    case "state_bed_desk":
      return byId("sw-bfc");
    case "executive_on_call":
      return (short ? byId(`${short}-exec`) : undefined) ?? byId("sw-gov");
  }
}

export type EscalationContact = {
  role: EscalationContactRole;
  entry: DirectoryEntry;
  /** The mock number answering now, else the next to open. Null when none is held. */
  number: string | null;
  /** "Until 17:00", "24 hours" or "Opens 08:00". */
  hours: string | null;
  /** "Checked 12 days ago by Bed coordinator". */
  checked: string;
  /** "Not checked in over 40 days", past the directory's own threshold. */
  notChecked: string | undefined;
};

/** Who to call at a step, now: the entry, its number to copy and its existing last-checked note. */
export function escalationContact(
  step: EdWaitStep["step"],
  where: { siteCode: string | undefined; service: HealthService | undefined },
  entries: readonly DirectoryEntry[],
  checks: readonly DirectoryCheckRecord[] | undefined,
  now: Instant,
): EscalationContact | undefined {
  const role = ESCALATION_STEP_ROLE[step];
  const entry = escalationEntry(role, where, entries);
  if (!entry) return undefined;
  const minute = minuteOfDay(now);
  const state = availability(entry, minute);
  const hours =
    state.kind === "on"
      ? state.allDay
        ? "24 hours"
        : `Until ${hhmm(state.until)}`
      : state.kind === "off"
        ? `Opens ${hhmm(state.opens)}`
        : null;
  const check = lastCheckOf(entry, checks, now);
  return {
    role,
    entry,
    number: numberAt(entry, minute),
    hours,
    checked: lastCheckText(check),
    notChecked: notCheckedNote(check),
  };
}
