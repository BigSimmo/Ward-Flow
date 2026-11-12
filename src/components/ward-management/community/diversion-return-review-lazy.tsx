"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

/**
 * "Please review: returned to ED" (batch 3 item 28), loaded after the page so the community screen
 * keeps its phone script budget. Renders nothing while loading, as the card does when empty.
 */
export const DiversionReturnReview = dynamic(
  withLoadRetry(() => import("./diversion-return-review-card").then((m) => m.DiversionReturnReview)),
  { loading: () => null },
);
