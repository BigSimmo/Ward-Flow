"use client";

import type { ReactNode } from "react";

import { PopupPlaceholder } from "@/components/ward-redesign/parts/popup-placeholder";

/** The Record a form mock-up, drawn over its page. `page` is the page it opens over. */
export function PopRecordForm({ page }: { page: ReactNode }) {
  return <PopupPlaceholder page={page} label="Record a form" />;
}
