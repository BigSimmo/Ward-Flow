"use client";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";

import { MockupPreviewBar } from "./preview-bar";
import { ED_PREVIEW_OPTIONS, type EdPreviewOption } from "./preview-option";

const HREF = "/mockups/ward-flow/preview/edpage";

/**
 * Topic 2 of the device audit mockups: the ED page board, on the real screen and its shared state.
 * Each option keeps the hero and the ED strip, takes the Statewide capacity table and the 24 hour
 * timeline off the page (as links), and gives every row one Next button with edits in the sheet.
 */
export function EdPagePreview({ option, edId }: { option: EdPreviewOption; edId: string }) {
  return (
    <>
      <MockupPreviewBar
        topic="ED page"
        option={option}
        options={ED_PREVIEW_OPTIONS}
        hrefFor={(next) => `${HREF}?option=${next}&ed=${encodeURIComponent(edId)}`}
      />
      <EdScreen edId={edId} preview={option} />
    </>
  );
}
