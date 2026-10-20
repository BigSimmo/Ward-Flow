/**
 * FEATURE FLAGS — unfinished work ships inside the real screens, switched off where it is not ready,
 * instead of on a hidden page of its own (Josh, 15 Oct 2026, item 7 of the review list).
 *
 * Every flag is registered here once, with an owner, a default for each environment, what it does
 * and when it should be removed. Nothing else in the app may invent a flag name: the type below is
 * derived from this registry, so an unknown name does not build.
 *
 * How a flag's value is decided, first match wins:
 *   1. This device's choice (Settings, Data and about, Feature flags), or a demo link such as
 *      `?flags=bed-meeting-tv:on`. Ignored in production, where only the server decides.
 *   2. The server's `NEXT_PUBLIC_WARD_FLAGS` setting, for example `bed-meeting-tv=off,demo-reset=on`.
 *   3. The registry default for the environment (`NEXT_PUBLIC_WARD_ENVIRONMENT`, else development
 *      for a local build and demo for a deployed build).
 * A flag marked `safeguard` skips all three in production and is always on there; the same holds
 * for a deployed build that names no environment (`wardSafeguardsLocked`).
 *
 * A device choice holds only a flag name from this registry and on or off, never typed text.
 */

export type WardEnvironment = "development" | "demo" | "production";

export type WardFeatureFlagDefinition = {
  /** The name shown in Settings. */
  label: string;
  /** What switching it on adds, in one sentence. */
  description: string;
  /** Who decides when it is finished. */
  owner: string;
  /** The date it was added, so a stale flag is easy to spot. */
  added: string;
  defaults: Record<WardEnvironment, boolean>;
  /** What has to happen before the flag and its off path are deleted. */
  removeWhen: string;
  /**
   * A safeguard is on in production whatever the server setting or a device says, so an access
   * control fails closed: a typo or a stray setting cannot switch it off.
   */
  safeguard?: true;
  /**
   * Audit 1 (Josh 20 Oct 2026, D-71): a mockup kept to local builds. Off on any deployed build,
   * whatever the server setting or a device says.
   */
  localOnly?: true;
};

