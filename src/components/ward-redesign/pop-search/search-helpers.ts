/**
 * MOCK-UP: small helpers of the header search fork (`global-search.tsx`), moved out unchanged so that
 * file stays under the 1,500-line cap: the alert line, the navigation permission (with draft PR
 * #1123's Help-row rule) and the header measurements.
 */
import {
  communityStatisticsHref,
  edStatisticsHref,
  wardStatisticsHref,
} from "@/components/ward-management/shell/ward-facade";
import { needsYouMeta, type SearchResultItem } from "@/components/ward-management/ward-global-search-groups";

const allowSearchChoice = () => true;

/**
 * Mock-up: an alert's line under its title, without the UMRN (the preview shows it), so the reason
 * fits on one line; a bed pull past its limit says so rather than "overdue", which means form times.
 */
export function alertLine(
  task: Parameters<typeof needsYouMeta>[0] & { title: string },
  lookup: Parameters<typeof needsYouMeta>[1],
  nameFor: Parameters<typeof needsYouMeta>[2],
): string {
  const line = needsYouMeta(task, lookup, nameFor).replace(/ · UM\d+/u, "");
  return /bed pull/iu.test(task.title) ? line.replace(/\boverdue\b/u, "past pull limit") : line;
}

/** Navigation permission never changes the catalogue or supplies a record entitlement. */
export function permittedSearchResult(
  item: SearchResultItem,
  canOpenHref: (href: string) => boolean,
  canRunAction: (action: "new-referral" | "add-patient") => boolean = allowSearchChoice,
): SearchResultItem[] {
  const href = canOpenHref(item.href)
    ? item.href
    : item.kind === "ward"
      ? wardStatisticsHref(item.id)
      : item.kind === "ed"
        ? edStatisticsHref(item.id)
        : item.kind === "team"
          ? communityStatisticsHref(item.id)
          : null;
  // A Help answer with nowhere to go opens Help itself, which every desk may open.
  if (item.kind === "help" && item.href === "") return [item];
  if (!href || !canOpenHref(href)) return [];
  if (item.kind === "action" && !canRunAction(item.id as "new-referral" | "add-patient")) return [];
  return [href === item.href ? item : { ...item, href }];
}

/** The header's bottom edge, so the scrim and palette start under the bar rather than covering it. */
export function headerBottom(root: HTMLElement | null): number {
  if (!root) return 0;
  const bar = root.closest("header") ?? root;
  return Math.max(0, Math.round(bar.getBoundingClientRect().bottom));
}

export type HeaderBox = { top: number; height: number; left: number; width: number };

/**
 * The header's own top edge and height. The compact bar lays the open field over the bar itself,
 * so it needs the bar's height, not its bottom edge: anything above the bar (a banner, a scrolled
 * offset) once made the field as tall as the bar's bottom edge, a giant pill (Josh, 11 Oct 2026).
 * Mock-up: also its left edge and width, the content area beside the rail, so the floating palette
 * centres over the page rather than the whole window and never runs over the rail.
 */
export function headerBox(root: HTMLElement | null): HeaderBox {
  if (!root) return { top: 0, height: 0, left: 0, width: 0 };
  const bar = root.closest("header") ?? root;
  const rect = bar.getBoundingClientRect();
  return {
    top: Math.max(0, Math.round(rect.top)),
    height: Math.max(0, Math.round(rect.height)),
    left: Math.max(0, Math.round(rect.left)),
    width: Math.max(0, Math.round(rect.width)),
  };
}
