"use client";

import { useState, type ReactNode } from "react";

import { TourMock } from "./tour";

/** The product tour mock-up, drawn over its page and opened on load. `page` is the page it opens over. */
export function PopTour({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      {open ? <TourMock onClose={() => setOpen(false)} /> : null}
    </>
  );
}
