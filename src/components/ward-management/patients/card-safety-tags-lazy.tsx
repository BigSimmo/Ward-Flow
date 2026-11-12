"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

// The ED board and person sheet load the card tags on their own: the referral reader they need
// (`patient-referral-safety.ts` and its seeded referral letters) is not otherwise on the ED page,
// and the phone size limit for that page has no room for it in the first load.
export const CardSafetyTagsLazy = dynamic(
  withLoadRetry(() => import("./card-safety-tags").then((m) => m.CardSafetyTags)),
);
