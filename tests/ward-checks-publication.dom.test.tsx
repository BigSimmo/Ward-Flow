import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// The bar reads the route and router, which jsdom cannot supply without an App Router context —
// the same idiom as `tests/ward-shell-third-edition.dom.test.tsx`.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/movements",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { resetWardChecksForTests } from "@/components/ward-management/shell/ward-checks";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * **OWNER DECISION O-9 — a screen tells the shell what it reconciled, end to end.**
 *
 * 🔴 **THE PROPERTY THAT MATTERS IS NOT "IT PUBLISHES". IT IS THAT THREE STATES STAY THREE.**
 * Before O-9, *no screen has published* and *this screen published an empty list* were the same
 * empty array and rendered identically, and owner ruling D-40 exists because the second of those
 * must never read as agreement. **A union cannot be flattened by `??`; an array can.**
 *
 * ⚠️ **These render the REAL shell against the REAL screen.** A test that called the store directly
 * would prove the store works and nothing about whether the shell is wired to it — which is the half
 * that was missing for the entire life of this mechanism's design.
 *
 * 7 October 2026, v6 rail (header and sidebar boards 02, 03 and 03b): the rail no longer carries
 * the reconciliation line, so a published check now surfaces in one place, the Activity drawer's
 * "Figure checks" disclosure (`ward-bar-figure-checks`). These four cases keep the same contract —
 * nothing published, published by a mounted screen, cleared when that screen unmounts — and each
 * also pins that the rail itself makes no reconciliation claim in either shape.
 */
afterEach(() => {
  resetWardChecksForTests();
});

function renderShellAlone() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardRail />
      <WardBar />
    </WardFlowProvider>,
  );
}

function renderShellBelowScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardRail />
      <WardBar />
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

async function openActivity() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId("ward-bar-activity-trigger"));
  return screen.findByRole("dialog", { name: /Activity/ });
}

function expectRailMakesNoClaim() {
  expect(screen.queryByTestId("ward-reconciliation-line")).not.toBeInTheDocument();
  expect(screen.getByTestId("ward-rail").textContent ?? "").not.toMatch(/reconcil/i);
}

describe("a ward screen publishes its checks upward to the shell", () => {
  it("shows no figure-check claim when no screen has published checks", async () => {
    renderShellAlone();
    expectRailMakesNoClaim();
    const dialog = await openActivity();
    expect(within(dialog).queryByTestId("ward-bar-figure-checks")).not.toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toMatch(/reconcil/i);
  });

  it("makes no reconciliation claim in the collapsed rail either", () => {
    window.localStorage.setItem("ward-flow-rail", "closed");
    try {
      renderShellAlone();
      expectRailMakesNoClaim();
      const titled = [...screen.getByTestId("ward-rail").querySelectorAll("[title]")].filter((element) =>
        /reconcil/i.test(element.getAttribute("title") ?? ""),
      );
      expect(titled).toHaveLength(0);
    } finally {
      window.localStorage.removeItem("ward-flow-rail");
    }
  });

  /**
   * 🔴 **THE ASSERTION THE WHOLE MECHANISM EXISTS FOR.** A fact travels BETWEEN SIBLINGS (the
   * screen and the shell) through a module store; siblings cannot pass props in either direction.
   */
  it("reflects the screen's own check once that screen is mounted", async () => {
    renderShellBelowScreen();
    expectRailMakesNoClaim();
    const dialog = await openActivity();
    const checks = within(dialog).getByTestId("ward-bar-figure-checks");
    expect(
      checks.textContent ?? "",
      "Activity shows no published figure check while a screen that publishes is on the page — the " +
        "screen and the shell are not connected",
    ).toMatch(/Figure checks · (\d+) of \1 reconcile/u);
  });

  /**
   * ⚠️ **THE CLEARING HALF, AND IT IS THE ONE THAT KEEPS THE SHELL HONEST.** Without it a screen's
   * passing claim would stand on the NEXT route. **A stale TRUE claim is worse than no claim: it is
   * the shape nobody checks.**
   */
  it("stops claiming the screen's reconciliation once that screen unmounts", async () => {
    const { unmount } = renderShellBelowScreen();
    const first = await openActivity();
    expect(within(first).getByTestId("ward-bar-figure-checks")).toBeInTheDocument();
    unmount();

    renderShellAlone();
    const dialog = await openActivity();
    expect(within(dialog).queryByTestId("ward-bar-figure-checks")).not.toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toMatch(/reconcil/i);
  });
});
