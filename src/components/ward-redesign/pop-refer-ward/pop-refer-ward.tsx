"use client";

import type { ReactNode } from "react";

import { PopupPlaceholder } from "@/components/ward-redesign/parts/popup-placeholder";

/** The Refer to a ward mock-up, drawn over its page. `page` is the page it opens over. */
export function PopReferWard({ page }: { page: ReactNode }) {
  return <PopupPlaceholder page={page} label="Refer to a ward" />;
}
