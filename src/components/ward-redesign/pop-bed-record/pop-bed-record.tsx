"use client";

import type { ReactNode } from "react";

import { BedRecordHost } from "./bed-record-host";

/** The Bed record mock-up, drawn over its page. `page` is the page it opens over. */
export function PopBedRecord({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <BedRecordHost />
    </>
  );
}
