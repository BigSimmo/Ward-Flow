"use client";

import { useEffect, useRef } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/wf";

import styles from "./ward-flow-error-panel.module.css";
import { isChunkLoadError, useReloadWhenOnline } from "@/components/ward-management/ward-chunk-load-error";

/**
 * PREVIEW FORK of `src/app/ward-flow/ward-flow-error-panel.tsx` (the state-error mock-up). The logic
 * and every word are the original's; the look moves from the host app's Tailwind tokens onto the
 * Ward Flow `--wf-*` tokens and the wf kit `Button` (one filled action, Try again). Two preview-only
 * changes are marked below: no console line (nothing really failed) and a `showDetail` prop.
 * Round 2 polish: the kit's ringed icon mark, the fixed sentence in the body font (mono stays for
 * a real message or reference), and the two buttons side by side on a desktop.
 *
 * THE RECOVERY PANEL EVERY WARD FLOW `error.tsx` RENDERS, WRITTEN ONCE.
 *
 * ⚠️ **WHY THIS IS NOT `@/components/route-error-boundary`.** The repository has a shared boundary
 * panel and twenty `error.tsx` files delegate to it, so importing it here was the obvious move and
 * it is the wrong one: `tests/ward-flow-seam.test.ts` holds Ward Flow's outward dependencies at a
 * ceiling of SEVEN approved shared modules, with a canary asserting that list is exactly seven
 * long. That ceiling is the bill for ever extracting this prototype from its host, and its own
 * header says an eighth entry is a decision to be argued rather than a number to be re-baselined.
 * Buying a boundary with a permanent widening of the extraction seam is not a trade this task gets
 * to make on its own, so the panel is duplicated here instead — deliberately, and at the cost of
 * two copies of the same markup drifting apart. `@/components/ui-primitives` IS on the approved
 * list, so the buttons still come from the repository's own controls.
 *
 * ⚠️ **IT MUST NOT SWALLOW THE ERROR.** A boundary that renders "something went wrong" and logs
 * nothing turns a loud failure into a silent one, which is worse than the blanked page it replaces
 * — and it looks like a fix. Three things therefore always happen: the error object goes to
 * `console.error` (so the stack is in the browser console in every environment), the message is
 * rendered on screen, and the stack is put behind a disclosure in development.
 *
 * ⚠️ **THE MESSAGE IS SHOWN ONLY OUTSIDE PRODUCTION.** Audit 5 PS-05: a guard can quote part of
 * the failing record in its message, and the signed-in shared site is a production build, so there
 * the panel shows a fixed sentence and the digest instead. The full error is still in the console.
 *
 * ⚠️ **"TRY AGAIN" IS HONEST BUT LIMITED, AND THE COPY SAYS SO.** `retry()` re-renders this
 * segment; it does not re-create `WardFlowProvider`, which lives in the layout ABOVE every boundary
 * here and therefore survives. So a guard that throws deterministically on the current world will
 * throw again immediately. That is why "Reload page" is offered beside it: reloading re-seeds the
 * whole prototype, which is the only control on this panel that can actually change the outcome.
 */
export function WardFlowErrorPanel({
  error,
  retry,
  title,
  description,
  logLabel,
  testId,
  showDetail = process.env.NODE_ENV !== "production",
}: {
  /** The error thrown below this boundary, forwarded by Next. */
  error: Error & { digest?: string };
  /**
   * Next 16's `retry` — NOT the older `reset`. Same reading as
   * `src/app/caring-contacts/error.tsx`: `retry()` re-fetches and re-renders, `reset()` only clears
   * the error state, and a button reading "Try again" should do the former.
   */
  retry: () => void;
  title: string;
  description: string;
  /** Prefix on the console line, so a reader can tell which boundary caught it. */
  logLabel: string;
  testId: string;
  /** Preview only: the mock-up shows what the signed-in shared site (a production build) shows. */
  showDetail?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Design re-score DR-01: a script or style file that failed because the connection dropped gets
  // the connection message, and the page reloads once by itself when the connection returns.
  const chunkFailure = isChunkLoadError(error);
  const online = useReloadWhenOnline(chunkFailure);
  const shownTitle = chunkFailure ? (online ? "Part of this page did not load" : "You are offline") : title;
  const shownDescription = !chunkFailure
    ? description
    : online
      ? "The connection dropped while the page was loading. Reload the page to finish loading it. Nothing was changed."
      : "The connection dropped while the page was loading. This page will reload by itself when the connection returns. Nothing was changed.";

  useEffect(() => {
    // Preview only: the real panel sends the whole error object to `console.error` here. Nothing
    // failed in the mock-up, so it is not logged; `logLabel` is kept so the props match.
    void logLabel;
    headingRef.current?.focus({ preventScroll: true });
  }, [error, logLabel]);

  return (
    <div className={styles.wrap} data-testid={testId}>
      <p className={styles.notice} data-testid="ward-flow-error-synthetic-notice">
        This is a synthetic prototype. Nothing behind this message is a real patient, bed or service, and nothing was
        changed by the failure.
      </p>

      <div className={styles.panel}>
        <span className={styles.mark}>
          <TriangleAlert aria-hidden="true" size={22} />
        </span>

        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          {shownTitle}
        </h1>

        <p role="alert" className={styles.description}>
          {shownDescription}
        </p>

        {/* The message itself outside production; there, the console and the digest carry it. A real
            message stays in mono; the fixed sentence is prose, in the body font with no box. */}
        {showDetail ? (
          <pre className={styles.message} data-testid="ward-flow-error-message">
            {error.message || "The error carried no message."}
          </pre>
        ) : (
          <p className={styles.fixed} data-testid="ward-flow-error-message">
            {`The details are kept out of view so nothing from a record is shown here. ${
              error.digest
                ? "Quote the error reference below when you report this."
                : "When you report this, say which screen you were on and the time."
            }`}
          </p>
        )}

        {error.digest && (
          <p className={styles.digest} data-testid="ward-flow-error-digest">
            Error reference: {error.digest}
          </p>
        )}

        {showDetail && error.stack && (
          <details className={styles.stack} data-testid="ward-flow-error-stack">
            <summary>Stack trace (development only)</summary>
            <pre>{error.stack}</pre>
          </details>
        )}

        <div className={styles.actions}>
          <Button variant="pri" icon={RefreshCw} onClick={() => retry()} data-testid="ward-flow-error-retry">
            Try again
          </Button>
          <Button variant="sec" onClick={() => window.location.reload()} data-testid="ward-flow-error-reload">
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
