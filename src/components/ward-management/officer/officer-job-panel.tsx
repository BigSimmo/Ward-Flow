"use client";

// The job side panel (a sheet on phone), split out of `officer-screen.tsx` with the Transport mock-up
// (Josh, 1 Nov 2026): a scrolling body and one pinned foot at every width, so the next step never
// scrolls away.

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import { DrawerFootRow, Icon, PanelDrawer, StatusGlyph, StatusPill, buttonClass } from "@/components/wf";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { transportLeg } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { UMRN_NOT_SHOWN } from "@/components/ward-management/ward-patient-resolver";

import { renderDetail, renderPhoneNextStep, type OfficerJobDetailContext } from "./officer-job-detail";
import { PACK_SLOTS } from "./officer-forms-pack";
import { LEG_TONE, officerLeg } from "./officer-screen-helpers";
import styles from "./officer.module.css";

/**
 * On a larger screen the open panel fills the screen below where it starts, so its pinned foot is in
 * view as in the Transport mock-up. Measured when the panel opens and on resize only, never on scroll:
 * a scroll-driven resize kept the pinned step moving under a click.
 */
export function useOfficerPanelHeight(testId: string, isPhone: boolean, key: string) {
  useEffect(() => {
    if (isPhone) return;
    const fit = () => {
      const side = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.parentElement;
      if (!side) return;
      const bar = parseFloat(getComputedStyle(side).top) || 68;
      const top = Math.max(bar, side.getBoundingClientRect().top);
      side.style.setProperty("--officer-panel-h", `${Math.max(320, window.innerHeight - top - 16)}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [testId, isPhone, key]);
}

/** "2 forms missing", in a job row's Stage cell while the Forms column is folded away; nothing when complete. */
export function formsMissingNote(forms: number) {
  const missing = PACK_SLOTS.length - forms;
  if (missing <= 0) return null;
  return (
    <span className={styles.stageForms}>
      <StatusGlyph tone="warning" size={8} />
      {missing} {missing === 1 ? "form" : "forms"} missing
    </span>
  );
}

type OfficerJobPanelProps = {
  job: Movement & { transport: NonNullable<Movement["transport"]> };
  name: string;
  umrn: string | undefined;
  /** R-MOVE-5: the date of birth, the officer's second identifier beside the name. */
  dob?: string;
  context: OfficerJobDetailContext;
  tools: ReactNode;
  onClose: () => void;
};

export function OfficerJobPanel({ job, name, umrn, dob, context, tools, onClose }: OfficerJobPanelProps) {
  const transport = job.transport;
  const leg = officerLeg(transport) ?? "Requested";
  const detail = renderDetail(job, context);
  if (!detail) return null;
  const { tabs, panel } = detail;
  // Drawer review (6 Nov 2026): the job opens in the kit drawer at every width, as Home and
  // Capacity do, so the jobs list keeps the page's one scroll and the panel never scrolls inside it.
  // One short subtitle (date of birth, UMRN and escort); the legal status leads the Details list.
  // R-MOVE-5 (Josh, 14 Nov 2026): this desk is not shown the UMRN, and says so.
  const subtitle = [
    dob ? <span key="dob">DOB {dob}</span> : null,
    umrn ? (
      <span key="umrn" className={styles.mono}>
        {umrn}
      </span>
    ) : (
      <span key="umrn">{UMRN_NOT_SHOWN}</span>
    ),
    transport.escortRequired ? <span key="escort">Escort</span> : null,
  ]
    .filter(Boolean)
    .flatMap((part, index) =>
      index === 0
        ? [part]
        : [
            <span key={`dot-${index}`} aria-hidden="true">
              ·
            </span>,
            part,
          ],
    );
  return (
    <PanelDrawer
      open
      onClose={onClose}
      title={name}
      titleId="ward-officer-detail-heading"
      subtitle={<span className={styles.drawerSubtitle}>{subtitle}</span>}
      tag={<StatusPill tone={LEG_TONE[leg]}>{transportLeg(transport)}</StatusPill>}
      closeLabel="Close job panel"
      tabs={tabs}
      tab={context.detailTab}
      onTabChange={context.setDetailTab}
      tabsLabel="Job details"
      testId="ward-officer-detail"
      className={styles.jobDrawer}
      bodyClassName={styles.jobDrawerBody}
      foot={
        <>
          {renderPhoneNextStep(job, context)}
          <DrawerFootRow className={styles.jobDrawerTools}>
            {tools}
            {/* TR2 (3 Nov 2026): the full record, one tap from the job. */}
            <Link
              className={buttonClass({ variant: "sec" })}
              href={movementHref(job.id)}
              data-testid={`ward-officer-record-${job.id}`}
            >
              <Icon icon={FileText} size={16} />
              Movement record
            </Link>
          </DrawerFootRow>
        </>
      }
    >
      {panel}
    </PanelDrawer>
  );
}
