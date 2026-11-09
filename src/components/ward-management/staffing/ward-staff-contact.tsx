"use client";

import dynamic from "next/dynamic";
import { Phone, UserPlus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/wf";
import { useEffectiveWardAccess, useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import type { Unit } from "@/components/ward-management/ward-model";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

import { openStaffRequestFor, staffRequestTagText, type StaffRequestRecord } from "./staff-requests";
import styles from "./staffing.module.css";

// Loaded on first open, so the ward page's first download does not grow.
const StaffNeededSheet = dynamic(() => import("./staff-needed-sheet").then((m) => m.StaffNeededSheet), {
  ssr: false,
});
const WardContactSheet = dynamic(() => import("../on-call/ward-contact-sheet").then((m) => m.WardContactSheet), {
  ssr: false,
});

const NONE: StaffRequestRecord[] = [];

/** The open request's tag with its close actions. Nothing here changes a bed figure. */
function StaffRequestTag({
  record,
  now,
  arrange,
  withdraw,
  compact = false,
}: {
  record: StaffRequestRecord;
  now: Instant;
  /** Phone: drops "this shift" so the words and both actions fit one line at 390 px. */
  compact?: boolean;
  arrange: (() => void) | null;
  withdraw: (() => void) | null;
}) {
  return (
    <span className={styles.tag} data-testid="ward-staff-request-tag">
      <span className={styles.tagText}>
        {compact
          ? staffRequestTagText(record, now).replace(/ · (this|next) shift$/u, "")
          : staffRequestTagText(record, now)}
      </span>
      <span className={styles.tagActions}>
        {arrange ? (
          <button type="button" className={styles.tagAction} onClick={arrange}>
            Arranged
          </button>
        ) : null}
        {withdraw ? (
          <button type="button" className={styles.tagAction} onClick={withdraw}>
            Withdraw
          </button>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The ward hero's Staff needed (feature 10) and Contact (feature 32) actions, and the open staff
 * request's tag. A ward asks as itself; the coordinator or site bed manager records it arranged.
 */
export function WardStaffContact({
  unit,
  now,
  isPhone,
  part = "all",
  children,
}: {
  unit: Unit;
  now: Instant;
  isPhone: boolean;
  /** The desktop hero shows the buttons beside Confirm numbers and the tag under the ward's facts. */
  part?: "all" | "buttons" | "tag";
  /** With `part="tag"`: what sits under the tag (the hero's capacity time). */
  children?: ReactNode;
}) {
  const flow = useOptionalWardFlowSelect("staffRequests", "dispatch");
  const routeRole = useRouteRole();
  const accessRole = useEffectiveWardAccess().role;
  // A coordinator previewing another desk sees the request but changes nothing.
  const previewing = useWardAccessSnapshot().previewOf !== null;
  const asker: WardFlowRole = routeRole === "bed_manager" ? "bed_manager" : "ward";
  const closer: WardFlowRole | null =
    !previewing && (accessRole === "coordinator" || accessRole === "bed_manager") ? accessRole : null;
  const raise = useWardRaise(asker);
  const raiseClose = useWardRaise(closer ?? asker);
  const [sheet, setSheet] = useState<"staff" | "contact" | null>(null);
  const staffRef = useRef<HTMLButtonElement | null>(null);
  const contactRef = useRef<HTMLButtonElement | null>(null);
  const records = flow?.staffRequests ?? NONE;
  const open = openStaffRequestFor(records, unit.id, now);
  // Only the ward desk (or the site bed manager on its own ward) asks from here; never the executive.
  const canAsk = flow !== null && !previewing && (routeRole === "ward" || routeRole === "bed_manager");
  const acting = asker === "ward" ? { actingUnitId: unit.id } : {};
  const tag = open ? (
    <StaffRequestTag
      record={open}
      now={now}
      compact={isPhone}
      arrange={
        closer
          ? () =>
              void raiseClose("CLOSE_WARD_STAFF_REQUEST", { requestId: open.id, unitId: unit.id, outcome: "arranged" })
          : null
      }
      withdraw={
        canAsk
          ? () =>
              void raise("CLOSE_WARD_STAFF_REQUEST", {
                requestId: open.id,
                unitId: unit.id,
                ...acting,
                outcome: "withdrawn",
              })
          : null
      }
    />
  ) : null;
  const staffLabel = "Staff needed";
  const buttons = isPhone ? (
    <>
      <button
        ref={contactRef}
        type="button"
        className={styles.phoneAction}
        onClick={() => setSheet("contact")}
        data-testid="ward-contact-open"
      >
        <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
        Contact
      </button>
      {canAsk ? (
        <button
          ref={staffRef}
          type="button"
          className={styles.phoneAction}
          onClick={() => setSheet("staff")}
          data-testid="ward-staff-needed-open"
        >
          <UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />
          {staffLabel}
        </button>
      ) : null}
    </>
  ) : (
    <>
      <Button
        ref={contactRef}
        variant="onHero"
        size="sm"
        icon={Phone}
        onClick={() => setSheet("contact")}
        data-testid="ward-contact-open"
      >
        Contact
      </Button>
      {canAsk ? (
        <Button
          ref={staffRef}
          variant="onHero"
          size="sm"
          icon={UserPlus}
          onClick={() => setSheet("staff")}
          data-testid="ward-staff-needed-open"
        >
          {staffLabel}
        </Button>
      ) : null}
    </>
  );
  if (part === "tag")
    return tag ? (
      <span className={styles.footStack}>
        {tag}
        {children}
      </span>
    ) : (
      <>{children}</>
    );
  return (
    <>
      <span className={isPhone ? styles.phoneRow : styles.actions}>
        {buttons}
        {part === "all" ? tag : null}
      </span>
      {sheet === "staff" ? (
        <StaffNeededSheet
          open
          onClose={() => setSheet(null)}
          unitId={unit.id}
          unitName={unit.name}
          now={now}
          records={records}
          raise={raise}
          actingUnitId={asker === "ward" ? unit.id : undefined}
          returnFocusRef={staffRef}
        />
      ) : null}
      {sheet === "contact" ? (
        <WardContactSheet open onClose={() => setSheet(null)} unitId={unit.id} now={now} returnFocusRef={contactRef} />
      ) : null}
    </>
  );
}
