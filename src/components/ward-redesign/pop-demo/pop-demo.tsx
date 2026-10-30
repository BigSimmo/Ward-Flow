"use client";

import { useState, type ReactNode } from "react";

import { DemoMenuMock } from "./demo-menu";

/** The Demo menu mock-up, drawn over its page and opened on load. `page` is the page it opens over. */
export function PopDemo({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      {open ? <DemoMenuMock onClose={() => setOpen(false)} /> : null}
    </>
  );
}
