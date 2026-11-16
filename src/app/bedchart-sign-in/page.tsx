import type { Metadata } from "next";

import { WardFlowSignInScreen } from "@/components/ward-flow-sign-in/ward-flow-sign-in-screen";

export const metadata: Metadata = {
  title: "Sign in — BedChart",
  description: "Sign in to BedChart, a prototype with synthetic data.",
};

/**
 * A sibling of `/bedchart`, not a child of it. `src/app/bedchart/layout.tsx` mounts the rail and
 * top bar around every route beneath it with no per-route opt-out, and a sign-in page carries
 * neither: "a person who has not signed in has no rail to stand in and no bar to read" (owner
 * ruling, 10 September 2026). The card is the front door's own (see `ward-flow-sign-in-screen.tsx`).
 */
export default function WardFlowSignInPage() {
  return <WardFlowSignInScreen />;
}
