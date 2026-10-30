"use client";

import { LegalFormsPage } from "@/components/ward-redesign/legal-forms/legal-forms-page";

/**
 * As nurse in charge: the Legal forms mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardLegalFormsPage() {
  return <LegalFormsPage />;
}
