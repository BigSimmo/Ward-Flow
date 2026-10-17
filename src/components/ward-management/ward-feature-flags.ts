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
};

export const WARD_FEATURE_FLAGS = {
  "bed-meeting-tv": {
    label: "TV views",
    description:
      "Read only, large type screens for the bed meeting, one ward or one ED, linked from the menu, Tools, Capacity, each ward and each ED.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the TV views after a real bed meeting, ward and ED trial.",
  },
  "demo-reset": {
    label: "One tap demo reset",
    description: "Quiet day, winter surge and ED crisis buttons in Tools that reload the whole synthetic network.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Never in a demonstration build. Keep off in production, where there is no demo data to reset.",
  },
  "role-access": {
    label: "Role access",
    description:
      "Each desk sees only the screens, patients and actions its role needs. Switch desk to see what a ward, ED, team, bed manager, officer, executive or access admin gets.",
    owner: "Josh",
    added: "2026-10-15",
    // Off everywhere until Josh tries it (`?flags=role-access:on` turns it on for one device).
    defaults: { development: false, demo: false, production: false },
    removeWhen: "The server enforces the same access table (role access plan PR 2) and Josh signs off the roles.",
  },
  "top25-discharge-prep": {
    label: "Discharge prep before expected discharge",
    description:
      "Patients due out within a day show on the ward with their discharge barrier, so the barrier can be set before the day.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
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
  "top25-discharge-notices": {
    label: "Discharge support notices",
    description: "Confirming a discharge offers pharmacy, transport and cleaning notices to send in one go.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-cleaning-reminder": {
    label: "Bed being made ready reminder",
    description:
      "A bed still being made ready after the set time asks the ward to confirm it is ready. It never opens the bed itself.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-broadcast-extend": {
    label: "Extend a broadcast alert",
    description: "The alert banner can extend an active broadcast alert or stand it down.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-next-ward": {
    label: "Next ward after a refusal",
    description: "When a ward declines, the next eligible wards are suggested from the same matching rules.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-stuck-handover": {
    label: "Handover waiting too long",
    description:
      "An accepted patient still waiting to leave after the transport target is flagged to the sending team.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-admission-checklist": {
    label: "Admission arrival checklist",
    description: "A short checklist for the receiving ward before the patient arrives.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-prematch-cleaning": {
    label: "Match to a bed being made ready",
    description: "A bed being made ready can be matched, and a medical pause on the patient is shown.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-long-stay-dossier": {
    label: "Long stay summary",
    description:
      "Patients past the long stay prompt show one summary of the barrier, the days waiting and the next step.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-edd-drift": {
    label: "Discharge date moved badge",
    description: "A badge shows when a discharge date has moved several times.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-needs-you-roles": {
    label: "Needs you for every role",
    description: "The Needs you list shows items owned by the signed in role on each screen.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-silent-ward": {
    label: "Silent ward reminders",
    description:
      "A ward that has not answered a referral gets reminders at the set times. Nothing is moved automatically.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-legal-radar": {
    label: "Paper legal form time left",
    description: "Paper legal forms show time left using the one shared rule and the due soon settings.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-awol-tracker": {
    label: "Absent without leave steps",
    description: "The absent without leave steps and bed hold show as one tracker with time since absent.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "awol-bed-hold-review": {
    label: "Absent without leave bed hold review",
    description:
      "The absent without leave tracker asks for a review of the held bed once the person has been away past the set time.",
    owner: "Josh",
    added: "2026-10-17",
    // D-65 (17 Oct 2026): paused everywhere until Josh reviews the hold time against local procedure.
    defaults: { development: false, demo: false, production: false },
    removeWhen: "Josh reviews the bed hold time and switches the review back on, or removes it.",
  },
  "top25-referral-cap": {
    label: "Referral cap and auto withdraw",
    description:
      "A patient can be referred to at most the set number of wards at once, and other requests are withdrawn when one ward accepts.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-step-down-board": {
    label: "Step down board",
    description:
      "Step down candidates are matched to wards using the main eligibility rules, including single sex, risk and legal checks.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "make-room-chains": {
    label: "Make room plans",
    description:
      "Mockups only: a waiting referral whose ward is full shows how stepping down patients already marked for step down could free a bed, in two or three moves.",
    owner: "Josh",
    added: "2026-10-17",
    // Mockup stage with preview data, so on only for a local build until Josh picks a design.
    defaults: { development: true, demo: false, production: false },
    removeWhen: "Josh picks a mockup and the chosen plan is built into the real screens.",
  },
  "top25-follow-up-7day": {
    label: "Seven day follow up check",
    description:
      "Every discharge shows whether follow up within seven days is arranged, with extra items for a community treatment order. It warns and never blocks.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-ed-wait-ladder": {
    label: "ED long wait steps",
    description: "ED waits show one set of escalation steps from the shared thresholds.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
  },
  "top25-walk-round": {
    label: "Phone walk round",
    description:
      "On a phone, a bed strip above the ward's bed list walks the ward one bed at a time in bed order, with reviewed and changed marks for this round.",
    owner: "Josh",
    added: "2026-10-15",
    defaults: { development: true, demo: true, production: false },
    removeWhen: "Josh signs off the item in the real screens after review.",
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
}): ResolvedWardFeatureFlag[] {
  const deviceCanChange = input.environment !== "production";
  return WARD_FEATURE_FLAG_NAMES.map((name) => {
    const definition: WardFeatureFlagDefinition = WARD_FEATURE_FLAGS[name];
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
