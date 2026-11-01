/**
 * WHO A BROADCAST GOES TO (Alerts redesign, 1 Nov 2026; BUILD-SPEC "Broadcast composer", step 2).
 *
 * Everyone, By group or Choose units. Groups are read from the live unit list and the ED desk list,
 * so a count never names a desk the app does not have. Pure: the composer, the draft and the tests
 * agree on the same recipients.
 */
import type { Unit } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import { wardsInBroadcastScope } from "./global-alert-view";
import type { BroadcastTargetScope } from "./ward-broadcast-model";

const AUDIENCE_MODES = ["all", "groups", "pick"] as const;
export type AudienceMode = (typeof AUDIENCE_MODES)[number];

const AUDIENCE_GROUP_IDS = ["metro", "older", "youth", "secure", "regional", "ed", "other"] as const;
type AudienceGroupId = (typeof AUDIENCE_GROUP_IDS)[number];

export interface BroadcastAudience {
  mode: AudienceMode;
  groups: AudienceGroupId[];
  /** Desk ids ticked under Choose units. */
  picked: string[];
  /** A bed call's "Wards with a bed now" suggestion. */
  bedNow: boolean;
}

export type AudienceDesk = { id: string; name: string; kind: "ward" | "ed" };
export type AudienceGroup = { id: AudienceGroupId; label: string; desks: AudienceDesk[] };

const GROUP_LABELS: Record<AudienceGroupId, string> = {
  metro: "Metro adult wards",
  older: "Older adult wards",
  youth: "Youth and CAMHS",
  secure: "Secure and forensic",
  regional: "Regional (WACHS)",
  ed: "ED desks",
  other: "Other wards",
};

/** "Royal Perth Hospital Emergency Department" reads "Royal Perth Hospital ED", as the mock-up does. */
function edDeskName(name: string): string {
  return name.replace(/\s*Emergency Department$/u, " ED");
}

/**
 * The six groups, each with the desks it holds, in the mock-up's order. Metro adult wards are the
 * adult wards outside WACHS, so every ward sits in at least one group; any ward that still does not
 * (a new cohort) is listed under Other wards, so Everyone and Choose units never miss a desk.
 */
export function audienceGroups(units: readonly Unit[]): AudienceGroup[] {
  const ward = (ids: readonly string[]): AudienceDesk[] =>
    units.filter((unit) => ids.includes(unit.id)).map((unit) => ({ id: unit.id, name: unit.name, kind: "ward" }));
  const secure = units
    .filter((unit) => unit.forensic || unit.lockedBeds > 0)
    .map((unit) => ({ id: unit.id, name: unit.name, kind: "ward" as const }));
  const regional = wardsInBroadcastScope(units, "regional_wachs");
  const desks: Record<Exclude<AudienceGroupId, "other">, AudienceDesk[]> = {
    metro: ward(units.filter((unit) => unit.cohort === "Adult").map((unit) => unit.id)).filter(
      (desk) => !regional.includes(desk.id),
    ),
    older: ward(wardsInBroadcastScope(units, "older_adult")),
    youth: ward(wardsInBroadcastScope(units, "adolescent")),
    secure,
    regional: ward(regional),
    ed: allEmergencyDepartments().map((ed) => ({ id: ed.id, name: edDeskName(ed.name), kind: "ed" })),
  };
  const grouped = new Set(Object.values(desks).flatMap((list) => list.map((desk) => desk.id)));
  const other = units.filter((unit) => !grouped.has(unit.id)).map((unit) => unit.id);
  return AUDIENCE_GROUP_IDS.map((id) => ({
    id,
    label: GROUP_LABELS[id],
    desks: id === "other" ? ward(other) : desks[id],
  })).filter((group) => group.id !== "other" || group.desks.length > 0);
}

/** Every desk once, in group order: what Everyone reaches. */
export function everyDesk(groups: readonly AudienceGroup[]): AudienceDesk[] {
  const seen = new Set<string>();
  return groups.flatMap((group) => group.desks).filter((desk) => !seen.has(desk.id) && seen.add(desk.id));
}

/** The desks an audience reaches, in group order, each once. */
export function audienceRecipients(
  audience: BroadcastAudience,
  groups: readonly AudienceGroup[],
  wardsWithBedNow: readonly string[],
  /** A bed call asks wards only (the reducer drops ED desks), so they are never counted or sent. */
  wardsOnly = false,
): AudienceDesk[] {
  const all = everyDesk(groups).filter((desk) => !wardsOnly || desk.kind === "ward");
  if (audience.mode === "all") return all;
  if (audience.mode === "pick") return all.filter((desk) => audience.picked.includes(desk.id));
  const chosen = new Set(
    groups.filter((group) => audience.groups.includes(group.id)).flatMap((group) => group.desks.map((d) => d.id)),
  );
  if (audience.bedNow) wardsWithBedNow.forEach((id) => chosen.add(id));
  return all.filter((desk) => chosen.has(desk.id));
}

