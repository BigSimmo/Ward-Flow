"use client";

import type { ReactNode } from "react";

import { PhoneMenuMock } from "@/components/ward-redesign/pop-menu/menu-host";

/**
 * The phone Create sheet mock-up (the dock's +), drawn over its page and opened on load. It shares
 * the Menu mock-up's fork of the sheets (`pop-menu/menu-sheets.tsx`), where Create is drawn.
 */
export function PopCreate({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <PhoneMenuMock initial="create" />
    </>
  );
}
