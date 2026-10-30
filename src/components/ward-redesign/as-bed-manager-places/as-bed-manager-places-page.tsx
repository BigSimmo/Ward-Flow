"use client";

import { PlacesPage } from "@/components/ward-redesign/places/places-page";

/**
 * As site bed manager: the Places mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsBedManagerPlacesPage() {
  return <PlacesPage />;
}
