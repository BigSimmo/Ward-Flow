import { notFound, redirect } from "next/navigation";

import { knownWardUnit } from "@/components/ward-management/ward-known-places";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";
import { wardBoardHref } from "@/components/ward-management/shell/ward-facade";

/**
 * Simplification 26 Nov 2026 (fold the Bed board into Ward, Josh's approved version, item 13): the
 * Bed board is now the Ward page's Grid view of Every bed. This route stays as a backstop so an
 * old link or bookmark lands on that view. An unknown ward still shows "Page not found" (DA-32).
 */
export default async function WardBoardRedirect({ params }: { params: Promise<{ unitId: string }> }) {
  const unitId = safeDecodeURIComponent((await params).unitId);
  if (!knownWardUnit(unitId)) notFound();
  redirect(wardBoardHref(unitId));
}
