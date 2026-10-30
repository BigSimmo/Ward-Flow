"use client";

import type { ReactNode } from "react";

import { ConfirmBedsDialog } from "./confirm-beds-dialog";

/** The Confirm beds mock-up, drawn over its page. `page` is the page it opens over. */
export function PopConfirmBeds({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <ConfirmBedsDialog />
    </>
  );
}
