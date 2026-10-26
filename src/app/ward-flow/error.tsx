"use client";

import { WardFlowErrorPanel } from "./ward-flow-error-panel";

/**
 * THE WARD FLOW BOUNDARY. Before this file existed there was none anywhere under
 * `ward-flow/`, so every throw below fell through to `src/app/error.tsx` — the application
 * shell's boundary, which replaces the whole document with the host app's generic panel. One wrong
 * record took the ward away and said nothing about which record it was.
 *
 * ⚠️ **EXACTLY WHAT THIS COVERS — read from the route tree, not assumed.** An `error.tsx` wraps its
 * own segment's `page`, its nested layouts, and every segment below it that has no nearer boundary
 * (Next 16 `file-conventions/error.md`). There is one nearer boundary, `statistics/error.tsx`, so
 * this file catches render throws on every `ward-flow/**` page except the `statistics/**` routes,
 * which belong to the nearer boundary. List the route tree rather than trusting a count here.
 *
 * ⚠️ **WHAT IT CANNOT COVER, AND NO BOUNDARY PLACED UNDER THIS FOLDER COULD.** `error.tsx` does not
 * wrap the `layout.tsx` sitting beside it in the same segment. `ward-flow/layout.tsx` renders
 * `WardFlowProvider`, and the provider seeds the whole world in its `useReducer` initialiser — so a throw out of
 * `seedWardFlowStateAt` escapes this boundary and lands on `src/app/error.tsx`, exactly as before.
 * Worse, `ward-movements.ts` builds its seeded movements at MODULE scope
 * (`export const wardMovements = [...]`), which routes the "unhandled movement stage" guard through
 * module evaluation rather than through any render: no React error boundary can catch that at all.
 * The provider-seed throw is caught by the app root's boundary, `src/app/error.tsx`, because
 * `ward-flow/layout.tsx` sits directly under the app root; the module-scope throw is caught by none.
 *
 * ⚠️ **THE ON-SCREEN RESULT REPLACES `{children}` INSIDE THE WARD SHELL.** `ward-flow/layout.tsx`
 * renders `WardRail` and `WardBarMount` around `{children}`, so the navigation rail and top bar
 * remain mounted while `WardFlowErrorPanel` fills `.shellContent` for the failing route segment.
 */
export default function WardFlowErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <WardFlowErrorPanel
      error={error}
      retry={retry}
      title="This ward screen could not be shown"
      // Design audit DA-32: the old text promised nothing was lost, then warned that changes might be.
      description="Try again keeps the same prototype state. Reloading may restore the last saved synthetic data; anything not yet saved may be lost."
      logLabel="Unhandled runtime error captured by the Ward Flow boundary:"
      testId="ward-flow-error-boundary"
    />
  );
}
