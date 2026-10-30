"use client";

import type { ReactNode } from "react";

import { PopupPlaceholder } from "@/components/ward-redesign/parts/popup-placeholder";

/** The Officer job panel mock-up, drawn over its page. `page` is the page it opens over. */
export function PopOfficerJob({ page }: { page: ReactNode }) {
  return <PopupPlaceholder page={page} label="Officer job panel" />;
}