export const WARD_FEATURE_FLAGS = {
  "bed-meeting-tv": {
    label: "TV views",
    description:
      "Read only, large type screens for the bed meeting, one ward or one ED, linked from the menu, Tools, Capacity, each ward and each ED.",
    owner: "Josh",
    added: "2026-10-15",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh signs off the TV views after a real bed meeting, ward and ED trial.",
  },
  "demo-reset": {
    label: "One tap demo reset",
    description: "Quiet day, winter surge and ED crisis buttons in Tools that reload the whole synthetic network.",
    owner: "Josh",
    added: "2026-10-15",
    // Josh 20 Oct 2026: off on the live site (runs as demo), on for local builds.
    defaults: { development: true, demo: false, production: false },
    removeWhen: "Never in a demonstration build. Keep off in production, where there is no demo data to reset.",
  },
  "role-access": {
    label: "Role access",
    description:
      "Each desk sees only the screens, patients and actions its role needs. Switch desk to see what a ward, ED, team, bed manager, officer, executive or access admin gets.",
    owner: "Josh",
    added: "2026-10-15",
    // Readiness review item 14 (18 Oct 2026): on by default in demo and production builds, and a
    // safeguard, so production cannot switch it off. The server already scopes shared reads and
    // saves to each account's role; this switch is the browser half.
    defaults: { development: false, demo: true, production: true },
    safeguard: true,
    removeWhen: "The server enforces the same access table (role access plan PR 2) and Josh signs off the roles.",
  },
  "top25-criteria-led-discharge": {
    label: "Criteria led discharge",
    description:
      "For a voluntary patient, the treating psychiatrist sets discharge criteria and the ward can confirm the discharge once all are met.",
    owner: "Josh",
    added: "2026-10-15",
    // D-65 (17 Oct 2026): Josh switched it on in production for the prototype.
    defaults: { development: true, demo: true, production: true },
    removeWhen:
      "Josh signs off the item in the real screens after review, and clinical governance agrees the criteria list.",
  },
  "awol-bed-hold-review": {
    label: "Absent without leave bed hold review",
    description:
      "The absent without leave tracker asks for a review of the held bed once the person has been away past the set time.",
    owner: "Josh",
    added: "2026-10-17",
    // D-65 (17 Oct 2026) paused it until Josh reviewed the hold time against local procedure.
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh reviews the bed hold time against local procedure, then keeps or removes the review.",
  },
  "make-room-chains": {
    label: "Make room plans",
    description:
      "Mockups only: a waiting referral whose ward is full shows how stepping down patients already marked for step down could free a bed, in two or three moves.",
    owner: "Josh",
    added: "2026-10-17",
    // Mockup stage with preview data, so on only for a local build until Josh picks a design.
    defaults: { development: true, demo: false, production: false },
    localOnly: true,
    removeWhen: "Josh picks a mockup and the chosen plan is built into the real screens.",
  },
  "referral-opened-receipts": {
    label: "Opened by the ward",
    description: "The referrer sees when a ward first opened a referral.",
    owner: "Josh",
    added: "2026-10-19",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh agrees the receipt with ward and ED leads.",
  },
  "referral-information-needs": {
    label: "What we still need",
    description: "A ward can ask the referrer for listed items before deciding.",
    owner: "Josh",
    added: "2026-10-19",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh agrees the list of items with ward and ED leads.",
  },
  "ward-closure-mode": {
    label: "Ward closure",
    description: "Close a whole ward to admissions with a reason, then reopen it.",
    owner: "Josh",
    added: "2026-10-19",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh agrees the closure reasons with the coordinators.",
  },
  "shift-confirmations": {
    label: "Confirmed this shift",
    description:
      "On Capacity, how many wards have confirmed their bed numbers since the shift began, and which have not.",
    owner: "Josh",
    added: "2026-10-19",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh agrees the card with the coordinators after a bed meeting trial.",
  },
  "bed-meeting-actions": {
    label: "Bed meeting agenda",
    description:
      "A bed meeting agenda built from fixed rules, and an action log with an owner and a due time, linked from Capacity.",
    owner: "Josh",
    added: "2026-10-19",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh agrees the action list and owners with the coordinators after a bed meeting trial.",
  },
  "pilot-measures": {
    label: "Pilot measures",
    description: "The weekly report adds the pilot's agreed measures.",
    owner: "Josh",
    added: "2026-10-19",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh agrees the measure definitions with the pilot sponsor.",
  },
  "missed-requests-check": {
    label: "Daily missed request check",
    description: "Waiting shows coordinators a daily check for missed or doubled bed requests.",
    owner: "Josh",
    added: "2026-10-19",
    // Josh, 20 Oct 2026: "turn on all features", so on in every environment.
    defaults: { development: true, demo: true, production: true },
    removeWhen: "Josh agrees the window and the rules with the pilot sponsor.",
  },
} as const satisfies Record<string, WardFeatureFlagDefinition>;

export type WardFeatureFlag = keyof typeof WARD_FEATURE_FLAGS;

export const WARD_FEATURE_FLAG_NAMES = Object.keys(WARD_FEATURE_FLAGS) as WardFeatureFlag[];

export type WardFeatureFlagOverrides = Partial<Record<WardFeatureFlag, boolean>>;

export type WardFeatureFlagSource = "device" | "server" | "default";

export type ResolvedWardFeatureFlag = {
  name: WardFeatureFlag;
  definition: WardFeatureFlagDefinition;
  on: boolean;
  source: WardFeatureFlagSource;
  /** False in production: the device and demo links cannot change a flag there. */
  deviceCanChange: boolean;
};

function isWardFeatureFlag(value: string): value is WardFeatureFlag {
  return Object.hasOwn(WARD_FEATURE_FLAGS, value);
}

