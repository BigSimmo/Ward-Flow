"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { isChunkLoadError, useReloadWhenOnline } from "@/lib/chunk-load-error";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // DR-01: a script or style file that failed because the connection dropped is not an app crash.
  const chunkFailure = isChunkLoadError(error);
  const online = useReloadWhenOnline(chunkFailure);

  if (chunkFailure) {
    return (
      <RouteErrorBoundary
        error={error}
        reset={reset}
        title={online ? "Part of this page did not load" : "You are offline"}
        description={
          online
            ? "The connection dropped while the page was loading. Reload the page to finish loading it. Nothing was changed."
            : "The connection dropped while the page was loading. This page will reload by itself when the connection returns. Nothing was changed."
        }
        logLabel="Page file failed to load (connection lost):"
        showReload
        minHeightClass="min-h-screen"
      />
    );
  }

  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Something went wrong"
      description="An unexpected error occurred in the application shell. You can try to reset the current view or refresh the browser."
      logLabel="Unhandled runtime error captured by boundary:"
      showReload
      minHeightClass="min-h-screen"
    />
  );
}
