"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, RotateCcwClock } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { useIsPhone } from "@/components/wf";
import { Sheet } from "@/components/wf/sheet";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useWardChecks } from "@/components/ward-management/shell/ward-checks";
import { useWardBarActivity } from "@/components/ward-management/shell/ward-bar-state";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import type { WardActivityEventTone } from "@/components/ward-management/shell/ward-command-activity";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";

import { ActivityBody, type ActivityPerson } from "./activity-body";
import local from "./activity.module.css";

const UMRN_PATTERN = /UM\d{6}/u;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The Activity mock-up, drawn over its page. `page` is the page it opens over.
 *
 * The same Sheet, feed and filters the app bar's Activity button opens (`WardBar`'s Activity sheet
 * and `useWardBarActivity`), with the body forked to `activity-body.tsx`: each row leads with the
 * person's name (surname first), then what happened, and the footer links to Alerts history.
 */
export function PopActivity({ page }: { page: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPhone = useIsPhone();
  const now = useWardFlowClock();
  const data = useWardFlowSelect(
    "movements",
    "patients",
    "units",
    "referrals",
    "rejections",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "refreshRequests",
    "notices",
    "dispatch",
  );
  const { role, placeId } = useWardNavCounts();
  const service = useServiceScope();
  const checksPublication = useWardChecks();
  const publishedChecks = checksPublication.published ? checksPublication.checks : [];
  const reconciledCheckCount = publishedChecks.filter((check) => check.ok).length;
  const activity = useWardBarActivity({ activity: undefined, pathname, role, placeId, now, ...data });
  const [open, setOpen] = useState(true);

  // Redesign: the feed names people by UMRN; the row now leads with the name the UMRN belongs to.
  const { patients } = data;
  const nameByUmrn = useMemo(() => {
    const names = new Map<string, string>();
    for (const patient of patients)
      names.set(patient.umrn, resolveSubjectPatient({ patientId: patient.id }, { patients }).formalName);
    return names;
  }, [patients]);
  const personOf = useCallback(
    (text: string): ActivityPerson | undefined => {
      const umrn = UMRN_PATTERN.exec(text)?.[0];
      const name = umrn ? nameByUmrn.get(umrn) : undefined;
      if (!umrn || !name) return undefined;
      const rest = text.startsWith(`${umrn}: `)
        ? text.slice(umrn.length + 2)
        : text.startsWith(`${umrn} `)
          ? capitalise(text.slice(umrn.length + 1))
          : // The name leads the row, so the number is not repeated mid-line ("BTY declined.").
            text.replaceAll(` on ${umrn}`, "").replaceAll(` ${umrn}`, "");
      return { name, umrn, rest };
    },
    [nameByUmrn],
  );

  const activityTone: "good" | "neutral" =
    activity.shownActivity || activity.scopedNotices.length > 0 ? "good" : "neutral";
  const activityToneFor = (id: string): WardActivityEventTone =>
    activity.usesDerivedActivity ? (activity.commandActivity.tones[id] ?? "info") : "info";

  return (
    <>
      {page}
      <Sheet
        id="pop-activity-drawer"
        open={open}
        onClose={() => setOpen(false)}
        title="Activity"
        headerLeading={
          <span className={barStyles.drawerTile} aria-hidden="true">
            <RotateCcwClock aria-hidden="true" className={barStyles.drawerHeadingIcon} strokeWidth={1.75} />
          </span>
        }
        headerActions={
          <kbd className={barStyles.escKbd} aria-hidden="true">
            Esc
          </kbd>
        }
        placement="right"
        testId="pop-activity-sheet"
        {...(isPhone ? { bodyTabIndex: 0, bodyLabel: "Activity list" } : {})}
        descriptionContent={
          isPhone ? (
            <p className={barStyles.activityFreshness} data-tone={activityTone}>
              <span>
                {activity.unreadNoticeCount > 0 ? `${activity.unreadNoticeCount} unread · ` : ""}
                {activity.shownActivity?.changes.length ?? 0} events · newest first
              </span>
            </p>
          ) : (
            <p className={barStyles.activityFreshness} data-tone={activityTone}>
              {/* Redesign: the demo time is the header clock's, so the line says only what the list is. */}
              <span>
                Synthetic events · newest first
                {activity.lastActivityAt === undefined
                  ? " · no recorded event"
                  : ` · last at ${formatInstantWithDay(activity.lastActivityAt, now)}`}
              </span>
            </p>
          )
        }
        desktopBackdropClassName={barStyles.drawerBackdrop}
        contentClassName={`${barStyles.drawerSheet} ${barStyles.drawerSheetWide}`}
        headerClassName={barStyles.drawerHeader}
        titleClassName={barStyles.drawerTitle}
        closeButtonClassName={barStyles.drawerClose}
        bodyClassName={barStyles.drawerBody}
        footer={
          <div className={`${barStyles.drawerFoot} ${local.foot}`}>
            {/* Redesign: "Synthetic events · newest first" moved up into the line under the title. */}
            <span aria-hidden="true" />
            <Link href={WARD_ALERTS_HREF} className={local.footLink} onClick={() => setOpen(false)}>
              Alerts history
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </div>
        }
        footerClassName={barStyles.drawerFooter}
      >
        <ActivityBody
          isPhone={isPhone}
          activityPart={activity.activityPart}
          setActivityPart={activity.setActivityPart}
          shownActivity={activity.shownActivity}
          unreadNoticeCount={activity.unreadNoticeCount}
          now={now}
          activityQuery={activity.activityQuery}
          setActivityQuery={activity.setActivityQuery}
          activityCategoryFilter={activity.activityCategoryFilter}
          setActivityCategoryFilter={activity.setActivityCategoryFilter}
          activityCategoryCounts={activity.activityCategoryCounts}
          scopedNotices={activity.scopedNotices}
          unreadOnly={activity.unreadOnly}
          setUnreadOnly={activity.setUnreadOnly}
          visibleNotices={activity.visibleNotices}
          noticeText={activity.noticeText}
          markNoticeRead={activity.markNoticeRead}
          filteredActivityChanges={activity.filteredActivityChanges}
          service={service}
          activityToneFor={activityToneFor}
          publishedChecks={publishedChecks}
          reconciledCheckCount={reconciledCheckCount}
          usesDerivedActivity={activity.usesDerivedActivity}
          commandActivity={activity.commandActivity}
          closePopover={() => setOpen(false)}
          personOf={personOf}
        />
      </Sheet>
    </>
  );
}
