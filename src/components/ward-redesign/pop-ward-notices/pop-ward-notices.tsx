"use client";

import type { ReactNode } from "react";

import { WardNoticesHost } from "./ward-notices-host";

/** The Ward notices mock-up, drawn over its page. `page` is the page it opens over. */
export function PopWardNotices({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <WardNoticesHost />
    </>
  );
}
