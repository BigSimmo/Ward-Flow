"use client";

import { AsOfficerTransportRedesign } from "./transport-redesign";

/**
 * As transport officer: the Transport desk mock-up as this role sees it. The preview takes the role's
 * desk before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The
 * fork beside this file carries the officer's changes as commented `officer` branches.
 */
export function AsOfficerHomePage() {
  return <AsOfficerTransportRedesign />;
}
