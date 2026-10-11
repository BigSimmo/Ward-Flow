import type { Metadata } from "next";

import { parseMockupOption } from "@/components/ward-management/preview/preview-option";
import { PortraitPatternPreview } from "@/components/ward-management/preview/portrait-pattern-preview";

export const metadata: Metadata = {
  title: "iPad portrait mockup - Ward Flow",
  description:
    "Preview only: three options for the iPad portrait list rows and slide-over rail, on Handover and Delays.",
};

/** Preview-only mockup route (device audit 11 Oct 2026). Not in the navigation. */
export default async function PortraitPatternPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ option?: string; page?: string }>;
}) {
  const query = await searchParams;
  return (
    <PortraitPatternPreview
      option={parseMockupOption(query?.option)}
      page={query?.page === "delays" ? "delays" : "handover"}
    />
  );
}
