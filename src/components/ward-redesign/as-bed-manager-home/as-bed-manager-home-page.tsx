"use client";

import { AsBedManagerCapacity } from "./capacity-redesign";

/**
 * As site bed manager: Capacity, the desk's home. The preview takes the role's desk before drawing
 * (`role` in `screens.ts`), and the forked page branches on it: its own site in detail, every other
 * site as bed counts only (D-80).
 */
export function AsBedManagerHomePage() {
  return <AsBedManagerCapacity />;
}
