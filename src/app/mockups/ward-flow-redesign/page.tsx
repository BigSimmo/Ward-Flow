import type { Metadata } from "next";

import { MockupViewer } from "./_preview/mockup-viewer";
import { MOCKUP_PAGE_SLUGS } from "./_preview/built-pages";

export const metadata: Metadata = {
  title: "Ward Flow, redesigned (mock-ups) — Ward Flow",
  description: "React mock-ups of every Ward Flow page and popup from the October 2026 design review.",
  robots: { index: false },
};

export default function WardFlowRedesignViewerPage() {
  return <MockupViewer built={MOCKUP_PAGE_SLUGS} />;
}
