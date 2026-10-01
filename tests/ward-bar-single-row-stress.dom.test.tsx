import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/mockups/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { WardBar, WardBarMount } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import type { WardPrimaryAction } from "@/components/ward-management/shell/ward-shell-types";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_NEW_REFERRAL_MENU } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const BAR_CSS_PATH = "src/components/ward-management/shell/ward-bar.module.css";

function renderBar(primaryAction?: WardPrimaryAction) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar primaryAction={primaryAction} />
    </WardFlowProvider>,
  );
}

describe("WardBar Single-Row Stress Test & CSS Contracts", () => {
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  afterEach(() => {
    resetWardLiveRegionForTests();
  });

  describe("CSS Architecture & Single-Row Guarantee", () => {
    const css = readFileSync(BAR_CSS_PATH, "utf8");

    it("pins .bar to single-row flex-wrap: nowrap", () => {
      expect(css).toMatch(/\.bar\s*\{[^}]*flex-wrap:\s*nowrap\s*!important/u);
      expect(css).not.toMatch(/\.bar\s*\{[^}]*flex-wrap:\s*wrap\b/u);
    });

    it("locks .bar height to 3.5rem", () => {
      expect(css).toMatch(/\.bar\s*\{[^}]*height:\s*3\.5rem/u);
      expect(css).toMatch(/\.bar\s*\{[^}]*min-height:\s*3\.5rem/u);
    });

    it("contains no breaking 100% width or multi-row order on centerGroup in media queries", () => {
      expect(css).not.toMatch(/\.centerGroup\s*\{[^}]*flex:\s*1\s+0\s+100%/u);
      expect(css).not.toMatch(/\.drawerTriggers,\s*\.primaryWrap,\s*\.primary\s*\{[^}]*order:\s*3/u);
    });

    it("hides .primaryPrefix and capitalizes .primaryMain", () => {
      expect(css).toMatch(/\.primaryPrefix\s*\{[^}]*display:\s*none/u);
      expect(css).toMatch(/\.primaryMain\s*\{[^}]*text-transform:\s*capitalize/u);
    });

    it("ensures drawerTrigger and serviceTrigger meet the 48px tap-target floor", () => {
      expect(css).toMatch(/\.drawerTrigger\s*\{[^}]*min-height:\s*var\(--spacing-tap/u);
      expect(css).toMatch(/\.drawerTrigger\s*\{[^}]*min-width:\s*var\(--spacing-tap/u);
    });

    it("ensures primary action meets the 48px tap-target floor", () => {
      expect(css).toMatch(/\.primary\s*\{[^}]*min-height:\s*var\(--spacing-tap/u);
      expect(css).toMatch(/\.primary\s*\{[^}]*min-width:\s*var\(--spacing-tap/u);
    });

    it("drops demoTime and hides triggerLabel in responsive media tiers", () => {
      expect(css).toMatch(/@media\s*\(max-width:\s*1360px\)\s*\{[\s\S]*?\.demoTime\s*\{[^}]*display:\s*none/u);
      expect(css).toMatch(/@media\s*\(max-width:\s*1360px\)\s*\{[\s\S]*?\.triggerLabel\s*\{[^}]*clip-path/u);
    });

    it("drops barClockPill on compact screens (<= 1050px)", () => {
      expect(css).toMatch(/@media\s*\(max-width:\s*1050px\)\s*\{[\s\S]*?\.barClockPill\s*\{[^}]*display:\s*none/u);
    });
  });

  describe("Interactive Stress Testing: Referral & Drawers", () => {
    it("renders Referral primary action with prefix hidden and exact text available", () => {
      renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });
      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveTextContent("New referral");
      expect(within(trigger).getByText("referral")).toBeInTheDocument();
      expect(within(trigger).getByText("New")).toBeInTheDocument();
    });

    it("opens Referral menu with all three destinations and closes on Escape", async () => {
      const user = userEvent.setup();
      renderBar({ kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU });

      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();

      await user.click(trigger);
      const panel = screen.getByTestId("ward-bar-primary-panel");
      expect(panel).toBeInTheDocument();

      expect(screen.getByTestId("ward-bar-primary-menu-community")).toHaveTextContent("Community Referral");
      expect(screen.getByTestId("ward-bar-primary-menu-ed_medical")).toHaveTextContent("ED Referral");
      expect(screen.getByTestId("ward-bar-primary-menu-inter_hospital")).toHaveTextContent("Ward Referral");

      await user.keyboard("{Escape}");
      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();
      expect(trigger).toHaveFocus();
    });

    it("opens and closes Activity drawer correctly", async () => {
      const user = userEvent.setup();
      renderBar();

      const activityBtn = screen.getByTestId("ward-bar-activity-trigger");
      expect(screen.queryByTestId("ward-bar-activity-sheet")).toBeNull();

      await user.click(activityBtn);
      expect(screen.getByTestId("ward-bar-activity-sheet")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByTestId("ward-bar-activity-sheet")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(activityBtn);
      });
    });

    it("opens and closes Tasks drawer correctly", async () => {
      const user = userEvent.setup();
      renderBar();

      const tasksBtn = screen.getByTestId("ward-bar-tasks-trigger");
      expect(screen.queryByTestId("ward-bar-tasks-sheet")).toBeNull();

      await user.click(tasksBtn);
      expect(screen.getByTestId("ward-bar-tasks-sheet")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByTestId("ward-bar-tasks-sheet")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(tasksBtn);
      });
    });

    it("opens and closes Tools drawer correctly", async () => {
      const user = userEvent.setup();
      renderBar();

      const toolsBtn = screen.getByTestId("ward-bar-tools-trigger");
      expect(screen.queryByTestId("ward-bar-tools-sheet")).toBeNull();

      await user.click(toolsBtn);
      expect(screen.getByTestId("ward-bar-tools-sheet")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByTestId("ward-bar-tools-sheet")).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(toolsBtn);
      });
    });

    it("renders unwired primary action kinds properly and responds to clicks", async () => {
      const user = userEvent.setup();
      renderBar({ kind: "record-decision", label: "Record a decision" });

      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveTextContent("Record a decision");
      expect(trigger.tagName).toBe("BUTTON");

      await user.click(trigger);
      expect(screen.getByTestId("ward-bar-primary-panel")).toHaveTextContent("Not wired in this prototype.");

      await user.keyboard("{Escape}");
      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();
    });

    it("renders no primary action when kind is none or absent", () => {
      renderBar({ kind: "none" });
      expect(screen.queryByTestId("ward-bar-primary-action")).toBeNull();
    });

    it("WardBarMount resolves coordinator route to Referral action", () => {
      route.pathname = "/mockups/ward-flow";
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardLiveRegion />
          <WardBarMount />
        </WardFlowProvider>,
      );

      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveTextContent("New referral");
      expect(within(trigger).getByText("referral")).toBeInTheDocument();
    });
  });
});
