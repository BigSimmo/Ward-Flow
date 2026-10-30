"use client";

import { AsBedManagerPlaces } from "./places-redesign";

/**
 * As site bed manager: Places. The preview takes the role's desk before drawing (`role` in
 * `screens.ts`), and the forked page branches on it: its own site's wards first, every other place
 * as place information with no way in (D-80).
 */
export function AsBedManagerPlacesPage() {
  return <AsBedManagerPlaces />;
}
