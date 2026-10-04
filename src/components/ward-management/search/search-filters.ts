import type { Movement, Site, ReferralAddressing } from "@/components/ward-management/ward-model";
import type { PatientSearchResult } from "@/components/ward-management/ward-derivations";
import { minutesUntil } from "@/components/ward-management/ward-clock";
import { wardSites } from "@/components/ward-management/ward-sites";
import { SELECTABLE_LEGAL_FORMS, legalFormName } from "@/components/ward-management/ward-legal-forms";

export type ServiceFilter = "all" | "East Metro" | "North Metro" | "South Metro" | "WACHS";
export type SettingFilter = "all" | "ed" | "inpatient" | "transit" | "community" | "scheduled" | "discharged";
export type WaitFilter = "all" | "under6" | "6to24" | "over24";
export type PresenceFilter = "all" | "live" | "community" | "scheduled" | "past";

/**
 * The legal filter's options, in order. **Owner, 2026-08-24:** *"Just focus on voluntary and
 * involuntary and I can choose what option in the patient selection."* So the two statuses come
 * first, then one option per form the intake picker can actually record, each named by the Chief
 * Psychiatrist register through `legalFormName` — never a label written here.
 *
 * 🔴 **Replaced 2026-09-14.** The previous list read "Form 1A (ED 24h)", which attached the
 * departmental ED access target to a legal form (`ward-model.ts` says that target "is not a Mental
 * Health Act deadline"), and "Form 5A (Involuntary)", when the register titles 5A "Community
 * Treatment Order" and Ward Flow cannot record a 5A at all. No option carries a duration.
 */
export const LEGAL_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Voluntary", label: "Voluntary" },
  { value: "Involuntary", label: "Involuntary" },
  ...SELECTABLE_LEGAL_FORMS.map((form) => ({ value: `Form ${form.code}`, label: legalFormName(form) })),
];
export type LegalFilter = "all" | (typeof LEGAL_FILTER_OPTIONS)[number]["value"];

export interface DropdownFilters {
  presence?: string;
  service: string;
  setting: string;
  legal: string;
  wait: string;
}

export const QUICK_CHIPS = [
  { label: "● Live Now", query: "● Live" },
  { label: "○ Not in Hospital", query: "○ Not in Hospital" },
  { label: "◌ Past Patients", query: "◌ Past Patient" },
  { label: "Form 1A", query: "Form 1A" },
  { label: "Unplaced", query: "unplaced" },
  { label: "Waiting > 24h", query: "over24" },
] as const;

// Site lookup maps
const siteByCode = new Map<string, Site>();
const siteByEdId = new Map<string, Site>();
const siteByUnitId = new Map<string, Site>();

for (const site of wardSites) {
  siteByCode.set(site.code, site);
  if (site.emergencyDepartment) {
    siteByEdId.set(site.emergencyDepartment.id, site);
  }
  for (const unit of site.units) {
    siteByUnitId.set(unit.id, site);
  }
}

export function waitedHours(movement: Movement, now: number): number {
  return minutesUntil(now, movement.openedAt) / 60;
}

export function matchesService(result: PatientSearchResult, service: string): boolean {
  if (service === "all") return true;

  if (result.kind === "movement") {
    const originService = siteByEdId.get(result.movement.originEdId)?.service;
    const destService = result.movement.acceptedUnitId
      ? siteByUnitId.get(result.movement.acceptedUnitId)?.service
      : undefined;
    const anyReferred = result.movement.referredUnitIds.some(
      (uid: string) => siteByUnitId.get(uid)?.service === service,
    );
    return originService === service || destService === service || anyReferred;
  }

  if (result.kind === "referral") {
    const originService = siteByCode.get(result.referral.originSiteCode)?.service;
    const destMatches = result.referral.destinations.some((d: ReferralAddressing) => {
      if (d.destination.kind === "psychiatric_ward" && d.acceptedUnitId) {
        return siteByUnitId.get(d.acceptedUnitId)?.service === service;
      }
      if (d.destination.kind === "emergency_department") {
        return siteByEdId.get(d.destination.edId)?.service === service;
      }
      return false;
    });
    return originService === service || destMatches || result.referral.homeRegion === service;
  }

  return false;
}

