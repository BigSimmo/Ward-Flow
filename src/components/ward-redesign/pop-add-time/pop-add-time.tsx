"use client";

import type { ReactNode } from "react";

import { PopupPlaceholder } from "@/components/ward-redesign/parts/popup-placeholder";

/** The Add the time mock-up, drawn over its page. `page` is the page it opens over. */
export function PopAddTime({ page }: { page: ReactNode }) {
  return <PopupPlaceholder page={page} label="Add the time" />;
}
