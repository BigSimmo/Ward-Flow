"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardChromeSearch } from "@/components/ward-management/ward-chrome-search";
import { WardStatsPanel, WardStatsToggle, standingFigures } from "@/components/ward-management/ward-standing-strip";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { serviceRollup, wardsConfirmedLabel } from "@/components/ward-management/ward-morning-rollup";
import { wardSites } from "@/components/ward-management/ward-sites";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";

import styles from "./ward-chrome-header.module.css";

/**
 * The board-freshness sentence, from `rollupFreshness`'s own three-arm union
 * (`ward-morning-rollup.ts`).
 *
 * 🔴 **NEVER "TODAY".** `rollupFreshness` reports whether a unit's allocatable count has EVER been
 * confirmed — there is no day-boundary comparison anywhere in that derivation (`operatingDayStart`
 * exists in the same file and is never composed with it). Wording this as "confirmed today" would
 * be a claim about a timeframe the number does not carry.
 *
 * ⚠️ **`"never"` HAS NO COUNTS, AND THAT IS WHY THIS FUNCTION EXISTS RATHER THAN A TEMPLATE
 * LITERAL AT THE CALL SITE.** `RollupFreshness` is a union; only the `"confirmed"`/`"partial"` arms
 * carry `unitsConfirmed`/`unitsTotal`. Reading those fields off the `"never"` arm would be a type
 * error, which is the compiler enforcing the same rule this comment states in words: a rollup that
 * has never been confirmed is not "0 of 0" wards, it is no wards reported at all.
 *
 * ⚠️ **EXPORTED FOR ITS OWN UNIT TEST, DELIBERATELY, BEYOND THE RENDER-LEVEL PROOF.** Measured
 * 2026-09-07: on `NOW_ANCHOR`'s own seed the service rollup is `{ unitsConfirmed: 23, unitsTotal:
 * 23 }` — every ward has confirmed, so `unitsConfirmed` and `unitsTotal` are numerically equal and
 * a mutation swapping one for the other renders an IDENTICAL string on that seed. A render test
 * against the seed alone could not catch that swap despite passing every line of this brief's own
 * checklist. `tests/ward-chrome-header-actions.dom.test.tsx` covers the render/wiring path against
 * the seed AND calls this function directly with a synthetic `"partial"` input whose two counts
 * differ, which is what actually exercises the two fields independently.
 */

/**
 * The one action this header changes with the role standing on the route — never a fourth event
 * type dispatched from the chrome.
 *
 * 🔴 **A LINK IN ALL THREE ROLES, NEVER A DISPATCH.** `ward-flow-events.ts`'s `EVENT_ROLE` table
 * permits `RAISE_REFERRAL` for `ed`/`community`/`ward` and `RECEIVE_REFERRAL` for `community`
 * alone — a coordinator is in neither list, and `referral-intake.tsx` hard-codes `role:
 * "community"` on its own `RECEIVE_REFERRAL` dispatch. A header button that dispatched an event
 * here would either attribute the act to a role that never performed it, or need `EVENT_ROLE`
 * widened — an owner decision, not this component's to make. So every role gets a destination,
 * never an event.
 */
function roleAction(role: WardChromeRole): { href: string; label: string } {
  if (role === "ward") return { href: "/mockups/ward-flow/movements", label: "Answer bed offers" };
  if (role === "ed") return { href: WARD_REFERRAL_INTAKE_HREF, label: "New referral" };
  return { href: "/mockups/ward-flow/referrals", label: "Referrals" };
}

/**
 * **ONE HEADER ROW, AND EVERYTHING IN THE CHROME HANGS OFF IT.**
 *
 * Owner's change, 2026-09-07: *"have the figure toggle in the top part of the header"*. Before this
 * the chrome was four siblings stacked down the page — the place name, the search box, the figures
 * toggle and the tasks button each on their own line — which read as four bars rather than one
 * header, and spent four rows of vertical space saying so.
 *
 * ⚠️ **THE STATE HAD TO COME UP HERE FOR THAT TO BE POSSIBLE.** The toggle sits in the row and the
 * panel it opens sits BELOW the row, so no single component can own both and still be laid out as
 * one line. This component owns the open/closed state for both the figures panel and the tasks
 * drawer, and hands each half down. That is the only reason it exists — it holds no data of its own
 * and derives nothing a screen could not derive.
 *
 * ⚠️ **STICKY LIVES HERE NOW, ON THE WHOLE HEADER.** A sticky element pins to its nearest
 * scrollport; this is mounted in the ward LAYOUT, a sibling of `{children}`, so its scrollport is
 * the window. **Anything sticky one level down would be inside a ward screen's `.main`, which 24
 * ward stylesheets declare as `overflow-y: auto` inside a `min-height` grid — a scrollport that can
 * never scroll**, where sticky applies, computes correctly and silently never moves.
 */
