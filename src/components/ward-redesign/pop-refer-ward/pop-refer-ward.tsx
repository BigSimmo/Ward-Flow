"use client";

import type { ReactNode } from "react";

import { ReferWardHost } from "./refer-ward-host";

/** The Refer to a ward mock-up, drawn over its page. `page` is the page it opens over. */
export function PopReferWard({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <ReferWardHost />
    </>
  );
}
