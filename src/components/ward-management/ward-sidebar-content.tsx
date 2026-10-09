"use client";

import Link from "next/link";
import { LayoutGrid, PanelLeftClose } from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";

import { WardDemoControls } from "./ward-demo-controls";
import { WardRoleSwitcher } from "./ward-role-switcher";
import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "./ward-nav-icons";
import { WARD_DEVELOPER_HUB_HREF, WARD_NAV, WARD_VIEWS, type WardMode, type WardNavItem } from "./ward-nav";
import { orderBoardsForRole, orderRoleScreensForRole, orderViewsForRole } from "./ward-nav-role-order";
import { wardNavCountLabel, type WardNavCount, type WardNavCounts } from "./ward-nav-counts";
import { useWardNavCounts } from "./use-ward-nav-counts";
import { buildActionInbox, destinationUnit, isOpen } from "./ward-derivations";
import { useWardFlow, useWardFlowClock } from "./ward-flow-provider";

import styles from "./ward-sidebar.module.css";

/**
 * Ward Flow's labelled sidebar body, mounted by both the expanded desktop panel and the phone
 * drawer — the same one-content-two-hosts arrangement `ClinicalSidebarContent` uses for the
 * clinical application's sidebar and mobile sheet. Writing the destinations once is the whole
 * point: the icon rail, this panel and this drawer all read `ward-nav.ts`, so a destination
 * added in one place appears in all three or in none.
 */
export function WardSidebarContent(props: {
  activeMode?: WardMode;
  showBrandRow?: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <WardSidebarNav {...props} />
      <WardSidebarFooter onNavigate={props.onNavigate} />
    </>
  );
}

/**
 * The navigation half. Split from the footer so the desktop panel can scroll this and pin that:
 * on a 900px-tall screen the footer's role switcher and demo clock fell below the fold, which the
 * icon rail had never let happen because it pinned its own bottom block.
 */
