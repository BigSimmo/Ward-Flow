"use client";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";

import { MockupPreviewBar } from "./preview-bar";
import type { MockupOption } from "./preview-option";

export type PortraitPreviewPage = "handover" | "delays";

const HREF = "/mockups/ward-flow/preview/ipadportrait";

/**
 * Topic 3 of the device audit mockups: the iPad portrait pattern, shown on the real Handover and
 * Delays screens. At 820px wide tables become list rows and the rail becomes a slide-over; at
 * every other width the screens render exactly as their live routes do.
 */
export function PortraitPatternPreview({ option, page }: { option: MockupOption; page: PortraitPreviewPage }) {
  return (
    <>
      <MockupPreviewBar
        topic="iPad portrait"
        option={option}
        hrefFor={(next, nextPage) => `${HREF}?option=${next}&page=${nextPage ?? page}`}
        pages={[
          { id: "handover", label: "Handover", current: page === "handover" },
          { id: "delays", label: "Delays", current: page === "delays" },
        ]}
      />
      {page === "delays" ? <DelaysScreen portraitPattern={option} /> : <HandoverPage portraitPattern={option} />}
    </>
  );
}
