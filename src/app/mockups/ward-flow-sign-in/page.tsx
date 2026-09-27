import type { Metadata } from "next";

import { WardFlowSignInScreen } from "@/components/ward-flow-sign-in/ward-flow-sign-in-screen";

export const metadata: Metadata = {
  title: "Sign in — Ward Flow",
  description: "Synthetic prototype: choose a Ward Flow role and see what the design system's screens index gives it.",
};

/**
 * A sibling of `/mockups/ward-flow`, not a child of it — see
 * `ward-flow-sign-in-screen.tsx`'s own header comment for why. `src/app/mockups/ward-flow/layout.tsx`
 * mounts the rail and top bar around every route beneath it with no per-route opt-out, and the
 * approved drawing (`docs/ward-flow/mockups/sign-in-third-edition.html`) is explicit that this
 * screen carries neither: "a person who has not signed in has no rail to stand in and no bar to
 * read" (owner ruling, 10 September 2026). This route has no ancestor layout beyond the app root,
 * so it renders with neither.
 */
export default function WardFlowSignInPage() {
  return <WardFlowSignInScreen />;
}
