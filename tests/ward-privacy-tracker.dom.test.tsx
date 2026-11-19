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
    expect(hosting).toHaveTextContent("Error reports go to the United States");
    expect(within(hosting).getAllByText("Not yet").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("radio", { name: "Example: all met" }));
    expect(screen.getByTestId("ward-privacy")).toHaveAttribute("data-view", "example");
    expect(hosting).not.toHaveTextContent("Error reports go to the United States");
    expect(within(hosting).queryAllByText("Not yet")).toHaveLength(0);
    expect(screen.getByTestId("privacy-figure-ticked")).toHaveTextContent(String(ALL.length));
  });

  // Screen audit 19 Nov 2026 (item 5): the page keeps every honest status, in plain words.
  it("shows no file paths, decision, migration or gate codes, and no bracketed placeholder", () => {
    render(<PrivacyTrackerScreen />);
    const page = screen.getByTestId("ward-privacy").textContent ?? "";
    expect(page).not.toMatch(/docs\/|\.md\b|\.ts\b|\.mjs\b|migration|go\/no-go|\[Health service\]/iu);
    for (const check of ALL) {
      expect(check.evidence, check.name).not.toMatch(/\b(?:[A-Z]{1,2}-?\d+|hard rule \d)\b|[[\]]|§/u);
      expect(check.evidence.trim(), check.name).not.toBe("");
    }
    expect(screen.getByTestId("privacy-short")).toHaveTextContent("Not yet done:");
    expect(screen.getByTestId("privacy-short")).toHaveTextContent("an independent security test");
    // The statuses are as they were on 16 Nov 2026 (D-260).
    expect(ALL.filter((c) => c.status === "met")).toHaveLength(6);
    expect(ALL.filter((c) => c.status === "partly")).toHaveLength(18);
    expect(ALL.filter((c) => c.status === "notyet")).toHaveLength(33);
  });

  it("opens for the desks that open Governance, and no other", () => {
    expect(screenForPath("/bedchart/privacy")).toEqual({ screen: "privacy" });
    for (const [role, screens] of Object.entries(ROLE_SCREENS)) {
      expect(Boolean(screens.privacy), role).toBe(Boolean(screens.governance));
    }
  });
});
