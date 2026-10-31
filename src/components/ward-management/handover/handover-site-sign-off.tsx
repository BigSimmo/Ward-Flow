"use client";

/**
 * SITE HANDOVER SIGN-OFF SCREEN (Josh, 31 Oct 2026 14:08 UTC, questions 40 and 61 to 63).
 *
 * The site bed manager signs off its own site's handover. Each ward's own sign-off is shown read
 * only, and this screen never signs for a ward. The four checks are information only (Q63), and an
 * unsigned ward never blocks the site's sign-off (Q62). The logic lives in
 * `site-sign-off/site-handover-sign-off.ts`; this file only shows it and sends the two events.
 */
import Link from "next/link";
import { useId } from "react";
import { Check } from "lucide-react";
import { Button, Card, StatusGlyph, buttonClass, cx } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { BED_MEETING_AGENDA_HREF } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import {
  outstandingWardSignOffs,
  siteSignOffChecks,
  siteSignOffFor,
  siteWardSignOffs,
  siteWards,
  type SiteSignOffCheck,
} from "@/components/ward-management/site-sign-off/site-handover-sign-off";
import { defaultHandoverShift, handoverAt, handoverShift } from "./handover-model";
import styles from "./handover-site-sign-off.module.css";

const CAPACITY_HREF = "/ward-flow/capacity";

function roleLabel(role: WardFlowRole): string {
  if (role === "coordinator") return "Bed coordinator";
  if (role === "demo") return "Demo";
  return CHROME_ROLE_LABELS[role];
}

