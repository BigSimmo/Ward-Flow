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
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { useState, type MouseEvent, type ReactNode } from "react";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";

// The sheet and its bookings panel load on the first press, so no route's first download grows.
const BookingsPeekSheet = dynamic(
  withLoadRetry(() => import("./bookings-peek-sheet").then((m) => m.BookingsPeekSheet)),
  {
    loading: () => null,
  },
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
      {open ? <BookingsPeekSheet unit={unit} href={href} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
