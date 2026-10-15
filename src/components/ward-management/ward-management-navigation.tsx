"use client";

import Link from "next/link";

import shellStyles from "./ward-management.module.css";
import { WARD_VIEW_ICONS } from "./ward-nav-icons";
import { WARD_VIEWS, type WardMode } from "./ward-nav";
import { useWardNavCounts } from "./use-ward-nav-counts";
import { orderViewsForRole } from "./ward-nav-role-order";

export type { WardMode } from "./ward-nav";

function RailLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={active ? shellStyles.railLinkActive : shellStyles.railLink}
    >
      {children}
    </Link>
  );
}

/**
 * The views as an icon-only strip inside the rail. Rendered from `WARD_VIEWS` rather than literal
 * link blocks: the labelled panel and drawer need the same destinations, and a second
 * hand-maintained copy of them is exactly the defect `ward-nav.ts` was created to end.
 *
 * ⚠️ **THIS SAID "THE EIGHT VIEWS" UNTIL 2026-09-06, WHEN `WARD_VIEWS` HELD SIX.** MERGE 01–03
 * folded queue+exceptions into Delays, morning into Capacity and transport into Movements, and the
 * prose kept the old number — **in the one file whose entire purpose is to stop a second copy of
 * the destination list drifting from the first.** A count written in prose IS a second copy: it
 * cannot be derived, nothing goes red when it rots, and a reader trusts it exactly as much as the
 * code beside it. The number is deliberately not restated here — `WARD_VIEWS.length` is the only
 * honest answer and it is one line away.
 *
 * `active` is optional: a route with no natural eight-view equivalent (a role detail screen, a
 * board, the patient workspace) passes nothing, and every `aria-current` comparison is simply
 * false. The nav still orients the user without falsely claiming one of the eight is current.
 */
export function WardModeNavigation({ active }: { active?: WardMode }) {
  /*
   * Same hook the labelled panel uses, so the collapsed rail and the expanded panel can never
   * present a different ORDER for the same route.
   *
   * 🔴 **BUT THE RAIL DELIBERATELY CARRIES NO COUNTS, AND A GUARD IS THE REASON.** They were added
   * here — in the label and the tooltip, never as a badge — and `ward-nav.test.ts`'s ward-index
   * restraint check went red on the word "beds": that page exists to list every ward and to show
   * **no bed figure at all**, and its blocklist scans the whole document, rail included,
   * deliberately. The guard is right and the change was wrong. A figure somebody must act on is
   * already carried at every width by `WardChromeHeader`, whose toggle states a breached deadline
   * on its own face; the rail is a way to get somewhere, and the numbers belong in the expanded
   * panel beside the words that say what they count.
   */
  const { shellRole: role } = useWardNavCounts();
  return (
    <nav className={shellStyles.railNav} aria-label="Ward Flow views">
      {orderViewsForRole(WARD_VIEWS, role).map((view) => {
        const Icon = WARD_VIEW_ICONS[view.id];
        const isActive = active === view.id;
        return (
          <RailLink key={view.id} href={view.href} label={view.label} active={isActive}>
            <Icon aria-hidden="true" />
          </RailLink>
        );
      })}
    </nav>
  );
}
