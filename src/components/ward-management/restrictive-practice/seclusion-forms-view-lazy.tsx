"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

/**
 * Phone budget: the seclusion and restraint view draws only when its Forms view is chosen, so its
 * code stays out of the Forms page's first load (FS3, 3 Nov 2026).
 */
export const SeclusionFormsView = dynamic(
  withLoadRetry(() => import("./seclusion-forms-view").then((m) => m.SeclusionFormsView)),
  {
    loading: () => null,
  },
);