export function WardChromeHeader() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { movements, units, admissions, bedReleases, leaveBeds, dispatch, inboxAcknowledgements, inboxCompletions } =
    useWardFlow();
  const now = useWardFlowClock();

  const [figuresOpen, setFiguresOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);

  const chromeRole = wardChromeRole(pathname);
  const figures = standingFigures({
    movements,
    units,
    admissions,
    bedReleases,
    leaveBeds,
    now,
    chromeRole,
    placeId: /\/(?:ward|board|ed)\/([^/]+)/u.exec(pathname)?.[1],
  });

  const tasks = useMemo(() => buildActionInbox(movements.filter(isOpen), now, units), [movements, now, units]);
  const openMovement = useCallback(
    (movementId: string) => router.push(`/mockups/ward-flow/movements/${movementId}`),
    [router],
  );

  /*
   * ⚠️ **THE SAME `serviceRollup` CALL EVERY SIBLING SURFACE MAKES** (`ward-standing-strip.tsx`,
   * `tests/ward-sidebar.dom.test.tsx`) — `wardSites` for grouping/display, the live `units` from
   * context for the figures, never the units embedded in `wardSites` itself (see that file's own
   * doc comment on why the two must not be conflated). Spread into new arrays for the same reason
   * `ward-standing-strip.tsx` does: this derivation must never share a reference with reducer state
   * it does not own.
   */
  const rollup = serviceRollup(wardSites, units, [...bedReleases], [...leaveBeds], now);
  const action = roleAction(chromeRole);

  return (
    <>
      {/*
       * ⚠️ **A REAL `<header>`, ADDED 2026-09-07 — IT WAS A BARE `<div>` UNTIL A BROWSER AUDIT
       * COUNTED THIS ROW REACHABLE ONLY BY TABBING, IN NO LANDMARK AT ALL.** `layout.tsx`'s own doc
       * comment used to argue against this on print grounds — that `globals.css` hides `header` under
       * `@media print`, so wrapping this row in one would hide it regardless of the toggle state below.
       * That argument is moot: `.bar { display: none }` under `@media print` (this file's own
       * stylesheet) already hides the row unconditionally, tag or no tag, so the global `header`
       * print rule now hides nothing this rule was not already hiding.
       */}
      <header className={styles.bar} data-testid="ward-chrome-header" data-chrome-role={chromeRole}>
        <WardChromeSearch />
        <WardStatsToggle figures={figures} open={figuresOpen} onToggle={() => setFiguresOpen(!figuresOpen)} />
        {/*
         * ⚠️ **THE TASKS COUNT IS NOT A BADGE.** A bare number beside a label reads as "new since
         * you last looked"; every row behind this control is a standing clinical or legal fact that
         * leaves when the fact resolves, never when somebody glances at it. So the control says what
         * the number means, in words.
         */}
        <button
          type="button"
          className={styles.tasks}
          aria-expanded={tasksOpen}
          onClick={() => setTasksOpen(!tasksOpen)}
          data-testid="ward-tasks-opener"
        >
          Tasks
          <span className={styles.tasksCount}>{tasks.length}</span>
          <span className={styles.tasksNote}>{tasks.length === 1 ? "needs attention" : "need attention"}</span>
        </button>
        <Link href="/mockups/ward-flow/handover" className={styles.handover} data-testid="ward-chrome-handover">
          Handover
        </Link>
        {/*
         * ⚠️ **INFORMATIONAL, NEVER AN ALARM.** Unlike the tasks/figures controls above, staleness
         * here carries no clinical or legal urgency of its own — it says how much of the network has
         * ever confirmed its bed numbers, nothing more — so it is the one addition allowed to
         * disappear outright at phone width rather than losing only its explanatory half.
         */}
        <span className={styles.freshness} data-testid="ward-chrome-freshness">
          {wardsConfirmedLabel(rollup.service.freshness)}
        </span>
        <Link href={action.href} className={styles.action} data-testid="ward-chrome-action">
          {action.label}
        </Link>
      </header>

      <WardStatsPanel figures={figures} open={figuresOpen} />

      {tasksOpen ? (
        <WardTasksDrawer
          items={tasks}
          acknowledgements={inboxAcknowledgements}
          completions={inboxCompletions}
          role="coordinator"
          now={now}
          dispatch={dispatch}
          onClose={() => setTasksOpen(false)}
          onSelectMovement={openMovement}
        />
      ) : null}
    </>
  );
}
