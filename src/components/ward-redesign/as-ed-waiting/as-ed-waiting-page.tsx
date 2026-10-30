"use client";

import { AsEdWaitingRedesign } from "./as-ed-waiting-redesign";

/**
 * As ED clinician: the Waiting mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsEdWaitingPage() {
  return <AsEdWaitingRedesign />;
}
