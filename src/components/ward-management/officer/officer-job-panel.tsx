"use client";

// The job side panel (a sheet on phone), split out of `officer-screen.tsx` with the Transport mock-up
// (Josh, 1 Nov 2026): a scrolling body and one pinned foot at every width, so the next step never
// scrolls away.

import { useEffect, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";

import { Button, Card, CardBody, CardFoot, CardHead, StatusGlyph, cx } from "@/components/wf";
import { transportLeg } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

import { renderDetail, renderPhoneNextStep, type OfficerJobDetailContext } from "./officer-job-detail";
import { PACK_SLOTS } from "./officer-forms-pack";
import { LEG_TONE, officerLeg, transportLegalStatusLabel } from "./officer-screen-helpers";
import styles from "./officer.module.css";

/** On a larger screen the open panel fills the screen below where it starts, so its foot stays in view. */
export function useOfficerPanelHeight(
  sideRef: RefObject<HTMLDivElement | null>,
  open: boolean,
  isPhone: boolean,
  key: string | undefined,
) {
  useEffect(() => {
    if (!open || isPhone) return;
    const fit = () => {
      const side = sideRef.current;
      if (!side) return;
      const bar = parseFloat(getComputedStyle(side).top) || 68;
      const top = Math.max(bar, side.getBoundingClientRect().top);
      side.style.setProperty("--officer-panel-h", `${Math.max(320, window.innerHeight - top - 16)}px`);
    };
    fit();
    window.addEventListener("scroll", fit, { capture: true, passive: true });
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("scroll", fit, { capture: true });
      window.removeEventListener("resize", fit);
    };
  }, [sideRef, open, isPhone, key]);
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
  isPhone: boolean;
  name: string;
  umrn: string | undefined;
  origin: string;
  destination: string;
  context: OfficerJobDetailContext;
  tools: ReactNode;
  onClose: () => void;
};

export function OfficerJobPanel({
  job,
  isPhone,
  name,
  umrn,
  origin,
  destination,
  context,
  tools,
  onClose,
}: OfficerJobPanelProps) {
  const transport = job.transport;
  const legal = transportLegalStatusLabel(transport);
  return (
    <Card
      className={styles.detail}
      role={isPhone ? "dialog" : undefined}
      aria-modal={isPhone ? true : undefined}
      aria-labelledby="ward-officer-detail-heading"
      data-testid="ward-officer-detail"
    >
      <span className={styles.grab} aria-hidden="true" />
      <CardHead
        id="ward-officer-detail-heading"
        className={styles.detailHead}
        title={
          <span className={styles.detailTitle}>
            {name}
            <span className={styles.detailTag}>
              <StatusGlyph tone={LEG_TONE[officerLeg(transport) ?? "Requested"]} size={9} />
              {transportLeg(transport)}
            </span>
          </span>
        }
        meta={
          <>
            {/* The UMRN is withheld on some desks; no stray " · " is left in its place. */}
            {umrn ? <span className={styles.mono}>{umrn}</span> : null}
            {isPhone ? (
              <>
                {umrn ? " · " : null}
                {origin} to {destination}
                {transport.escortRequired ? " · Escort" : ""}
              </>
            ) : (
              <>
                {umrn ? " · " : null}
                {/* Redesign: a bare "Not recorded" names no noun. */}
                {legal === "Not recorded" ? "Legal status not recorded" : legal}
                {transport.escortRequired ? " · Escort" : ""}
              </>
            )}
          </>
        }
        aside={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            onClick={onClose}
            aria-label="Close job panel"
            data-testid="ward-officer-detail-close"
          />
        }
      />
      <CardBody className={cx(styles.detailBody, styles.detailScroll)}>{renderDetail(job, context)}</CardBody>
      {/* One pinned foot at every width: Inspect form and Divert, then the one next step as the primary. */}
      <CardFoot className={cx(styles.detailFooter, styles.detailFoot)}>
        <span className={styles.footTools}>{tools}</span>
        {renderPhoneNextStep(job, context)}
      </CardFoot>
    </Card>
  );
}
