"use client";

import type { ReactNode } from "react";

import { PopupPlaceholder } from "@/components/ward-redesign/parts/popup-placeholder";

/** The Loading mock-up, drawn over its page. `page` is the page it opens over. */
export function PopStateLoading({ page }: { page: ReactNode }) {
  return <PopupPlaceholder page={page} label="Loading" />;
}