/** How the Broadcast tab names the audience: "Everyone", "Chosen units" or the groups chosen. */
export function audienceLabel(audience: BroadcastAudience, groups: readonly AudienceGroup[]): string {
  if (audience.mode === "all") return "Everyone";
  if (audience.mode === "pick") return "Chosen units";
  const names = [
    audience.bedNow ? "Wards with a bed now" : "",
    ...groups.filter((group) => audience.groups.includes(group.id)).map((group) => group.label),
  ].filter(Boolean);
  return names.length > 0 ? names.join(", ") : "No one chosen";
}

/** The one stored scope a group choice still maps to, for the access check and older readers. */
export function audienceScope(audience: BroadcastAudience): BroadcastTargetScope {
  if (audience.mode !== "groups" || audience.bedNow || audience.groups.length !== 1) return "all";
  const only: Partial<Record<AudienceGroupId, BroadcastTargetScope>> = {
    metro: "metro_adult",
    older: "older_adult",
    youth: "adolescent",
    regional: "regional_wachs",
    ed: "ed_liaison",
  };
  return only[audience.groups[0]] ?? "all";
}

/** The quick starts under each choice, in the mock-up's order. "custom" is Blank. */
export const QUICK_STARTS: Record<"bed_call" | "directive", readonly string[]> = {
  bed_call: ["wa-adult-bed-call", "wa-older-bed-call", "wa-youth-bed-call", "wa-secure-bed-call"],
  directive: [
    "wa-metro-hdu-gridlock",
    "wa-ed-prolonged-surge",
    "wa-transport-transit-delay",
    "wa-infection-bypass-protocol",
    "wa-wachs-aeromedical-delay",
    "custom",
  ],
};

/** Who each quick start goes to, as the mock-up sets it. Templates not listed go by their scope. */
const QUICK_START_GROUPS: Record<string, "all" | readonly AudienceGroupId[]> = {
  "wa-adult-bed-call": ["metro"],
  "wa-older-bed-call": ["older"],
  "wa-youth-bed-call": ["youth"],
  "wa-secure-bed-call": ["secure"],
  "wa-metro-hdu-gridlock": "all",
  "wa-ed-prolonged-surge": ["metro", "ed"],
  "wa-transport-transit-delay": "all",
  "wa-infection-bypass-protocol": ["metro", "ed"],
  "wa-wachs-aeromedical-delay": ["regional", "ed"],
  custom: [],
};

const SCOPE_GROUP: Record<BroadcastTargetScope, "all" | readonly AudienceGroupId[]> = {
  all: "all",
  metro_adult: ["metro"],
  ed_liaison: ["ed"],
  forensic: ["secure"],
  adolescent: ["youth"],
  older_adult: ["older"],
  regional_wachs: ["regional"],
};

/** The audience a template starts with, before any desk is ticked. */
export function templateAudienceShape(templateId: string, scope: BroadcastTargetScope): BroadcastAudience {
  const set = QUICK_START_GROUPS[templateId] ?? SCOPE_GROUP[scope];
  return set === "all"
    ? { mode: "all", groups: [], picked: [], bedNow: false }
    : { mode: "groups", groups: [...set], picked: [], bedNow: false };
}

/** The audience a template starts with. Choose units starts from the same desks. */
export function templateAudience(
  templateId: string,
  scope: BroadcastTargetScope,
  groups: readonly AudienceGroup[],
): BroadcastAudience {
  const audience = templateAudienceShape(templateId, scope);
  return { ...audience, picked: audienceRecipients(audience, groups, []).map((desk) => desk.id) };
}

/**
 * Whether an audience still matches its template's. Ticks only count under Choose units, which no
 * template starts on, so a template's own audience is never unsaved work.
 */
export function isTemplateAudience(audience: BroadcastAudience, templateId: string, scope: BroadcastTargetScope) {
  const base = templateAudienceShape(templateId, scope);
  const sorted = (ids: readonly string[]) => [...ids].sort().join("|");
  return (
    audience.mode === base.mode && audience.bedNow === base.bedNow && sorted(audience.groups) === sorted(base.groups)
  );
}

/** A stored audience, or undefined when it is not a complete, well-formed one. */
export function parseAudience(value: unknown): BroadcastAudience | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { mode, groups, picked, bedNow } = value as Record<string, unknown>;
  if (!AUDIENCE_MODES.includes(mode as AudienceMode) || typeof bedNow !== "boolean") return undefined;
  if (!Array.isArray(groups) || !groups.every((id) => AUDIENCE_GROUP_IDS.includes(id as AudienceGroupId)))
    return undefined;
  if (!Array.isArray(picked) || !picked.every((id) => typeof id === "string")) return undefined;
  return { mode: mode as AudienceMode, groups: groups as AudienceGroupId[], picked: picked as string[], bedNow };
}
