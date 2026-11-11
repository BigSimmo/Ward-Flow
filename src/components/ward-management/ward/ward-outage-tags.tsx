import type { ReactNode } from "react";

import { NOT_CONFIRMED_SINCE_OUTAGE, useWardOutageCatchUp } from "@/components/ward-management/use-outage-catch-up";

export { NOT_CONFIRMED_SINCE_OUTAGE, useWardOutageCatchUp };

/** Every bed's card head: "Updated 10:42 · Not confirmed since the outage" until the ward confirms (D-142). */
export function OutageMeta({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? (
    <>
      {children} · {NOT_CONFIRMED_SINCE_OUTAGE}
    </>
  ) : (
    children
  );
}
