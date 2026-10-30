"use client";

import type { ReactNode } from "react";

import { BroadcastHost } from "./broadcast-host";

/** The Broadcast mock-up, drawn over its page. `page` is the page it opens over. */
export function PopBroadcast({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <BroadcastHost />
    </>
  );
}
