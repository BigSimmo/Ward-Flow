"use client";

import { useEffect, useSyncExternalStore } from "react";

import { applyThemeToDocument } from "@/lib/theme-client";

import { screenBySlug } from "./screens";
import { PreviewShell } from "./preview-shell";
import { MOCKUP_PAGES } from "./screen-components";
import { MOCKUP_POPUP_COMPONENTS } from "./popup-components";

const subscribeNothing = () => () => {};

export type PreviewTheme = "light" | "dark" | null;

/**
 * Preview only: one redesigned page, in the app's chrome unless the page draws without it. Drawn in
 * the browser only: the shell is told its address through the browser's copy of the router's
 * context, which the server render does not share. A theme from the viewer is applied to this
 * frame only and never saved.
 */
export function PreviewScreen({ slug, pop, theme }: { slug: string; pop: string | null; theme: PreviewTheme }) {
  const inBrowser = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  // The rail re-applies the stored theme on mount and again once its store hydrates, so the frame
  // holds its own theme whenever the root drifts from it. Nothing is saved.
  useEffect(() => {
    if (!theme || !inBrowser) return;
    const root = document.documentElement;
    const hold = () => {
      if (root.getAttribute("data-theme") !== theme || root.classList.contains("dark") !== (theme === "dark"))
        applyThemeToDocument(theme);
    };
    hold();
    const observer = new MutationObserver(hold);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, [theme, inBrowser]);
  const screen = screenBySlug(slug);
  const Page = MOCKUP_PAGES[slug];
  if (!inBrowser || !screen) return null;
  const drawnPage = Page ? <Page openOnLoad={pop ?? undefined} /> : <NotDrawnYet label={screen.label} />;
  // A popup or state the preview draws itself (shell overlays, page popups, states): it is handed
  // the page and draws inside the shell, so it reads the same world and chrome as the page.
  const Popup = pop ? MOCKUP_POPUP_COMPONENTS[pop] : undefined;
  const page = Popup ? <Popup page={drawnPage} /> : drawnPage;
  return screen.bare ? page : <PreviewShell appPath={screen.shellPath ?? screen.appPath}>{page}</PreviewShell>;
}

function NotDrawnYet({ label }: { label: string }) {
  return (
    <main id="main-content" style={{ padding: "var(--wf-s-6)", color: "var(--wf-ink-2)" }}>
      {label} is not rebuilt in React yet.
    </main>
  );
}
