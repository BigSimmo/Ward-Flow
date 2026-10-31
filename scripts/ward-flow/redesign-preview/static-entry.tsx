// The shareable redesign preview's one script: the viewer on `index.html`, one mock-up page on
// `frame.html`. Built by `scripts/ward-flow/build-redesign-preview.mjs` from the same React
// components the `/mockups/ward-flow-redesign` route draws.
import { createRoot } from "react-dom/client";

import { WfServerPhoneProvider } from "@/components/wf";
import { OverlayRoot } from "@/components/wf/overlay-root";
import { MockupViewer } from "@/app/mockups/ward-flow-redesign/_preview/mockup-viewer";
import { MOCKUP_PAGE_SLUGS } from "@/app/mockups/ward-flow-redesign/_preview/built-pages";
import { PreviewScreen, type PreviewTheme } from "@/app/mockups/ward-flow-redesign/_preview/preview-screen";
import { PreviewWorld } from "@/app/mockups/ward-flow-redesign/_preview/preview-world";
import { screenBySlug } from "@/app/mockups/ward-flow-redesign/_preview/screens";

const params = new URLSearchParams(location.search);
const screen = params.get("screen");
const themeParam = params.get("theme");
const theme: PreviewTheme = themeParam === "dark" || themeParam === "light" ? themeParam : null;
const phone = matchMedia("(max-width: 48rem)").matches;
const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);
  if (screen && screenBySlug(screen)) {
    document.title = `${screenBySlug(screen)?.label ?? "Mock-up"} — Ward Flow redesign`;
    root.render(
      <WfServerPhoneProvider phone={phone} tablet={false}>
        <PreviewWorld>
          <PreviewScreen slug={screen} pop={params.get("pop")} theme={theme} />
        </PreviewWorld>
        <OverlayRoot />
      </WfServerPhoneProvider>,
    );
  } else {
    root.render(
      <WfServerPhoneProvider phone={phone} tablet={false}>
        <MockupViewer mode="static" built={MOCKUP_PAGE_SLUGS} />
        <OverlayRoot />
      </WfServerPhoneProvider>,
    );
  }
}
