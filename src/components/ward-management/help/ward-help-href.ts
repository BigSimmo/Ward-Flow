import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

import type { WardTourRole } from "./ward-help-store";

/**
 * Where a how-to is done, as a link this desk may follow: its own home, a Settings tab, or a rail
 * page whose screen the desk can open. Anything else gets no link, so Help never offers a door the
 * guard would shut. A how-to done in more than one place names them in order.
 */
export function howToHref(
  go: string | readonly string[] | undefined,
  role: WardTourRole,
  home: string | undefined,
): string | undefined {
  if (!go) return undefined;
  // Several places: the first this desk may open.
  if (typeof go !== "string") {
    for (const each of go) {
      const href = howToHref(each, role, home);
      if (href) return href;
    }
    return undefined;
  }
  if (go === "home") return home;
  if (go.startsWith("settings#")) return `/ward-flow/settings#${go.slice("settings#".length)}`;
  const entry = railEntries().find((candidate) => candidate.id === go);
  const screen = entry ? screenForPath(entry.href)?.screen : undefined;
  if (!entry || !screen || !ROLE_SCREENS[role][screen]) return undefined;
  return entry.href;
}
