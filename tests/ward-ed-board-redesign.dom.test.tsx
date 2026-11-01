import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ed/peel-ed",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The access card loads lazily for the phone budget; a stand-in shows only whether the page asks for it.
vi.mock("@/components/ward-management/forecast/forecast-lazy", () => ({
  EdAccessRiskCard: () => <div data-testid="ed-access-risk-card-stand-in" />,
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ED board redesign (Josh, 30 and 31 Oct 2026). Synthetic seed only.
 * - The ED desk gets no access forecast card, no hero Raise referral and no department strip.
 * - On the larger screen the Lists are one open card with three lists (handover build, 1 Nov 2026).
 * - The links to other pages are one footer line, each link's description its tooltip.
 */
const ED_DESK: WardAccess = { role: "ed", scope: { kind: "ed", edId: "peel-ed" } };

function renderEd() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId="peel-ed" />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
});

describe("ED board redesign", () => {
  it("keeps the access card, Raise referral and the department strip for the coordinator", () => {
    renderEd();
    expect(screen.getByTestId("ed-access-risk-card-stand-in")).toBeInTheDocument();
    expect(screen.getByTestId("ward-ed-raise-referral-toggle")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Emergency departments" })).toBeInTheDocument();
  });

  it("leaves the access card, the hero's Raise referral and the strip off the ED desk", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess(ED_DESK));
    renderEd();
    expect(screen.getByTestId("ward-ed-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("ed-access-risk-card-stand-in")).toBeNull();
    expect(screen.queryByTestId("ward-ed-raise-referral-toggle")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Emergency departments" })).toBeNull();
    // Add patient keeps its place (P142).
    expect(screen.getAllByTestId("ward-ed-add-patient")[0]).toHaveAttribute("href", "/ward-flow/people/new");
  });

  it("shows the Lists as one open card with three lists (handover build, 1 Nov 2026)", () => {
    renderEd();
    expect(screen.queryByTestId("ward-ed-lists-fold")).toBeNull();
    const lists = screen.getByRole("region", { name: /^Lists/u });
    const tabs = within(lists)
      .getAllByRole("radio")
      .map((tab) => tab.textContent ?? "");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toMatch(/^Awaiting review/u);
    expect(tabs[1]).toMatch(/^Expected/u);
    expect(tabs[2]).toMatch(/^Forms/u);
  });

  it("puts the links to other pages on one footer line, each description its tooltip", () => {
    renderEd();
    const foot = screen.getByTestId("ward-ed-elsewhere");
    const capacity = within(foot).getByRole("link", { name: "Statewide capacity" });
    expect(capacity).toHaveAttribute("href", "/ward-flow/capacity");
    expect(capacity).toHaveAttribute("title", "Every unit's beds, on the Capacity page");
    expect(within(foot).getByRole("link", { name: "Events in the last 24 hours" })).toHaveAttribute(
      "href",
      "/ward-flow/governance",
    );
  });

  it("uses the kit's search field and Segmented sort, with no 'Current order' select", () => {
    renderEd();
    expect(screen.getByRole("searchbox", { name: "Find a patient or UMRN" })).toHaveAttribute(
      "placeholder",
      "Name or UMRN",
    );
    const sort = screen.getByRole("radiogroup", { name: "Sort patients" });
    expect(
      within(sort)
        .getAllByRole("radio")
        .map((radio) => radio.textContent),
    ).toEqual(["Longest in ED", "Name", "Current order"]); // handover build order (Josh, 1 Nov 2026)
    expect(within(sort).getByRole("radio", { name: "Longest in ED" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("combobox", { name: /Sort/u })).toBeNull();
  });
});
