import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCESS_ROLE_LABELS,
  ROLE_SCREENS,
  WARD_ACCESS_ROLES,
  WARD_SCREEN_IDS,
  type WardAccessRole,
} from "@/components/ward-management/ward-role-access";

const guide = readFileSync("docs/ward-flow/desk-guides/why-cant-i.md", "utf8");

/** Help's agreed name for the bed manager desk; every other role uses its access label. */
function roleName(role: WardAccessRole): string {
  return role === "bed_manager" ? "Bed manager" : ACCESS_ROLE_LABELS[role];
}

const GRANT_NOTE = { all: "", own: " (own place)", counts: " (counts only)" } as const;

/** The roles that can open a screen, as the guide writes them, from ROLE_SCREENS. */
function expectedRoles(screen: (typeof WARD_SCREEN_IDS)[number]): string {
  return WARD_ACCESS_ROLES.flatMap((role) => {
    const grant = ROLE_SCREENS[role][screen];
    return grant ? [`${roleName(role)}${GRANT_NOTE[grant]}`] : [];
  }).join(", ");
}

describe("why can't I desk guide (P10)", () => {
  const rows = new Map([...guide.matchAll(/^\|\s*`([a-z-]+)`\s*\|\s*(.+?)\s*\|$/gm)].map((m) => [m[1], m[2]] as const));

  it("has one row for every screen in ROLE_SCREENS", () => {
    expect([...rows.keys()]).toEqual([...WARD_SCREEN_IDS]);
  });

  it("lists exactly the roles ROLE_SCREENS lets open each screen", () => {
    for (const screen of WARD_SCREEN_IDS) expect(rows.get(screen), screen).toBe(expectedRoles(screen));
  });
});