/** "Ward 4B", "Ward 4B and Ward 5C", "Ward 3A, Ward 4B and Ward 5C". */
export function namesInProse(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type CheckRow = {
  id: SiteSignOffCheck["id"];
  title: string;
  detail: string;
  open: boolean;
  href?: string;
  action?: string;
};

/** The four checks, in the helper's order, as the mock-up words them. */
function checkRows(checks: readonly SiteSignOffCheck[], blockedStays: number): CheckRow[] {
  return checks.map((check) => {
    const open = check.open > 0;
    switch (check.id) {
      case "bed_numbers": {
        const of = check.of ?? 0;
        return {
          id: check.id,
          title: "Bed numbers confirmed",
          detail: `${of - check.open} of ${of} ${of === 1 ? "ward" : "wards"}`,
          open,
          ...(open ? { href: CAPACITY_HREF, action: "Confirm beds" } : {}),
        };
      }
      case "discharge_blockers":
        return {
          id: check.id,
          title: "Discharge blockers reviewed",
          detail: open
            ? `${check.open} not reviewed today`
            : blockedStays > 0
              ? `${blockedStays} reviewed today`
              : "None to review",
          open,
        };
      case "bed_meeting_actions":
        return {
          id: check.id,
          title: "Bed meeting actions due today",
          detail: open ? `${check.open} open` : "None open",
          open,
          ...(open ? { href: BED_MEETING_AGENDA_HREF, action: "Open actions" } : {}),
        };
      case "bed_calls":
        return {
          id: check.id,
          title: "Bed calls answered",
          detail: open ? `${check.open} waiting` : "None waiting",
          open,
          ...(open ? { href: WARD_ALERTS_HREF, action: "Reply" } : {}),
        };
    }
  });
}

export function HandoverSiteSignOff({
  siteCode,
  phone,
  onOpenWard,
}: {
  siteCode: string;
  phone: boolean;
  /** Opens one ward's own handover sheet on this page. */
  onOpenWard: (unitId: string) => void;
}) {
  const {
    units,
    admissions,
    bedReleases,
    broadcastAlerts,
    movements,
    handoverSignOffs,
    siteHandoverSignOffs,
    dispatch,
    rejections,
  } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "broadcastAlerts",
    "movements",
    "handoverSignOffs",
    "siteHandoverSignOffs",
    "dispatch",
    "rejections",
  );
  const now = useWardFlowClock();
  const routeRole = useRouteRole();
  const gate = useRoleGate()("RECORD_SITE_HANDOVER_SIGN_OFF");
  const headingId = useId();

  // The site signs the next handover only: the reducer refuses any other.
  const shiftId = defaultHandoverShift(now);
  const shiftAt = handoverAt(shiftId, now);
  const siteName = siteByCode(siteCode)?.name ?? siteCode;
  const wardName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? unitId;

  // The React compiler memoises this component, so the derivations below are plain.
  const wards = siteWardSignOffs(units, handoverSignOffs, siteCode, shiftAt);
  const checks = siteSignOffChecks({ admissions, bedReleases, broadcastAlerts, movements, units }, siteCode, now);
  const siteUnitIds = new Set(siteWards(units, siteCode).map((unit) => unit.id));
  const blockedStays = admissions.filter(
    (stay) => siteUnitIds.has(stay.unitId) && stay.state === "occupied" && stay.blockReason,
  ).length;
  const record = siteSignOffFor(siteHandoverSignOffs, siteCode, shiftAt);
  const outstanding = new Set(record ? outstandingWardSignOffs(record, handoverSignOffs) : []);
  const rows = checkRows(checks, blockedStays);
  const openCount = rows.filter((row) => row.open).length;

  const { run: runStep } = useUndoableStep({ dispatch, rejections, now, routeRole, onMessage: announceToWardShell });
  const signOff = () => {
    if (!gate.allowed) return;
    runStep(
      { type: "RECORD_SITE_HANDOVER_SIGN_OFF", role: routeRole, now, siteCode, shiftAt },
      {
        success: "Site handover signed off.",
        undo: (at) => ({ type: "UNDO_SITE_HANDOVER_SIGN_OFF", role: routeRole, now: at, siteCode }),
        undone: "Site sign-off undone.",
      },
    );
  };
  const undoSignOff = () =>
    runStep(
      { type: "UNDO_SITE_HANDOVER_SIGN_OFF", role: routeRole, now, siteCode },
      { success: "Site sign-off undone." },
    );

  const unsignedNames = record ? record.unsignedUnitIds.map(wardName) : [];
  const bedCallTitles = (record?.unansweredBedCallIds ?? [])
    .map((id) => broadcastAlerts.find((alert) => alert.id === id)?.title)
    .filter((title): title is string => Boolean(title));

  return (
    <section
      className={cx(styles.site, phone && styles.phone)}
      aria-labelledby={headingId}
      data-testid="ward-handover-site-sign-off"
    >
      <div className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          Site handover · {siteName}
        </h2>
        <p className={styles.sub}>
          Site bed manager · {handoverShift(shiftId).label} · {formatInstantWithDay(shiftAt, now)}
        </p>
      </div>
      <div className={styles.cols}>
        <Card className={styles.card} aria-label="Ward sign-offs">
          <header className={styles.cardHead}>
            <h3>Ward sign-offs</h3>
            <small>Read only · each ward signs its own</small>
          </header>
          <ul className={styles.list} data-testid="ward-handover-site-wards">
            {wards.map((ward) => {
              const signed = ward.signedAt !== null;
              const name = wardName(ward.unitId);
              return (
                <li key={ward.unitId} className={styles.row}>
                  <span className={styles.lead}>
                    <b>
                      <StatusGlyph tone={signed ? "success" : "neutral"} size={9} /> {name}
                    </b>
                    <span>
                      {ward.signedAt !== null && ward.signedBy !== null
                        ? `Signed ${formatInstantWithDay(ward.signedAt, now)} by ${roleLabel(ward.signedBy)}`
                        : outstanding.has(ward.unitId)
                          ? "Not signed yet · outstanding"
                          : "Not signed yet"}
                    </span>
                  </span>
                  <Button
                    onClick={() => onOpenWard(ward.unitId)}
                    aria-label={`${signed ? "View" : "Open"} ${name} handover`}
                  >
                    {signed ? "View" : "Open handover"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className={styles.card} aria-label="Site sign-off">
          <header className={styles.cardHead}>
            <h3>Site sign-off</h3>
            <small>{siteName}</small>
          </header>
          <p className={styles.group}>Before you sign</p>
          <ul className={styles.list} data-testid="ward-handover-site-checks">
            {rows.map((row) => (
              <li key={row.id} className={styles.row} data-open={row.open ? "true" : "false"}>
                <span className={styles.lead}>
                  <b>
                    <StatusGlyph tone={row.open ? "neutral" : "success"} size={9} /> {row.title}
                  </b>
                  <span>{row.detail}</span>
                </span>
                {row.href && row.action ? (
                  <Link href={row.href} className={buttonClass({ variant: "sec" })}>
                    {row.action}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          <p className={styles.group}>Handed over by</p>
          <div className={styles.row}>
            <span className={styles.lead}>
              <b>Site bed manager</b>
              <span>you</span>
            </span>
          </div>
          {record ? (
            <p className={styles.status} role="status" data-testid="ward-handover-site-signed">
              <StatusGlyph tone="success" size={9} /> Signed off at {formatInstantWithDay(record.at, now)} as{" "}
              {roleLabel(record.by).toLowerCase()}.
              {unsignedNames.length > 0
                ? ` ${namesInProse(unsignedNames)} ${unsignedNames.length === 1 ? "was" : "were"} not signed yet.`
                : ""}
              {bedCallTitles.map((title) => ` Bed call “${title}” was not answered yet.`).join("")} Recorded in History.
            </p>
          ) : null}
          <div className={styles.foot}>
            <span className={styles.count}>
              {openCount > 0 ? `${openCount} ${openCount === 1 ? "item" : "items"} open` : null}
            </span>
            {record ? (
              <Button onClick={undoSignOff} data-testid="ward-handover-site-undo">
                Undo sign-off
              </Button>
            ) : (
              <Button
                variant="pri"
                icon={Check}
                onClick={signOff}
                disabledReason={gate.reason}
                data-testid="ward-handover-site-sign-off-button"
              >
                Sign off at {formatInstantWithDay(now, now)}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}
