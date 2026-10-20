/**
 * Calls `onRevealed` once the server-streamed route content is on the page.
 *
 * Why this exists: Next streams a route's page behind its `loading.tsx` Suspense boundary. React
 * 19.2+ does not reveal that content straight away; it marks the boundary pending (`$~`) and
 * reveals a batch on the next animation frame. If any context ABOVE that boundary changes while it
 * is still pending, React cannot hydrate it and client-renders a second copy of the page beside
 * the hidden streamed one until the reveal removes it (`updateDehydratedSuspenseComponent`). The
 * ward provider's mount-time clock adoption is such a change, so it waits for this.
 *
 * Pending boundaries are the Fizz comments `$?` (not yet completed) and `$~` (completed, reveal
 * queued). Gives up waiting after `maxWaitMs` so adoption can never be lost.
 */
export function whenStreamRevealed(onRevealed: () => void, maxWaitMs = 2000): () => void {
  const startedAt = Date.now();
  let frame = 0;
  const check = () => {
    if (!hasPendingStreamedBoundary() || Date.now() - startedAt >= maxWaitMs) {
      frame = 0;
      onRevealed();
      return;
    }
    frame = requestAnimationFrame(check);
  };
  check();
  return () => {
    if (frame) cancelAnimationFrame(frame);
  };
}

function hasPendingStreamedBoundary(): boolean {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    if (data === "$?" || data === "$~") return true;
  }
  return false;
}
