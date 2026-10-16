import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: next/link needs an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * F-17 (phone PWA review, Oct 2026): iPhone Safari starts a download after `click()` returns, so a
 * file link revoked straight away can cancel the CSV. The link is now revoked a second later.
 */
describe("CSV export keeps its file link long enough to download", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("community team list: revokes the link after a delay, not at the click", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:ward-flow/team-list");
    const revoke = vi.fn();
    // A stand-in URL class, so the real one is left untouched for other suites.
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CommunityIndex />
      </WardFlowProvider>,
    );
    // The desktop export sits in the catchment guide's Actions.
    fireEvent.click(screen.getByTestId("community-action-catchment-guide"));
    fireEvent.click(screen.getByRole("button", { name: /Export team list/ }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith("blob:ward-flow/team-list");
  });
});
