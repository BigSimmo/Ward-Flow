"use client";

// The Waiting person drawer's footer (Note 8 issue 7, approved 8 Nov 2026): the Coordinator and ED
// board buttons open small pop-ups that do the common job on this page, each with a link to the full
// page. Movement stays a plain link to the full record.
import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, BedSingle, ChevronDown, Hospital, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Menu, Popover, buttonClass } from "@/components/wf";
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
export function MovementRecordLink({ movement, onOpen }: { movement: Movement; onOpen?: () => void }) {
  return (
    <PatientPeekLink
      movementId={movement.id}
      // Audit four item 14: the placement peek replaces the person drawer, never stacks on it.
      onClick={onOpen}
      className={secondaryClass}
      href={movementHref(movement.id)}
      data-testid={`delays-foot-movement-${movement.id}`}
    >
      Movement
    </PatientPeekLink>
  );
}

/**
 * Audit four item 110 (amends D-98 item 3): the Coordinator pop-up is a kit menu called More, with
 * Find a bed and Open on Home. "Wards that could take them" went: the drawer's Wards tab is in view.
 * A desk that cannot find beds gets the one link on its own, never a menu of one.
 */
export function CoordinatorFootMenu({ movement, onOpenHome }: { movement: Movement; onOpenHome: () => void }) {
  const role = useEffectiveWardAccess().role;
  const router = useRouter();
  const findsBeds = seesNetworkBedFigures(role);
  const openHome = () => {
    onOpenHome();
    router.push("/bedchart");
  };
  if (!findsBeds) {
    return (
      <Link
        className={secondaryClass}
        href="/bedchart"
        onClick={onOpenHome}
        data-testid={`delays-foot-coordinator-${movement.id}`}
      >
        Open on Home
      </Link>
    );
  }
  return (
    <Menu
      label="More for this person"
      align="end"
      items={[
        {
          id: "find-bed",
          icon: BedSingle,
          label: "Find a bed",
          onSelect: () => requestToolsTool("bed-finder"),
        },
        { id: "home", icon: LayoutDashboard, label: "Open on Home", onSelect: openHome },
      ]}
      trigger={(props) => (
        <Button
          {...props}
          variant="sec"
          size="md"
          iconEnd={ChevronDown}
          data-testid={`delays-foot-coordinator-${movement.id}`}
        >
          More
        </Button>
      )}
    />
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