export function matchesSetting(result: PatientSearchResult, setting: string): boolean {
  if (setting === "all") return true;

  if (result.kind === "movement") {
    if (setting === "transit") {
      return result.movement.stage === "moving" || result.movement.transport !== undefined;
    }
    if (setting === "inpatient") {
      return (
        Boolean(result.movement.acceptedUnitId) &&
        (result.movement.stage === "pulled" || result.movement.stage === "accepted_awaiting_bed")
      );
    }
    if (setting === "ed") {
      return result.movement.stage !== "moving" && result.movement.stage !== "pulled";
    }
    if (setting === "discharged") {
      return result.movement.closure !== undefined;
    }
    if (setting === "community" || setting === "scheduled") {
      return false;
    }
  }

  if (result.kind === "referral") {
    if (setting === "ed") {
      return !result.referral.originSiteCode.includes("CMHT") && !result.referral.originSiteCode.includes("Clinic");
    }
    if (setting === "community") {
      return (
        result.referral.originSiteCode.includes("CMHT") ||
        result.referral.originSiteCode.includes("Clinic") ||
        (result.referral.homeRegion as unknown as string) === "Community"
      );
    }
    if (setting === "transit" || setting === "inpatient" || setting === "scheduled" || setting === "discharged") {
      return false;
    }
  }

  return false;
}

export function matchesPresence(result: PatientSearchResult, presence: string): boolean {
  if (presence === "all") return true;

  if (presence === "live") {
    if (result.kind === "movement") return true;
    if (result.kind === "referral") {
      return !result.referral.originSiteCode.includes("CMHT") && !result.referral.originSiteCode.includes("Clinic");
    }
    return false;
  }

  if (presence === "community") {
    if (result.kind === "referral") {
      return (
        result.referral.originSiteCode.includes("CMHT") ||
        result.referral.originSiteCode.includes("Clinic") ||
        (result.referral.homeRegion as unknown as string) === "Community"
      );
    }
    return false;
  }

  if (presence === "scheduled") {
    return false;
  }

  if (presence === "past") {
    if (result.kind === "movement") return result.movement.closure !== undefined;
    return false;
  }

  return true;
}

export function matchesLegal(result: PatientSearchResult, legal: string): boolean {
  if (legal === "all") return true;

  if (result.kind === "movement") {
    if (legal === "Voluntary") return result.movement.legalStatus === "Voluntary";
    if (legal === "Involuntary") return result.movement.legalStatus !== "Voluntary";
    // An exact code match against the form the record holds — never a substring, and never the
    // transport job's free-text `formRequired`, which is a known unvalidated string.
    return legal === `Form ${result.movement.legalForm?.code}`;
  }

  // A queued referral records no legal status and no form. `involuntaryBedNeeded` is, in the
  // model's own words, "never a legal determination" — so a referral matches no legal filter rather
  // than being given a status it does not hold.
  return false;
}

export function matchesWait(result: PatientSearchResult, wait: string, now: number): boolean {
  if (wait === "all") return true;

  const hours = result.kind === "movement" ? waitedHours(result.movement, now) : 0;

  if (wait === "under6") return hours < 6;
  if (wait === "6to24") return hours >= 6 && hours < 24;
  if (wait === "over24") return hours >= 24;

  return true;
}

export function isQuickChipQuery(text: string): boolean {
  return QUICK_CHIPS.some((chip) => chip.query === text);
}

export function matchesQuickChip(result: PatientSearchResult, chipQuery: string, now: number): boolean {
  if (chipQuery === "● Live") {
    if (result.kind === "movement") return result.movement.closure === undefined && result.movement.stage !== "arrived";
    if (result.kind === "referral") {
      return (
        !result.referral.originSiteCode.includes("CMHT") &&
        !result.referral.originSiteCode.includes("Clinic") &&
        (result.referral.homeRegion as unknown as string) !== "Community"
      );
    }
    return false;
  }
  if (chipQuery === "○ Not in Hospital") {
    if (result.kind === "referral") {
      return (
        result.referral.originSiteCode.includes("CMHT") ||
        result.referral.originSiteCode.includes("Clinic") ||
        (result.referral.homeRegion as unknown as string) === "Community"
      );
    }
    return false;
  }
  if (chipQuery === "◌ Past Patient") {
    if (result.kind === "movement") return result.movement.closure !== undefined;
    return false;
  }
  if (chipQuery === "Form 1A") {
    if (result.kind === "movement") {
      return result.movement.legalForm?.code === "1A";
    }
    return false;
  }
  if (chipQuery === "unplaced") {
    if (result.kind === "movement") {
      return (
        !result.movement.acceptedUnitId && result.movement.closure === undefined && result.movement.stage !== "arrived"
      );
    }
    if (result.kind === "referral") {
      return !result.referral.destinations.some((d) => d.acceptedUnitId);
    }
    return false;
  }
  if (chipQuery === "over24") {
    return matchesWait(result, "over24", now);
  }
  return true;
}