export function WardSidebarNav({
  activeMode,
  showBrandRow = true,
  onCollapse,
  onNavigate,
}: {
  activeMode?: WardMode;
  /** The drawer's Sheet supplies its own header, so it turns this off. */
  showBrandRow?: boolean;
  /** Present only on the desktop panel; the drawer closes instead of collapsing. */
  onCollapse?: () => void;
  onNavigate?: () => void;
}) {
  /*
   * The role and the figures come from the same hook the collapsed icon rail uses — see
   * `use-ward-nav-counts.ts` for why neither is a prop, and why both trees must read one source.
   */
  const { role, counts, placeId } = useWardNavCounts();
  const { movements, units, plannedAdmissions = [] } = useWardFlow();
  const now = useWardFlowClock();
  /*
   * Scoped to the reader's own place, not the network — see `WardSidebarAttention`'s doc comment
   * for the predicates and why an unscoped `placeId` yields an empty list rather than the full
   * inbox. The predicate itself is chosen by role because a ward and an emergency department are
   * matched against different movement fields; a coordinator route never carries a `placeId`, so
   * it never reaches either branch with anything to filter.
   */
  const placeMovements =
    placeId === undefined
      ? []
      : movements
          .filter(isOpen)
          .filter((movement) =>
            role === "ed" ? movement.originEdId === placeId : destinationUnit(movement, units)?.id === placeId,
          );
  // Planned arrivals are ward bookings; an ED place has no destination unit to match.
  const placePlanned =
    placeId === undefined || role === "ed" ? [] : plannedAdmissions.filter((booking) => booking.unitId === placeId);
  const attention = buildActionInbox(placeMovements, now, units, placePlanned);

  return (
    <>
      {showBrandRow ? (
        <div className={styles.brandRow}>
          <Link href="/mockups/ward-flow" className={styles.brandLink} onClick={onNavigate}>
            <BrandMark tone="emphasis" optical="chrome" className={styles.brandGlyph} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>Ward Flow</span>
              <span className={styles.brandTagline}>Synthetic patient-flow prototype</span>
            </span>
          </Link>
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              className={styles.collapseButton}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      {role === "coordinator" ? null : (
        <WardSidebarAttention placeId={placeId} items={attention} onNavigate={onNavigate} />
      )}

      <nav className={styles.group} aria-label="Ward Flow views">
        <span className={styles.groupLabel}>Views</span>
        {orderViewsForRole(WARD_VIEWS, role).map((view) => {
          const Icon = WARD_VIEW_ICONS[view.id];
          const active = activeMode === view.id;
          const count = counts[view.id];
          return (
            <Link
              key={view.id}
              href={view.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={count === undefined ? undefined : wardNavCountLabel(view.label, count)}
              className={active ? styles.linkActive : styles.link}
            >
              <Icon aria-hidden="true" />
              <span className={styles.linkLabel}>{view.label}</span>
              <WardNavCountChip count={count} />
            </Link>
          );
        })}
      </nav>

      <WardSidebarGroup
        label="Role screens"
        items={orderRoleScreensForRole(
          WARD_NAV.filter((item) => item.group === "role"),
          role,
        )}
        counts={counts}
        onNavigate={onNavigate}
      />

      <WardSidebarGroup
        label="Boards"
        items={orderBoardsForRole(
          WARD_NAV.filter((item) => item.group === "board"),
          role,
        )}
        counts={counts}
        onNavigate={onNavigate}
      />
    </>
  );
}

/**
 * The number beside a destination.
 *
 * ⚠️ **`aria-hidden`, because the words are on the link instead.** The chip shows a digit and only a
 * digit — there is no room for "beds ready now" beside a nav label — so the same fact is given to a
 * screen reader as part of the link's accessible name (`wardNavCountLabel`). Announcing both would
 * read the number twice; announcing only the chip would read a numeral with nothing attached to it.
 */
function WardNavCountChip({ count }: { count: WardNavCount | undefined }) {
  if (count === undefined) return null;
  return (
    <span className={count.urgent ? styles.countUrgent : styles.count} aria-hidden="true">
      {count.value}
    </span>
  );
}

/**
 * **WHAT NEEDS DOING, AT THE TOP OF A WARD'S OR AN EMERGENCY DEPARTMENT'S SIDEBAR.**
 *
 * 🔴 **THE HEADING IS "NEEDS YOU NOW", AND THE SCOPE IS WHAT NOW MAKES THAT TRUE.** The population
 * fed to `buildActionInbox` is no longer every open movement in the network — the caller in
 * `WardSidebarNav` filters it first, to exactly the movements attributable to the reader's own
 * place: `destinationUnit(movement, units)?.id === placeId` for a ward, and
 * `movement.originEdId === placeId` for an emergency department, byte-for-byte the predicate
 * `edPressure` already uses for the same kind of place (`ward-pressure.ts`). One definition of
 * "belongs here", read twice rather than reinvented.
 *
 * 🔴 **AND WHEN `placeId` IS `undefined`, THIS RENDERS NOTHING — NEVER THE UNSCOPED NETWORK LIST.**
 * `wardChromeRole` returns `"ward"` for `/board/` as well as `/ward/`, so a route can carry ward
 * chrome with no id anywhere in it (`wardPlaceIdFor`, `ward-place.ts`, is a bare id lookup and
 * returns `undefined` exactly there). Falling back to the network inbox on that route would tell a
 * nurse in charge that another hospital's patient was theirs — the same misattribution the old
 * "needs you now" wording could not support, now guarded at the population rather than only at the
 * word.
 *
 * 🔴 **AND IT RENDERS NOTHING WHEN THE (SCOPED) LIST IS EMPTY, RATHER THAN "nothing needs
 * attention".** `buildActionInbox` is a set of named categories, not everything that could be wrong
 * — see its own doc comment, where the legal category is dormant against today's fixture. An empty
 * inbox therefore means "none of these particular things belong to you", and a sidebar that turned
 * that into a reassurance would be making the stronger claim on the model's behalf.
 *
 * ⚠️ **SAME DERIVATION AS THE HEADER'S TASKS DRAWER, DELIBERATELY.** One definition of "needs
 * attention", two places it is shown. A second definition here would diverge the first time either
 * was tuned, and the two would sit on the same screen contradicting each other. Scoping happens in
 * the caller, to the *input* movements — never as a second filter over the drawer's own output.
 */
/**
 * How many attention rows are shown, and how many are left over.
 *
 * Three, because a section that grows without limit pushes every destination below the fold — which
 * is how this panel's own footer came to be pinned.
 *
 * 🔴 **AND THE TRUNCATION SAYS SO IN WORDS, BECAUSE A HEADING COUNT DOES NOT.** This first showed
 * "Needs you now · 4" above three rows and nothing else: measured on the real render, the only thing
 * distinguishing "there are four and you can see three" from "there are four" is counting the rows,
 * which nobody does. That is the defect `RECENTLY_DECIDED_DISPLAY_LIMIT` already records in this
 * codebase — a heading naming the display cap while reading as a total. The remainder is named, and
 * it names where the rest are: the header's Tasks drawer holds all of them, and holds the only
 * controls that can act on one.
 *
 * 🔴 **EXPORTED, AND SCOPING IS WHY.** Until the list was scoped to one place, a ward's block showed
 * the whole network and the seed's four items exercised the truncation. Scoped, **no place on either
 * seeded scenario has more than two** (measured: busiest ward 1, busiest ED 2, across `standard` and
 * `scarce`) — so the truncation branch became unreachable through the component, and the test that
 * covered it was rewritten to assert the *other* branch. That left a live code path with no coverage
 * at all, which is the exact class this project keeps finding: **a capability that still exists,
 * still passes everything, and reaches nobody.**
 *
 * ⚠️ **This is not a test-only export.** It is the caller's own arithmetic, lifted out so both
 * branches can be given a list — which is the only way to exercise a cap the fixture cannot reach.
 * The alternative was to delete the cap; that was rejected because the owner will replace this seed
 * with real ward data, where a single ward having four things wrong is an ordinary morning.
 */
export function attentionRows<T>(items: readonly T[], limit = 3): { shown: readonly T[]; hidden: number } {
  const shown = items.slice(0, limit);
  return { shown, hidden: items.length - shown.length };
}

function WardSidebarAttention({
  placeId,
  items,
  onNavigate,
}: {
  placeId: string | undefined;
  items: ReturnType<typeof buildActionInbox>;
  onNavigate?: () => void;
}) {
  if (placeId === undefined) return null;
  if (items.length === 0) return null;
  const { shown, hidden } = attentionRows(items);
  return (
    <nav className={styles.group} aria-label="Ward Flow attention">
      <span className={styles.groupLabel}>
        Needs you now
        <span className={styles.groupCount}>{items.length}</span>
      </span>
      {shown.map((item) => (
        <Link
          key={item.id}
          href={`/mockups/ward-flow/movements/${item.movementId}`}
          onClick={onNavigate}
          className={styles.attentionLink}
        >
          <item.icon aria-hidden="true" />
          <span className={styles.linkLabel}>{item.title}</span>
        </Link>
      ))}
      {hidden > 0 ? <span className={styles.attentionMore}>{hidden} more in Tasks, at the top of the page</span> : null}
    </nav>
  );
}

/**
 * The footer: the two live controls the rail also carries, plus the one way out of the sandbox.
 * Pinned to the bottom of the desktop panel, scrolled with everything else in the drawer.
 */
export function WardSidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className={styles.footer}>
      {/* The role switcher and the demo clock are mounted here exactly as the rail mounts them —
          same components, same behaviour. The clock is not a destination and never navigates. */}
      <div className={styles.footerControls}>
        <WardRoleSwitcher />
        <WardDemoControls />
        <span className={styles.guest} aria-label="Guest workspace">
          G
        </span>
      </div>
      {/* The single way out of the sandbox. */}
      <Link href={WARD_DEVELOPER_HUB_HREF} className={styles.link} onClick={onNavigate}>
        <LayoutGrid aria-hidden="true" />
        <span className={styles.linkLabel}>Back to the developer hub</span>
      </Link>
    </div>
  );
}

function WardSidebarGroup({
  label,
  items,
  counts,
  onNavigate,
}: {
  label: string;
  items: readonly WardNavItem[];
  counts: WardNavCounts;
  onNavigate?: () => void;
}) {
  return (
    <nav className={styles.group} aria-label={`Ward Flow ${label.toLowerCase()}`}>
      <span className={styles.groupLabel}>{label}</span>
      {items.map((item) => {
        const Icon = WARD_NAV_ICONS[item.id];
        const count = counts[item.id];
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            aria-label={count === undefined ? undefined : wardNavCountLabel(item.label, count)}
            className={styles.link}
          >
            <Icon aria-hidden="true" />
            <span className={styles.linkLabel}>{item.label}</span>
            {/* D10: this href names one arbitrary synthetic instance, not a section of the app.
                The icon rail can only say so in an aria-label; a labelled row can show it. */}
            {item.exampleOnly ? <span className={styles.exampleTag}>example</span> : null}
            <WardNavCountChip count={count} />
          </Link>
        );
      })}
    </nav>
  );
}
