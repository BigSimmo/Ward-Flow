"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps, type ComponentType } from "react";

import { Button, Drawer, StatusGlyph } from "@/components/wf";

import { withLoadRetry } from "../load-retry";
import retryStyles from "../load-retry.module.css";
import { preloadWhenIdle } from "../preload-when-idle";
import { isReferralSheetPath } from "./ward-bar-model";

/**
 * F-10 (phone review, October 2026): the header's Referrals and Tasks drawers only draw while they
 * are open, but static imports put their code (about 120 KB, most of it the referral form) in the
 * shared chunk every Ward Flow page downloads and runs before it can respond. `WardBar` imports them
 * from here instead, so their code loads on its own and the first load stays smaller.
 *
 * Both are fetched once the page has loaded and the browser is idle, so a tap normally finds the
 * code already there. The tasks close button carries `data-sheet-autofocus`, so the Sheet still
 * moves focus to it if the code arrives after the tap.
 */
const loadReferralDrawer = () => import("@/components/ward-management/referrals/ward-referral-drawer");
const loadTasksDrawer = () => import("@/components/ward-management/ward-tasks-drawer");
// One Activity panel everywhere (Josh, Q99, 1 Nov 2026): Home's panel, drawn by the bar on every
// page. It brings the activity feed and the changes review with it, so it stays out of the first load.
const loadActivityPanel = () => import("@/components/ward-management/coordinator/activity-panel");
type ActivityPanelProps = ComponentProps<
  (typeof import("@/components/ward-management/coordinator/activity-panel"))["ActivityPanel"]
>;

// Offline (22 Oct 2026): a failed fetch shows Try again and Close instead of crashing the page.
export const WardReferralDrawer = dynamic(
  withLoadRetry(() => loadReferralDrawer().then((m) => m.WardReferralDrawer), "Referrals did not load"),
);
export const WardTasksDrawer = dynamic(
  withLoadRetry(() => loadTasksDrawer().then((m) => m.WardTasksDrawer), "Tasks and alerts did not load"),
);

export const ActivityPanel = dynamic(() =>
  loadActivityPanel().then(
    (m) => m.ActivityPanel,
    () => ActivityPanelRetry,
  ),
);

/**
 * Offline (as `withLoadRetry`): the panel is its own drawer, so a failed fetch opens a drawer with
 * one error line and Try again, which draws the real panel once its code arrives.
 */
function ActivityPanelRetry(props: ActivityPanelProps) {
  const [Panel, setPanel] = useState<ComponentType<ActivityPanelProps> | null>(null);
  if (Panel) return <Panel {...props} />;
  return (
    <Drawer
      id={props.id}
      open={props.open}
      onClose={props.onClose}
      title="Activity"
      testId={props.testId}
      returnFocusRef={props.returnFocusRef}
    >
      <div className={retryStyles.retry} role="alert" data-testid="ward-load-retry">
        <p>
          <StatusGlyph tone="danger" />
          <strong>Activity did not load.</strong> <span>Check the connection, then try again.</span>
        </p>
        <Button
          variant="sec"
          size="lg"
          onClick={() =>
            loadActivityPanel().then(
              (m) => setPanel(() => m.ActivityPanel),
              () => {},
            )
          }
        >
          Try again
        </Button>
      </div>
    </Drawer>
  );
}

// DA-13: on the new-referral route the form opens as soon as the page can respond, so its code
// is fetched while the page is still starting instead of after it, when the drawer asks for it.
if (typeof window !== "undefined" && isReferralSheetPath(window.location.pathname))
  void loadReferralDrawer().catch(() => undefined);

preloadWhenIdle(loadReferralDrawer, loadTasksDrawer, loadActivityPanel);
