import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFeatureFlag } from "@/components/ward-management/ward-feature-flags";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { PlaceLookup, WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * SWITCH A FEATURE OFF AT ONE SITE (Batch 4 item 20, Josh's approved plan, 10 Nov 2026,
 * D-135). An admin switches one listed feature off for one site. The switch is a
 * shared record (`SET_SITE_FEATURE_SWITCH`), so every desk at that site reads it when the app loads
 * the workspace, and the feature is off for all of them. Every other site is untouched.
 *
 * 🔒 **A FIXED ALLOW-LIST.** Only the features named in `SITE_SWITCHABLE_FEATURES` can be switched
 * off. Safety notices, legal times and ruling guards can never be: they are named in
 * `SITE_PROTECTED_FEATURES`, the reducer refuses them by name, and
 * `tests/ward-ruling-guardrails.test.ts` fails if one is ever added to the allow-list.
 *
 * 🔒 **ADMINS ONLY.** The engine role check admits the coordinator role. Who is actually an admin is
 * an access question, answered once by `mayChangeSiteFeatures`: the statewide coordinator, who also
 * grants roles (`managesAccess`). D-80 gives the access admin and the executive no workflow action at
 * all, so the access admin cannot take this one until Josh rules otherwise. The shared server refuses
 * every other desk, a service coordinator included, with `siteFeatureSwitchRefusal`.
 *
 * A record holds a site code, a listed feature name, a time and a role. Never typed text.
 */

/** Features an admin may switch off at one site. Nothing else can be. */
export const SITE_SWITCHABLE_FEATURES = [
  "bed-meeting-tv",
  "top25-criteria-led-discharge",
  "referral-opened-receipts",
  "referral-information-needs",
  "help-ask",
] as const satisfies readonly WardFeatureFlag[];

export type SiteSwitchableFeature = (typeof SITE_SWITCHABLE_FEATURES)[number];

/**
 * Never switched off at a site, whatever is asked. The first three name kinds of feature rather than
 * one flag, so a future flag of that kind is refused by name too. The flags are the ones that are
 * a safeguard, a safety notice, or a demonstration control that is not a site's to choose.
 */
export const SITE_PROTECTED_FEATURES = {
  "safety-notices": "Safety notices always show",
  "legal-times": "Legal times always show as typed",
  "ruling-guards": "Owner ruling guards always apply",
  "role-access": "Role access is a safeguard",
  "awol-bed-hold-review": "The absent without leave bed hold review is a safety notice",
  "ward-closure-mode": "Ward closure keeps a closed ward closed to admissions",
  "demo-reset": "The demonstration reset is not a site setting",
} as const;

type SiteProtectedFeature = keyof typeof SITE_PROTECTED_FEATURES;

export function isSiteSwitchableFeature(value: unknown): value is SiteSwitchableFeature {
  return typeof value === "string" && (SITE_SWITCHABLE_FEATURES as readonly string[]).includes(value);
}

function isSiteProtectedFeature(value: unknown): value is SiteProtectedFeature {
  return typeof value === "string" && Object.hasOwn(SITE_PROTECTED_FEATURES, value);
}

/** One feature switched off at one site. Switching it back on removes the record. */
export type SiteFeatureSwitchRecord = {
  siteCode: string;
  feature: SiteSwitchableFeature;
  /** When it was switched off. */
  at: Instant;
  by: WardFlowRole;
};

export type SiteFeatureSwitchEvent = {
  type: "SET_SITE_FEATURE_SWITCH";
  role: WardFlowRole;
  /** The board clock. Typed `number`, as other event types beside their records. */
  now: number;
  siteCode: string;
  feature: SiteSwitchableFeature;
  /** True switches the feature off at the site; false switches it back on. */
  off: boolean;
};

type SiteSwitchState = {
  units: readonly { siteCode: string }[];
  siteFeatureSwitches?: SiteFeatureSwitchRecord[];
};

/**
 * The reducer half. Refuses a protected or unlisted feature, a site with no wards in this workspace,
 * and a switch that changes nothing (already off, or not off).
 */
export function reduceSiteFeatureSwitch<S extends SiteSwitchState>(
  state: S,
  event: SiteFeatureSwitchEvent,
  reject: (state: S, reason: string) => S,
  accept: () => void,
): S {
  const feature: unknown = event.feature;
  if (isSiteProtectedFeature(feature))
    return reject(state, `${String(feature)} can never be switched off at a site: ${SITE_PROTECTED_FEATURES[feature]}`);
  if (!isSiteSwitchableFeature(feature))
    return reject(state, `${event.type} feature must be chosen from SITE_SWITCHABLE_FEATURES`);
  if (typeof event.off !== "boolean") return reject(state, `${event.type} must say off or on`);
  if (typeof event.siteCode !== "string" || !state.units.some((unit) => unit.siteCode === event.siteCode))
    return reject(state, `no site with wards found for code ${String(event.siteCode)}`);
  const records = state.siteFeatureSwitches ?? [];
  const existing = records.find((record) => record.siteCode === event.siteCode && record.feature === feature);
  if (event.off && existing) return reject(state, "That feature is already switched off at this site");
  if (!event.off && !existing) return reject(state, "That feature is not switched off at this site");
  accept();
  const next = event.off
    ? [...records, { siteCode: event.siteCode, feature, at: event.now, by: event.role }]
    : records.filter((record) => record !== existing);
  return { ...state, siteFeatureSwitches: next };
}

/** The features switched off at one site. */
export function featuresOffAtSite(
  records: readonly SiteFeatureSwitchRecord[] | undefined,
  siteCode: string,
): SiteSwitchableFeature[] {
  return (records ?? [])
    .filter((record) => record.siteCode === siteCode && isSiteSwitchableFeature(record.feature))
    .map((record) => record.feature);
}

/** True when this feature is switched off at this site. */
export function featureOffAtSite(
  records: readonly SiteFeatureSwitchRecord[] | undefined,
  siteCode: string,
  feature: WardFeatureFlag,
): boolean {
  return (featuresOffAtSite(records, siteCode) as readonly string[]).includes(feature);
}

/**
 * The sites a desk works at: its site, its ED's site or its wards' sites. A service-wide or
 * statewide desk, a community team and the transport jobs desk sit at no one site, so a site switch
 * does not change their screens; a screen about one ward can still ask `featureOffAtSite` for it.
 */
export function deskSiteCodes(access: WardAccess, places: PlaceLookup): string[] {
  const scope = access.scope;
  const codes = new Set<string>();
  if (scope.kind === "site") codes.add(scope.siteCode);
  if (scope.kind === "ed") {
    const code = places.edSiteCode(scope.edId);
    if (code) codes.add(code);
  }
  if (scope.kind === "ward")
    for (const unitId of scope.unitIds) {
      const code = places.unitSiteCode(unitId);
      if (code) codes.add(code);
    }
  return [...codes];
}

/** The features off for this desk: off at any site the desk works at. */
export function featuresOffForDesk(
  records: readonly SiteFeatureSwitchRecord[] | undefined,
  siteCodes: readonly string[],
): SiteSwitchableFeature[] {
  const off = new Set<SiteSwitchableFeature>();
  for (const code of siteCodes) for (const feature of featuresOffAtSite(records, code)) off.add(feature);
  return SITE_SWITCHABLE_FEATURES.filter((feature) => off.has(feature));
}

/**
 * Who may switch a feature off at a site: the statewide coordinator, the one workflow desk that also
 * grants roles. The access admin has no workflow action under D-80 (Josh's call, D-135).
 */
export function mayChangeSiteFeatures(access: WardAccess): boolean {
  return access.role === "coordinator" && access.scope.kind === "statewide";
}

/** The shared server's check, or `null`: only an admin switches, and only a named site. */
export function siteFeatureSwitchRefusal(access: WardAccess, command: Record<string, unknown>): string | null {
  if (!mayChangeSiteFeatures(access)) return "Only an admin switches a feature off at a site.";
  return typeof command.siteCode === "string" ? null : "This change names no site.";
}
