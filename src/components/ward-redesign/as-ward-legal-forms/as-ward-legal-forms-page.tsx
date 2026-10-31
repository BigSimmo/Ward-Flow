"use client";

import { LegalFormsRedesign } from "@/components/ward-redesign/as-ward-legal-forms/legal-forms-redesign";

/**
 * As nurse in charge: the Legal forms mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only the forms on moves to this ward. The
 * screen is a fork of the coordinator's with the ward's differences as commented `routeRole === "ward"`
 * branches: the title names the ward, and an empty Admitted on a form group says where the ward records one.
 */
export function AsWardLegalFormsPage() {
  return <LegalFormsRedesign />;
}
