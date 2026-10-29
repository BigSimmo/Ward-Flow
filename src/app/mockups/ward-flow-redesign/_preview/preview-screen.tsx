"use client";

import { useEffect, useSyncExternalStore } from "react";

import { applyThemeToDocument } from "@/lib/theme-client";

import { screenBySlug } from "./screens";
import { PreviewShell } from "./preview-shell";
import { MOCKUP_PAGES } from "./screen-components";

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
  useEffect(() => {
    if (theme) applyThemeToDocument(theme);
  }, [theme]);
  const screen = screenBySlug(slug);
  const Page = MOCKUP_PAGES[slug];
  if (!inBrowser || !screen) return null;
  const page = Page ? <Page openOnLoad={pop ?? undefined} /> : <NotDrawnYet label={screen.label} />;
  return screen.bare ? page : <PreviewShell appPath={screen.appPath}>{page}</PreviewShell>;
}

function NotDrawnYet({ label }: { label: string }) {
  return (
    <main id="main-content" style={{ padding: "var(--wf-s-6)", color: "var(--wf-ink-2)" }}>
      {label} is not rebuilt in React yet.
    </main>
  );
}
