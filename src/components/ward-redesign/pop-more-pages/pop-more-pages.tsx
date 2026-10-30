"use client";

import { useState, type ReactNode } from "react";

import { MorePagesSheetMock } from "./more-pages-sheet";

/** The rail's More pages mock-up, drawn over its page and opened on load. `page` is the page it opens over. */
export function PopMorePages({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      <MorePagesSheetMock open={open} onClose={() => setOpen(false)} />
    </>
  );
}
