// tests/ward-service-panel-note.dom.test.tsx
//
// D-e (Ward Lead's decisions, 2026-09-17, amending build plan `docs/ward-flow/plans/
// 2026-09-17-build-plan-screens.md` §2/§3 item 44, after an Opus adversarial review, R1): the
// Service panel's own note in `shell/ward-bar.tsx` must name only the screens that actually read
// the service choice, taken from ONE exported list, `SERVICE_SCOPED_SCREENS`
// (`ward-service-scope.ts`) — never a hand-written sentence that can drift from what the code
// actually does, the way the build plan's own §3 wording already had before this task ("Command,
// Capacity, Delays, Movements and Referrals" while neither Command nor Referrals read the store).
// TEST 6.

import type { ReactNode } from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Same mocking idiom `tests/ward-shell-third-edition.dom.test.tsx` already establishes for
// mounting `WardBar` outside `layout.tsx`: it renders next/link anchors and reads the route via
// next/navigation, neither of which jsdom can supply without an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { SERVICE_SCOPED_SCREENS } from "@/components/ward-management/ward-service-scope";

function renderBar() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar />
    </WardFlowProvider>,
  );
}

describe("Service panel note names exactly SERVICE_SCOPED_SCREENS (D-e, TEST 6)", () => {
  it("has at least two screens to prove this isn't vacuous", () => {
    expect(SERVICE_SCOPED_SCREENS.length).toBeGreaterThan(1);
  });

  it("lists every screen in SERVICE_SCOPED_SCREENS and drops 'and each says so'", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));

    const panel = screen.getByTestId("ward-bar-service-panel");
    // The note now lives on the "scopes the lists" hint as its tooltip (owner request, 9 Oct 2026).
    const text = within(panel).getByText("scopes the lists").getAttribute("title") ?? "";

    for (const name of SERVICE_SCOPED_SCREENS) {
      expect(text, `note does not name ${name}, a member of SERVICE_SCOPED_SCREENS`).toContain(name);
    }
    // R1's own finding: the OLD hand-written sentence named "Command" and "Referrals", neither of
    // which reads the service choice in this codebase. Both are absent from SERVICE_SCOPED_SCREENS
    // today — this pins that the note no longer claims either one narrows its own lists.
    expect(SERVICE_SCOPED_SCREENS).not.toContain("Command");
    expect(SERVICE_SCOPED_SCREENS).not.toContain("Referrals");
    expect(text, "the note must not still claim Command narrows its lists").not.toMatch(/\bCommand\b narrow/);
    expect(text, "the note must not still claim Referrals narrows its lists").not.toContain("Referrals narrow");

    expect(text, "D-e drops the second, unverifiable claim 'and each says so'").not.toContain("each says so");
  });
});
