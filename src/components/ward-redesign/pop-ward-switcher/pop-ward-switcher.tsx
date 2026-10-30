"use client";

import { useState, type ReactNode } from "react";

import { WardSwitcherMock } from "./ward-switcher";

/** The Switch ward mock-up, drawn over My ward and opened on load. `page` is the page it opens over. */
export function PopWardSwitcher({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      {open ? <WardSwitcherMock onClose={() => setOpen(false)} /> : null}
    </>
  );
}
