import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The referral slide-out is the one place a referral is written (Josh, 8 Oct 2026). Every link to
 * `/ward-flow/referrals/new` — the patient page's Refer, the board's New referral, a search
 * preview — opens the slide-out in place, and arriving on that route opens it over the board.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";

function DirtyPage() {
  useDirtyStateGuard({ isDirty: true, confirmMessage: "Keep the other form open?" });
  return null;
}

function renderBarWith(children?: ReactNode) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar primaryAction={{ kind: "none" }} />
      {children}
    </WardFlowProvider>,
  );
}

afterEach(() => {
  resetWardLiveRegionForTests();
  discardReferralDraft();
  route.pathname = "/ward-flow";
  replace.mockReset();
  window.history.replaceState(null, "", "/");
  resetServiceScopeForTests();
});

describe("a link to the referral route opens the slide-out in place", () => {
  it.each(["indexed", "legacy"])(
    "allows retrying a %s drawer history close after another dirty form cancels",
    async (entry) => {
      renderBarWith(<DirtyPage />);
      fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
      const tools = await screen.findByRole("dialog", { name: "Tools" });
      const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
      const go = vi.spyOn(window.history, "go").mockImplementation(() => {
        fireEvent.popState(window, { state: window.history.state });
      });
      const back = vi.spyOn(window.history, "back").mockImplementation(() => {
        fireEvent.popState(window, {
          state:
            entry === "indexed"
              ? { ...window.history.state, __wfHistoryIndex: window.history.state.__wfHistoryIndex - 1 }
              : null,
        });
      });
      try {
        fireEvent.click(within(tools).getByRole("button", { name: /^Close$/ }));
        expect(back).toHaveBeenCalledTimes(1);
        expect(confirm).toHaveBeenCalledTimes(1);
        expect(confirm).toHaveBeenLastCalledWith("Keep the other form open?");
        if (entry === "indexed") expect(go).toHaveBeenCalledWith(1);
        else expect(go).not.toHaveBeenCalled();
        expect(tools).toBeInTheDocument();
        expect(document.documentElement.style.overflowY).toBe("hidden");

        fireEvent.click(within(tools).getByRole("button", { name: /^Close$/ }));
        expect(back).toHaveBeenCalledTimes(2);
        expect(confirm).toHaveBeenCalledTimes(2);
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tools" })).toBeNull());
      } finally {
        back.mockRestore();
        go.mockRestore();
        confirm.mockRestore();
      }
    },
  );

  it("keeps the chosen-service announcement after the pending history close", async () => {
    renderBarWith();
    fireEvent.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = await screen.findByTestId("ward-bar-service-panel");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    try {
      fireEvent.click(within(panel).getByRole("button", { name: /^East Metro\b/ }));
      expect(back).toHaveBeenCalledOnce();
      expect(screen.getByTestId("ward-live-region")).toHaveTextContent("Service set to East Metro.");
      window.history.replaceState(null, "");
      fireEvent.popState(window);
      await waitFor(() => expect(screen.queryByTestId("ward-bar-service-panel")).toBeNull());
      expect(screen.getByTestId("ward-live-region")).toHaveTextContent("Service set to East Metro.");
    } finally {
      back.mockRestore();
    }
  });

  it("keeps the sheet locked until its history step closes, before allowing another drawer", async () => {
    renderBarWith();
    fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
    const tools = await screen.findByRole("dialog", { name: "Tools" });
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    try {
      fireEvent.click(within(tools).getByRole("button", { name: /^Close$/ }));
      expect(back).toHaveBeenCalledOnce();
      expect(tools).toBeInTheDocument();
      expect(document.documentElement.style.overflowY).toBe("hidden");

      window.history.replaceState(null, "");
      fireEvent.popState(window);
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tools" })).toBeNull());
      fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
      await screen.findByRole("dialog", { name: "Tools" });
      expect(window.history.state.wardDrawer).toBe("tools");
    } finally {
      back.mockRestore();
    }
  });

  it("opens the referral sheet and does not navigate", async () => {
    renderBarWith(<a href="/ward-flow/referrals/new?patientId=PT-001&source=community&refer=community">Refer</a>);
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();

    const link = screen.getByRole("link", { name: "Refer" });
    const notPrevented = fireEvent.click(link);

    // `fireEvent` returns false when a handler called preventDefault: the browser follows nothing.
    expect(notPrevented, "the click still navigates").toBe(false);
    const sheet = await screen.findByTestId("ward-bar-referral-sheet");
    expect(within(sheet).getByTestId("ward-referral-refer-to-community")).toHaveAttribute("aria-pressed", "true");
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves a modified click (new tab) and every other link alone", () => {
    renderBarWith(
      <>
        <a href="/ward-flow/referrals/new">New referral</a>
        <a href="/ward-flow/referrals">Referrals</a>
      </>,
    );

    expect(fireEvent.click(screen.getByRole("link", { name: "New referral" }), { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(screen.getByRole("link", { name: "Referrals" }))).toBe(true);
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
  });
});

describe("arriving on the referral route opens the slide-out over the board", () => {
  it("opens once with what the query asks for, and settles the URL on the board when closed", async () => {
    route.pathname = "/ward-flow/referrals/new";
    window.history.replaceState(null, "", "/ward-flow/referrals/new?refer=ed");
    renderBarWith();

    const sheet = await screen.findByTestId("ward-bar-referral-sheet");
    expect(within(sheet).getByTestId("ward-referral-refer-to-ed")).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    await waitFor(() => expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull());
    expect(replace).toHaveBeenCalledWith("/ward-flow/referrals");
  });
});
