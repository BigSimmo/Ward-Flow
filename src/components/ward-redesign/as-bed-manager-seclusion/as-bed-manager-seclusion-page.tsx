"use client";

import { BedManagerSeclusionRedesign } from "./bed-manager-seclusion-redesign";

/**
 * As site bed manager: the Seclusion mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The fork
 * beside this file holds the bed manager's branch (`siteName`), marked where it differs.
 */
export function AsBedManagerSeclusionPage() {
  return <BedManagerSeclusionRedesign />;
}
