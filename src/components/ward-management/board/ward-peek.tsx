"use client";

// Ward peek (Josh's approval, 8 Nov 2026): a ward button opens a small pop-up with the ward's beds
// (ready now, in use) and a link to its board, instead of leaving the page. Desks that may not open
// the board keep no button at all, as before.
import Link from "next/link";
import { ArrowUpRight, BedSingle } from "lucide-react";
import { Button, Popover } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { siteByCode } from "@/components/ward-management/ward-sites";
import styles from "@/components/ward-management/peek-popover.module.css";

export function WardPeekButton({
  unitId,
  href,
  label,
  variant = "sec",
}: {
  unitId: string;
  /** The full page the old link went to (the ward board or the ward page). */
  href: string;
  label: string;
  variant?: "pri" | "sec";
}) {
  const { units, admissions, bedReleases, referrals } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "referrals",
  );
  const canOpen = useCanOpenHref();
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!unit || !canOpen(href)) return null;
  // Same rule as Search's ready count, without pulling Search's code into every board.
  const ready = unit.allocatable && unit.empty ? readyBedsNow(unit, admissions, [], referrals) : null;
  const inUse = wardBedsInUse(unit, admissions, bedReleases);
  const site = siteByCode(unit.siteCode)?.name;
  return (
    <Popover
      label={`${unit.name} at a glance`}
      align="start"
      panelClassName={styles.panel}
      trigger={(props) => (
        <Button {...props} variant={variant} icon={BedSingle} data-testid={`ward-peek-${unit.id}`}>
          {label}
        </Button>
      )}
    >
      {() => (
        <div className={styles.body}>
          <p className={styles.title}>
            {unit.name}
            {site ? ` · ${site}` : ""}
          </p>
          <dl className={styles.figures}>
            <div>
              <dt>Ready now</dt>
              <dd>{ready ?? "–"}</dd>
            </div>
            <div>
              <dt>In use</dt>
              <dd>
                {inUse} of {unit.beds}
              </dd>
            </div>
          </dl>
          <Link className={styles.pageLink} href={href}>
            Open {label === "Open ward" ? "ward" : "board"}
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}
    </Popover>
  );
}
