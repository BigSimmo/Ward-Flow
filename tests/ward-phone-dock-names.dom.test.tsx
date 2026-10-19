// F-19 (WCAG 2.5.3, label in name): each phone dock control's accessible name starts with the
// words it shows, the badge and then the label ("7 Referrals"), so a voice command can say what
// it sees.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { WardPhoneMenu } from "@/components/ward-management/shell/ward-phone-menu";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

function renderDock(tasksCount: number, activityUnread: number) {
  installMatchMediaStub(true);
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPhoneMenu
          returnFocusRef={createRef<HTMLButtonElement>()}
          tasksCount={tasksCount}
          activityUnread={activityUnread}
          onOpenDrawer={() => {}}
          onNewReferral={() => {}}
        />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

/** The words a control shows, in order, one space between each piece of text. */
function shownWords(element: HTMLElement): string {
  return Array.from(element.querySelectorAll("span"))
    .filter((span) => span.children.length === 0 && !span.closest("[aria-hidden='true']"))
    .map((span) => span.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

afterEach(() => {
  installMatchMediaStub(false);
});

describe("phone dock names (F-19)", () => {
  // The bed coordinator's dock carries Alerts in place of Tasks (D-61).
  it("starts Alerts and Activity with their word, then the badge", () => {
    renderDock(12, 3);
    expect(screen.getByTestId("ward-phone-menu-alerts")).toHaveAccessibleName("Alerts, 12 outstanding");
    expect(screen.getByTestId("ward-phone-menu-activity")).toHaveAccessibleName("Activity, 3 unread");
  });

  it("keeps the plain word when there is no badge", () => {
    renderDock(0, 0);
    expect(screen.getByTestId("ward-phone-menu-alerts")).toHaveAccessibleName("Alerts, 0 outstanding");
    expect(screen.getByTestId("ward-phone-menu-activity")).toHaveAccessibleName("Activity");
  });

  it("starts every dock link's name with what the link shows", () => {
    renderDock(0, 0);
    const links = screen.getAllByTestId("ward-phone-dock-link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      // Named by its content, not an aria-label, so the name cannot drift from the screen.
      expect(link.hasAttribute("aria-label")).toBe(false);
      // The first word on screen: the visible label (the count chip is hidden from the name).
      const shown = shownWords(link).split(" ")[0] ?? "";
      expect(shown.length).toBeGreaterThan(0);
      expect(link).toHaveAccessibleName(new RegExp(`^${shown.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
  });
});
