import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";

/**
 * The demo profile Settings shows in its profile band (Workspaces, PR #134), held once so the
 * referral slide-out's "Use my details" fills from the same person. Synthetic: the phone number is
 * in a range reserved for fictional use and the email uses a reserved example domain.
 *
 * There is no sign-in, so the role is the route (`ward-chrome-role.ts`). Only the coordinator
 * routes have a profile today; every other role has none, and says so.
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
  role: "State bed coordinator",
  location: "Perth Central Desk",
  phone: "08 5550 0142",
  email: "s.chen@example.org",
};

const PROFILES: Partial<Record<WardChromeRole, WorkspaceProfile>> = {
  coordinator: SETTINGS_DEMO_PROFILE,
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
