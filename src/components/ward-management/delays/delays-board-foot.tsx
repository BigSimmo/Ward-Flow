"use client";

// The Waiting person drawer's footer (Note 8 issue 7, approved 8 Nov 2026): the Coordinator and ED
// board buttons open small pop-ups that do the common job on this page, each with a link to the full
// page. Movement stays a plain link to the full record.
import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, BedSingle, Hospital, LayoutDashboard, ListChecks } from "lucide-react";
import { Button, Popover, buttonClass } from "@/components/wf";
import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { seesNetworkBedFigures } from "@/components/ward-management/ward-role-access";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import { edHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import { PatientPeekLink } from "@/components/ward-management/patients/patient-peek-link";
import styles from "@/components/ward-management/peek-popover.module.css";

const secondaryClass = buttonClass({ variant: "sec", size: "md" });

/** Movement opens the Patient peek over Waiting; the full page stays on its link (new tab). */
export function MovementRecordLink({ movement }: { movement: Movement }) {
  return (
    <PatientPeekLink
      movementId={movement.id}
      className={secondaryClass}
      href={movementHref(movement.id)}
      data-testid={`delays-foot-movement-${movement.id}`}
    >
      Movement
    </PatientPeekLink>
  );
}

/** Coordinator actions without leaving Waiting: the Wards tab, Find a bed, then Home if needed. */
export function CoordinatorFootMenu({
  movement,
  onShowWards,
  onOpenHome,
}: {
  movement: Movement;
  onShowWards: () => void;
  onOpenHome: () => void;
}) {
  const role = useEffectiveWardAccess().role;
  const findsBeds = seesNetworkBedFigures(role);
  return (
    <Popover
      label="Coordinator actions"
      align="start"
      panelClassName={styles.panel}
      trigger={(props) => (
        <Button
          {...props}
          variant="sec"
          size="md"
          icon={LayoutDashboard}
          data-testid={`delays-foot-coordinator-${movement.id}`}
        >
          Coordinator
        </Button>
      )}
    >
      {(close) => (
        <div className={styles.body}>
          <p className={styles.title}>Coordinator actions</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                close({ restoreFocus: false });
                onShowWards();
              }}
            >
              <ListChecks size={16} aria-hidden="true" />
              <span>
                <b>Wards that could take them</b>
                <small>Opens the Wards tab here</small>
              </span>
            </button>
            {findsBeds ? (
              <button
                type="button"
                className={styles.action}
                onClick={(event) => {
                  const trigger = event.currentTarget
                    .closest("[role=dialog]")
                    ?.parentElement?.querySelector<HTMLElement>("button[aria-haspopup]");
                  close({ restoreFocus: false });
                  requestToolsTool("bed-finder", trigger ?? undefined);
                }}
              >
                <BedSingle size={16} aria-hidden="true" />
                <span>
                  <b>Find a bed</b>
                  <small>Opens Bed finder in Tools</small>
                </span>
              </button>
            ) : null}
          </div>
          <Link className={styles.pageLink} href="/ward-flow" onClick={onOpenHome}>
            Open on coordinator Home
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </Popover>
  );
}

/** The person's ED at a glance: how many wait there and the longest wait, then the full board. */
export function EdBoardFootPeek({ movement, now }: { movement: Movement; now: Instant }) {
  const { movements } = useWardFlowSelect("movements");
  const edId = movement.originEdId;
  const summary = useMemo(
    () => (edId ? edOpenSummaries(movements, now).find((item) => item.ed.id === edId) : undefined),
    [movements, now, edId],
  );
  if (!edId) return null;
  const name = summary?.ed.name ?? "ED";
  return (
    <Popover
      label={`${name} at a glance`}
      align="start"
      panelClassName={styles.panel}
      trigger={(props) => (
        <Button {...props} variant="sec" size="md" icon={Hospital} data-testid={`delays-foot-ed-${movement.id}`}>
          ED board
        </Button>
      )}
    >
      {() => (
        <div className={styles.body}>
          <p className={styles.title}>{name}</p>
          {summary ? (
            <dl className={styles.figures}>
              <div>
                <dt>Waiting</dt>
                <dd>{summary.waiting}</dd>
              </div>
              <div>
                <dt>Longest wait</dt>
                <dd>{summary.waiting ? splitDuration(summary.longestWaitMinutes) : "None"}</dd>
              </div>
              <div>
                <dt>Detained</dt>
                <dd>{summary.detained}</dd>
              </div>
            </dl>
          ) : (
            <p className={styles.note}>No figures for this ED.</p>
          )}
          <Link className={styles.pageLink} href={edHref(edId)}>
            Open ED board
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </Popover>
  );
}
