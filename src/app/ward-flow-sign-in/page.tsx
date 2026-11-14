import type { Metadata } from "next";

import { WardFlowSignInScreen } from "@/components/ward-flow-sign-in/ward-flow-sign-in-screen";

export const metadata: Metadata = {
  title: "Sign in — Ward Flow",
  description: "Sign in to Ward Flow, a prototype with synthetic data.",
};

/**
 * A sibling of `/ward-flow`, not a child of it. `src/app/ward-flow/layout.tsx` mounts the rail and
 * top bar around every route beneath it with no per-route opt-out, and a sign-in page carries
 * neither: "a person who has not signed in has no rail to stand in and no bar to read" (owner
 * ruling, 10 September 2026). The card is the front door's own (see `ward-flow-sign-in-screen.tsx`).
 */
export default function WardFlowSignInPage() {
  return <WardFlowSignInScreen />;
}