/** The environment this build runs as. Unknown values fall back rather than throwing. */
export function wardEnvironment(
  configured: string | undefined = process.env.NEXT_PUBLIC_WARD_ENVIRONMENT,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): WardEnvironment {
  const named = configured?.trim().toLowerCase();
  if (named === "development" || named === "demo" || named === "production") return named;
  return nodeEnv === "production" ? "demo" : "development";
}

/**
 * Audit F-20 (19 Oct 2026): safeguards fail closed. A deployed build that names no environment
 * still runs as demo, but its safeguard flags are locked on as in production, so a device or a
 * server setting cannot switch role access off by accident. Naming `demo` keeps them switchable.
 */
export function wardSafeguardsLocked(
  configured: string | undefined = process.env.NEXT_PUBLIC_WARD_ENVIRONMENT,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  const environment = wardEnvironment(configured, nodeEnv);
  if (environment === "production") return true;
  return nodeEnv === "production" && environment !== configured?.trim().toLowerCase();
}

const ON_WORDS = new Set(["on", "true", "1", "yes"]);
const OFF_WORDS = new Set(["off", "false", "0", "no"]);

/**
 * Reads `name=on,other=off` (the server setting) or `name:on` (a demo link). Unknown names and
 * values are skipped, so a typo switches nothing.
 */
export function parseWardFeatureFlagList(text: string | null | undefined): WardFeatureFlagOverrides {
  const overrides: WardFeatureFlagOverrides = {};
  if (!text) return overrides;
  for (const part of text.split(",")) {
    const [rawName, rawValue] = part.split(/[=:]/, 2);
    const name = rawName?.trim() ?? "";
    const value = rawValue?.trim().toLowerCase() ?? "";
    if (!isWardFeatureFlag(name)) continue;
    if (ON_WORDS.has(value)) overrides[name] = true;
    else if (OFF_WORDS.has(value)) overrides[name] = false;
  }
  return overrides;
}

/** Reads a stored device choice, keeping only registered names with a true or false value. */
export function parseStoredWardFeatureFlags(raw: string | null): WardFeatureFlagOverrides {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const overrides: WardFeatureFlagOverrides = {};
  for (const [name, value] of Object.entries(parsed)) {
    if (isWardFeatureFlag(name) && typeof value === "boolean") overrides[name] = value;
  }
  return overrides;
}

export function resolveWardFeatureFlags(input: {
  environment: WardEnvironment;
  server: WardFeatureFlagOverrides;
  device: WardFeatureFlagOverrides;
  /** Safeguards locked on; production always, and an unnamed deployed build (`wardSafeguardsLocked`). */
  safeguardsLocked?: boolean;
}): ResolvedWardFeatureFlag[] {
  const deviceCanChange = input.environment !== "production";
  const safeguardsLocked = input.safeguardsLocked === true || input.environment === "production";
  return WARD_FEATURE_FLAG_NAMES.map((name) => {
    const definition: WardFeatureFlagDefinition = WARD_FEATURE_FLAGS[name];
    if (definition.safeguard && safeguardsLocked)
      return { name, definition, on: true, source: "default", deviceCanChange: false };
    if (definition.localOnly && input.environment !== "development")
      return { name, definition, on: false, source: "default", deviceCanChange: false };
    const device = deviceCanChange ? input.device[name] : undefined;
    if (device !== undefined) return { name, definition, on: device, source: "device", deviceCanChange };
    const server = input.server[name];
    if (server !== undefined) return { name, definition, on: server, source: "server", deviceCanChange };
    return { name, definition, on: definition.defaults[input.environment], source: "default", deviceCanChange };
  });
}

/** The server setting, read literally so the build inlines it. */
export function serverWardFeatureFlags(): WardFeatureFlagOverrides {
  return parseWardFeatureFlagList(process.env.NEXT_PUBLIC_WARD_FLAGS);
}

export const WARD_FEATURE_FLAG_SOURCE_LABELS: Record<WardFeatureFlagSource, string> = {
  device: "Set on this device",
  server: "Set by the server",
  default: "Default",
};
