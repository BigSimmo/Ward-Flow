"use client";

/**
 * Bookings peek (friction pass item 6b, Josh's approval, 9 Nov 2026). An alert's "Open bookings"
 * opens that ward's own bookings list (the same `PlannedAdmissionsPanel` the ward page shows with
 * `?bookings=1`) in a side panel, or a sheet on a phone, so the reader stays on Alerts. The ward
 * page stays one link away, and the href still opens it in a new tab or on a middle click. A desk
 * that may not open the ward page keeps the plain link, as before.
 */
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, type MouseEvent, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { PhoneSheet, useIsPhone } from "@/components/wf";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import styles from "@/components/ward-management/patients/patient-peek.module.css";

// The bookings panel's code loads on the first press, so Alerts' first download does not grow.
const PlannedAdmissionsPanel = dynamic(
  () => import("@/components/ward-management/capacity/planned-admissions-panel").then((m) => m.PlannedAdmissionsPanel),
  { loading: () => <p role="status">Loading bookings…</p> },
);

export function BookingsPeekLink({
  unitId,
  href,
  className,
  children,
}: {
  unitId: string | undefined;
  /** The ward page with its bookings open, where the link went before. */
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const canOpen = useCanOpenHref();
  const { units } = useWardFlowSelect("units");
  const now = useWardFlowClock();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const unit = unitId === undefined ? undefined : units.find((candidate) => candidate.id === unitId);
  if (!unit || !canOpen(href)) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <>
      <Link
        href={href}
        className={className}
        aria-haspopup="dialog"
        data-testid={`bookings-peek-open-${unit.id}`}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </Link>
      {open ? (
        <PhoneSheet
          open
          onClose={() => setOpen(false)}
          title={unit.name}
          description="Bookings for this ward. You stay on this page."
          closeLabel={`Close ${unit.name} bookings`}
          height="tall"
          placement={isPhone ? "bottom" : "right"}
          data-testid="bookings-peek"
        >
          <div data-ward-design="v6" className={styles.body}>
            <Link className={styles.pageLink} href={href} data-testid="bookings-peek-ward-page">
              Open the ward page
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            <PlannedAdmissionsPanel now={now} unitId={unit.id} />
          </div>
        </PhoneSheet>
      ) : null}
    </>
  );
}
