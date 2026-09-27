import type { Metadata } from "next";

import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { unitById } from "@/components/ward-management/ward-sites";

/**
 * The tab keeps the ward's name; the on-screen `h1` does not.
 *
 * The third edition puts the SCREEN's name in the `h1` — the constant "Ward" — and the ward's own
 * name in the first panel. **That is right for the page and wrong for the tab.** A browser showing
 * twenty-three tabs all reading "Ward" has lost the only thing that told them apart, so the title
 * carries what the heading gave up. Two surfaces, two jobs.
 *
 * ⚠️ **THIS RESOLVES THE UNIT FROM THE FROZEN FIXTURE, AND `ward-screen.tsx` DELIBERATELY DOES NOT.**
 * That screen's own comment records why: it used to read `unitById()` and its bed grid, confirmed
 * line and capacity default then never moved after the screen dispatched `CONFIRM_CAPACITY` against
 * itself. **Those are figures the reducer writes.** A unit's NAME is not — nothing in
 * `ward-flow-reducer.ts` ever assigns one — so the two sources cannot disagree about it.
 *
 * 🔴 **And the provider is not available here in any case:** metadata is generated on the server and
 * `useWardFlow()` is client state. **Do not "fix" this by trying to plumb the provider in** — the
 * fixture is not a shortcut here, it is the only reader that exists, and for this one field it is
 * exact.
 */
export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }): Promise<Metadata> {
  const unit = unitById(decodeURIComponent((await params).unitId));
  return {
    title: unit ? `Ward — ${unit.name}` : "Ward not found — Ward Flow",
    description: "Synthetic single-unit ward view for the Ward Flow prototype.",
  };
}

export default async function WardUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return <WardScreen unitId={decodeURIComponent(unitId)} />;
}
