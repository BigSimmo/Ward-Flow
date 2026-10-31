import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import type { WardTourRole } from "@/components/ward-management/help/ward-help-store";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

/**
 * The mock-up's own copy of Help's "where is this done" link (`howToHref`), so the mock-up does not
 * depend on which file the real app keeps it in (#1119 moves it out of `ward-help-ask.tsx`). A how-to
 * done in more than one place names them in order (#1119); the first this desk may open wins.
 */
export function howToHref(
  go: string | readonly string[] | undefined,
  role: WardTourRole,
  home: string | undefined,
): string | undefined {
  if (!go) return undefined;
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
