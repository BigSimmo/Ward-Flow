"use client";

import { AsBedManagerWards } from "./wards-redesign";

/**
 * As site bed manager: All wards. The preview takes the role's desk before drawing (`role` in
 * `screens.ts`), and the forked page branches on it: its own site's wards first and in full, every
 * other site as bed counts only (D-80).
 */
export function AsBedManagerWardsPage() {
  return <AsBedManagerWards />;
}
