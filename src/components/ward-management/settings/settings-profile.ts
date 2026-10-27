import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";

/**
 * The demo profile Settings shows in its profile band (Workspaces, PR #134), held once so the
 * referral slide-out's "Use my details" fills from the same person. Synthetic: the phone number is
 * in a range reserved for fictional use and the email uses a reserved example domain.
 *
 * There is no sign-in, so the role is the route (`ward-chrome-role.ts`). The coordinator, ED and
 * community routes have a profile (WS-07, 26 Oct 2026: an ED clinician typed five contact fields at
 * the first Send); every other role has none, and says so.
 */
export type WorkspaceProfile = {
  name: string;
  initials: string;
  role: string;
  location: string;
  phone: string;
  email: string;
};

export const SETTINGS_DEMO_PROFILE: WorkspaceProfile = {
  name: "Dr S. Chen",
  initials: "SC",
  role: CHROME_ROLE_LABELS.coordinator,
  location: "Perth Central Desk",
  // Audit 2 E-06: the fictitious 08 5550 range in international form, which the synthetic-data
  // guard (`src/lib/synthetic-data-guard.ts`) does not mistake for a real WA number.
  phone: "+61 8 5550 0142",
  email: "s.chen@example.org",
};

/** Synthetic, like the coordinator's: the same fictional 08 5550 range and example domain. */
const ED_DEMO_PROFILE: WorkspaceProfile = {
  name: "Dr A. Nguyen",
  initials: "AN",
  role: CHROME_ROLE_LABELS.ed,
  location: "Emergency department",
  phone: "+61 8 5550 0167",
  email: "a.nguyen@example.org",
};

const COMMUNITY_DEMO_PROFILE: WorkspaceProfile = {
  name: "J. Walker",
  initials: "JW",
  role: CHROME_ROLE_LABELS.community,
  location: "Community mental health team",
  phone: "+61 8 5550 0183",
  email: "j.walker@example.org",
};

const PROFILES: Partial<Record<WardChromeRole, WorkspaceProfile>> = {
  coordinator: SETTINGS_DEMO_PROFILE,
  ed: ED_DEMO_PROFILE,
  community: COMMUNITY_DEMO_PROFILE,
};

export type ProfileLookup =
  { status: "available"; profile: WorkspaceProfile } | { status: "unavailable"; reason: string };

/** The profile for the role this route gives, or why there is none. */
export function profileForChromeRole(role: WardChromeRole): ProfileLookup {
  // Own keys only, so a role name can never reach an inherited property.
  const profile = Object.hasOwn(PROFILES, role) ? PROFILES[role] : undefined;
  return profile
    ? { status: "available", profile }
    : { status: "unavailable", reason: `No profile set for ${CHROME_ROLE_LABELS[role]}` };
}
