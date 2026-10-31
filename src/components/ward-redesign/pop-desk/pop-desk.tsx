"use client";

import { useState, type ReactNode } from "react";

import { DeskSwitcherMock } from "./desk-switcher";

/** The Go to a desk mock-up, drawn over its page and opened on load. `page` is the page it opens over. */
export function PopDesk({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      {open ? <DeskSwitcherMock isOpen onClose={() => setOpen(false)} /> : null}
    </>
  );
}
