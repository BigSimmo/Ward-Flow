"use client";

import { Component, type ReactNode } from "react";
import { StateLine } from "./state";

type PanelBoundaryProps = {
  children?: ReactNode;
  /** What the section is, for the error line ("Transport could not be shown"). Defaults to "This section". */
  label?: string;
  /** A new value clears a caught error, so switching tab or record tries the panel again. */
  resetKey?: unknown;
};

type PanelBoundaryState = { failed: boolean; resetKey: unknown };

/**
 * Tier 1 item 5 (Josh, 4 Nov 2026): one broken panel cannot blank the whole screen. A render throw
 * inside a card body or tab panel stops here, and only that section shows an error line with Try
 * again. The page, its header and every other panel keep working. The route `error.tsx` boundaries
 * still catch anything outside a panel.
 *
 * The console line names the section and the error type only, never the message, which can carry
 * record content. Render throws only: event handlers and async work still report their own errors.
 */
export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
  state: PanelBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<PanelBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: PanelBoundaryProps, state: PanelBoundaryState) {
    return Object.is(props.resetKey, state.resetKey) ? null : { failed: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown) {
    const type = error instanceof Error ? error.name : typeof error;
    console.error(`Ward Flow panel failed: ${this.props.label ?? "section"} (${type})`);
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <StateLine
        kind="error"
        compact
        title={`${this.props.label ?? "This section"} could not be shown`}
        reason="The rest of the page still works."
        action={{ label: "Try again", onAction: this.retry }}
        data-testid="wf-panel-error"
      />
    );
  }
}
