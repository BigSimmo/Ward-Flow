"use client";

import { useEffect, useState, useSyncExternalStore, type ComponentProps } from "react";

import { Button } from "@/components/wf";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";

/*
 * Phone script budget (22 October 2026): the preview body, the phone lane facts and the desktop
 * picked strip draw only once an ED or a person is chosen, so their code loads after the first
 * paint and is fetched when the browser is idle. Not `next/dynamic`, which holds a freshly loaded
 * panel back for a frame or more; a loaded body draws straight away.
 */
type PreviewModule = typeof import("./ed-preview");
let loadedPreview: PreviewModule | undefined;
// One fetch shared by every part of the preview. A failed fetch is forgotten so Try again fetches anew,
// and a load from any part draws all of them.
let pendingPreview: Promise<PreviewModule> | undefined;
const previewListeners = new Set<() => void>();
const loadPreview = () =>
  (pendingPreview ??= import("./ed-preview").then(
    (m) => {
      loadedPreview = m;
      previewListeners.forEach((listener) => listener());
      return m;
    },
    (error: unknown) => {
      pendingPreview = undefined;
      throw error;
    },
  ));
preloadWhenIdle(loadPreview);
const subscribePreview = (listener: () => void) => {
  previewListeners.add(listener);
  return () => void previewListeners.delete(listener);
};

function usePreviewModule() {
  const loaded = useSyncExternalStore(
    subscribePreview,
    () => loadedPreview,
    () => undefined,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Every part is drawn from `loaded` first, so a stale failure after a later load is never shown.
    if (!loaded && !failed) loadPreview().catch(() => setFailed(true));
  }, [loaded, failed]);
  return { loaded, failed, retry: () => setFailed(false) };
}

// A failed fetch (patchy Wi-Fi, or a new deploy) must not leave the preview blank without a word.
function PreviewLoadFailed({ retry }: { retry: () => void }) {
  return (
    <p role="status" data-testid="ward-ed-preview-load-failed">
      The ED details did not load.{" "}
      <Button variant="sec" onClick={retry}>
        Try again
      </Button>
    </p>
  );
}

export function EdPreview(props: ComponentProps<PreviewModule["EdPreview"]>) {
  const { loaded, failed, retry } = usePreviewModule();
  const Body = loaded?.EdPreview;
  if (Body) return <Body {...props} />;
  return failed ? <PreviewLoadFailed retry={retry} /> : null;
}

export function EdPreviewFoot(props: ComponentProps<PreviewModule["EdPreviewFoot"]>) {
  // On a failed load the preview body above says so and offers Try again.
  const Foot = usePreviewModule().loaded?.EdPreviewFoot;
  return Foot ? <Foot {...props} /> : null;
}

export function EdLanePicked(props: ComponentProps<PreviewModule["EdLanePicked"]>) {
  const { loaded, failed, retry } = usePreviewModule();
  const Picked = loaded?.EdLanePicked;
  if (Picked) return <Picked {...props} />;
  return failed ? <PreviewLoadFailed retry={retry} /> : null;
}

export function EdLaneFacts(props: ComponentProps<PreviewModule["EdLaneFacts"]>) {
  const { loaded, failed, retry } = usePreviewModule();
  const Facts = loaded?.EdLaneFacts;
  if (Facts) return <Facts {...props} />;
  return failed ? <PreviewLoadFailed retry={retry} /> : null;
}
