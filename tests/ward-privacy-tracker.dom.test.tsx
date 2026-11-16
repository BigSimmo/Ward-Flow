// D-260 (Josh, 16 Nov 2026): the Privacy and data page. It must say nothing is enforced, show each
// check's current status with its evidence, switch to the all-met example, and open only for the
// desks that open Governance. Reference content only; all data in the app is synthetic.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart/privacy",
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

import { PRIVACY_SECTIONS, PRIVACY_SIGN_OFFS } from "@/components/ward-management/privacy/privacy-tracker-data";
import { PrivacyTrackerScreen } from "@/components/ward-management/privacy/privacy-tracker-screen";
import { ROLE_SCREENS, screenForPath } from "@/components/ward-management/ward-role-access";

afterEach(cleanup);

const ALL = [...PRIVACY_SECTIONS.flatMap((s) => s.checks), ...PRIVACY_SIGN_OFFS];

describe("Privacy and data (D-260)", () => {
  it("says the requirements are not enforced and not legal advice", () => {
    render(<PrivacyTrackerScreen />);
    expect(screen.getByRole("heading", { level: 1, name: /Privacy and data/ })).toBeInTheDocument();
    expect(screen.getByText(/Not enforced · Synthetic data only · Not legal advice/)).toBeInTheDocument();
    expect(screen.getByTestId("privacy-note")).toHaveTextContent("This is not legal advice.");
  });

  it("counts every check once, and the figures add up", () => {
    render(<PrivacyTrackerScreen />);
    const met = ALL.filter((c) => c.status === "met").length;
    const partly = ALL.filter((c) => c.status === "partly").length;
    expect(screen.getByTestId("privacy-figure-total")).toHaveTextContent(String(ALL.length));
    expect(screen.getByTestId("privacy-figure-met")).toHaveTextContent(String(met));
    expect(screen.getByTestId("privacy-figure-partly")).toHaveTextContent(String(partly));
    expect(screen.getByTestId("privacy-figure-notyet")).toHaveTextContent(String(ALL.length - met - partly));
    expect(new Set(ALL.map((c) => c.name)).size).toBe(ALL.length);
  });

  it("shows each check's evidence today, and every check as met in the example", () => {
    render(<PrivacyTrackerScreen />);
    const hosting = screen.getByTestId("privacy-checks-hosting");
    expect(hosting).toHaveTextContent("Sentry error reports go to the US");
    expect(within(hosting).getAllByText("Not yet").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("radio", { name: "Example: all met" }));
    expect(screen.getByTestId("ward-privacy")).toHaveAttribute("data-view", "example");
    expect(hosting).not.toHaveTextContent("Sentry error reports go to the US");
    expect(within(hosting).queryAllByText("Not yet")).toHaveLength(0);
    expect(screen.getByTestId("privacy-figure-ticked")).toHaveTextContent(String(ALL.length));
  });

  it("opens for the desks that open Governance, and no other", () => {
    expect(screenForPath("/bedchart/privacy")).toEqual({ screen: "privacy" });
    for (const [role, screens] of Object.entries(ROLE_SCREENS)) {
      expect(Boolean(screens.privacy), role).toBe(Boolean(screens.governance));
    }
  });
});
