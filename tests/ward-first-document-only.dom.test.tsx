import { Fragment, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The ward layout's early scripts sit inside WardFlowProvider's keyed screen Fragment. A restored
// saved day or a shared sign-in changes that key, remounting the shell on the client, and React then
// logs "Encountered a script tag while rendering React component" (Next's dev "1 Issue" badge).

const SCRIPT_WARNING = /Encountered a script tag while rendering React component/;

function Shell({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  return <Fragment key={screenKey}>{children}</Fragment>;
}

const earlyScript = <script data-testid="early" dangerouslySetInnerHTML={{ __html: "void 0" }} />;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("WardFirstDocumentOnly", () => {
  it("shows the problem: a bare script remounted on the client warns", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(<Shell screenKey="seed">{earlyScript}</Shell>);
    view.rerender(<Shell screenKey="restored">{earlyScript}</Shell>);
    expect(error.mock.calls.some(([message]) => SCRIPT_WARNING.test(String(message)))).toBe(true);
  });

  it("renders the script on first mount and nothing on a later remount, without the warning", async () => {
    const { WardFirstDocumentOnly } = await import("@/components/ward-management/shell/ward-first-document-only");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = <WardFirstDocumentOnly>{earlyScript}</WardFirstDocumentOnly>;
    const view = render(<Shell screenKey="seed">{wrapped}</Shell>);
    expect(view.queryByTestId("early")).not.toBeNull();
    error.mockClear();
    view.rerender(<Shell screenKey="restored">{wrapped}</Shell>);
    expect(view.queryByTestId("early")).toBeNull();
    expect(error.mock.calls.some(([message]) => SCRIPT_WARNING.test(String(message)))).toBe(false);
  });
});
