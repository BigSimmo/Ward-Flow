"use client";

import { Component, type ReactNode } from "react";

type NextShellBoundaryProps = {
  children?: ReactNode;
  /** The part this guards, for the line and the console ("The sidebar", "The top bar"). */
  label: string;
};

/**
 * TE-06 (front-end audit, 5 Nov 2026; Josh, 6 Nov 2026: "Trim first, then add it"). The route
 * `error.tsx` cannot wrap the layout beside it, so a render throw in the sidebar or the top bar used
 * to reach `src/app/error.tsx` and take the whole ward away. `layout.tsx` wraps each of the two in
 * this boundary instead: the broken part shows one short line with Reload page, and the page and
 * the other part keep working.
 *
 * ⚠️ **WHY THIS IS NOT `PanelBoundary` (`@/components/wf/panel-boundary`).** That one draws the kit's
 * `StateLine` and `Button`, and putting it in the layout pulled their shared kit chunk (about 38 KB
 * gzipped) onto every screen's first load (#1487). This boundary imports nothing but React and
 * draws plain markup. Its look lives in `ward-flow-layout.module.css` under `[data-wf-shell-error]`,
 * an attribute rather than a class, so the layout's class map that ships to the browser does not
 * grow either.
 *
 * Reload, not Try again: re-rendering the same world usually throws again, and reloading re-seeds
 * it (the same reading as `ward-flow-error-panel.tsx`). The console line names the part and the
 * error type only, never the message, which can carry record content. Render throws only.
 */
export class NextShellBoundary extends Component<NextShellBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(
      `Ward Flow shell failed: ${this.props.label} (${error instanceof Error ? error.name : typeof error})`,
    );
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="status" data-wf-shell-error="" data-testid="ward-shell-error" data-print-hide>
        <span>{this.props.label} could not load.</span>
        <button type="button" onClick={() => location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
