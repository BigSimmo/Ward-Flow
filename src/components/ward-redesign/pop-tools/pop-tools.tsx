"use client";

import { Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useIsPhone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { useDeskRoleLabel } from "@/components/ward-management/shell/ward-access-store";
import { openReferralSheet, openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";

import { ToolsSheet } from "./tools-sheet";

/**
 * The Tools mock-up, drawn over its page. `page` is the page it opens over.
 *
 * The same Sheet the app bar's wrench opens, with the body forked to `tools-sheet.tsx`: three
 * groups under a search box, and each row's end says whether it opens a page or opens here.
 */
export function PopTools({ page }: { page: ReactNode }) {
  const isPhone = useIsPhone();
  const now = useWardFlowClock();
  const { role } = useWardNavCounts();
  const deskRoleLabel = useDeskRoleLabel(role);
  const [open, setOpen] = useState(true);

  return (
    <>
      {page}
      <Sheet
        id="pop-tools-drawer"
        open={open}
        onClose={() => setOpen(false)}
        title="Tools"
        headerLeading={
          <span className={barStyles.drawerTile} aria-hidden="true">
            <Wrench aria-hidden="true" className={barStyles.drawerHeadingIcon} strokeWidth={1.75} />
          </span>
        }
        headerActions={
          <kbd className={barStyles.escKbd} aria-hidden="true">
            Esc
          </kbd>
        }
        descriptionContent={
          <p className={barStyles.activityFreshness}>Quick actions and look ups for the whole network</p>
        }
        placement="right"
        testId="pop-tools-sheet"
        desktopBackdropClassName={barStyles.drawerBackdrop}
        contentClassName={`${barStyles.drawerSheet} ${barStyles.drawerSheetWide}`}
        headerClassName={barStyles.drawerHeader}
        titleClassName={barStyles.drawerTitle}
        closeButtonClassName={barStyles.drawerClose}
        bodyClassName={barStyles.drawerBody}
        footer={
          <div className={barStyles.drawerFoot}>
            <span>Whole network · synthetic prototype</span>
            <span className={barStyles.footClock}>
              Demo time <b>{formatInstant(now)}</b>
            </span>
          </div>
        }
        footerClassName={barStyles.drawerFooter}
      >
        <ToolsSheet
          isPhone={isPhone}
          roleLabel={deskRoleLabel}
          onNavigate={() => setOpen(false)}
          onNewReferral={(destination = "ward") => {
            setOpen(false);
            // The app bar opens its own referral slide-out, as the real Tools sheet asks it to.
            if (destination === "community") openReferralSheet(raiseReferralHref({ refer: "community" }));
            else openWardDrawer("referral");
          }}
        />
      </Sheet>
    </>
  );
}
