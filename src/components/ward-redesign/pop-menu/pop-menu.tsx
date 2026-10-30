"use client";

import type { ReactNode } from "react";

import { PhoneMenuMock } from "./menu-host";

/** The phone Menu sheet mock-up, drawn over its page and opened on load. `page` is the page it opens over. */
export function PopMenu({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <PhoneMenuMock initial="menu" />
    </>
  );
}
