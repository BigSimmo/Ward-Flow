"use client";

// The bookings peek's sheet (item 6b), loaded on the first press so no route's first download grows.
import Link from "next/link";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { ArrowUpRight } from "lucide-react";
import { PhoneSheet, useIsPhone } from "@/components/wf";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import styles from "@/components/ward-management/patients/patient-peek.module.css";

const PlannedAdmissionsPanel = dynamic(
  withLoadRetry(() =>
    import("@/components/ward-management/capacity/planned-admissions-panel").then((m) => m.PlannedAdmissionsPanel),
  ),
  { loading: () => <p role="status">Loading bookings…</p> },
);

export function BookingsPeekSheet({ unit, href, onClose }: { unit: Unit; href: string; onClose: () => void }) {
  const now = useWardFlowClock();
  const isPhone = useIsPhone();
  return (
    <PhoneSheet
      open
      onClose={onClose}
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
  );
}
