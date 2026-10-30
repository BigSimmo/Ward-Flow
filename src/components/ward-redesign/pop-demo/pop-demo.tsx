"use client";

import type { ReactNode } from "react";

import { PopupPlaceholder } from "@/components/ward-redesign/parts/popup-placeholder";

/** The Demo menu mock-up, drawn over its page. `page` is the page it opens over. */
export function PopDemo({ page }: { page: ReactNode }) {
  return <PopupPlaceholder page={page} label="Demo menu" />;
}
