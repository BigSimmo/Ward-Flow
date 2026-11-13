// F-77 (Audit 15, A15-25): the "About this demo" page. It must say the demo is invented data and not
// for clinical use, name what this browser keeps and sends, and offer Leave the demo only on a site
// with the demo code (the readable `wf_door=1` marker). Settings links to it. All data is synthetic.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/about",
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

import { AboutDemoScreen } from "@/components/ward-management/about/about-demo-screen";
import { WARD_NAV_INTENTIONALLY_UNLISTED } from "@/components/ward-management/ward-nav";
import { screenForPath } from "@/components/ward-management/ward-role-access";

afterEach(() => {
  cleanup();
  document.cookie = "wf_door=; Max-Age=0; Path=/";
});

describe("About this demo (F-77)", () => {
  it("says the demo is invented, not for clinical use, and unendorsed", () => {
    render(<AboutDemoScreen />);
    const page = screen.getByTestId("ward-about-demo");
    expect(screen.getByRole("heading", { level: 1, name: "About this demo" })).toBeInTheDocument();
    expect(screen.getByTestId("about-figure-patients")).toHaveTextContent("0 real patients");
    expect(screen.getByTestId("about-hero-act")).toHaveTextContent("Never type a real person's details");
    const isNot = within(screen.getByTestId("about-is-not"));
    expect(isNot.getByText("Connected to any hospital record")).toBeInTheDocument();
    expect(isNot.getByText("Clinical decision support")).toBeInTheDocument();
    expect(isNot.getByText("Approved for clinical use")).toBeInTheDocument();
    expect(page).toHaveTextContent("No health service has endorsed or reviewed this demo.");
    expect(page).toHaveTextContent("No real person's information.");
  });

  it("names what this browser keeps and what is sent", () => {
    render(<AboutDemoScreen />);
    const kept = within(screen.getByTestId("about-kept-facts"));
    expect(kept.getByText("Working copy of the demo")).toBeInTheDocument();
    expect(kept.getByText("Kept by code or ward name, never a patient's name.")).toBeInTheDocument();
    expect(kept.getByText("Signed. Holds neither the code nor your name.")).toBeInTheDocument();
    expect(kept.getByText("8 hours")).toBeInTheDocument();
    expect(kept.getByText("30 days")).toBeInTheDocument();
    const sent = within(screen.getByTestId("about-sent-facts"));
    expect(sent.getByText("Nothing you do is saved on a server.")).toBeInTheDocument();
    expect(sent.getByText(/Never a name or anything you typed/)).toBeInTheDocument();
    expect(sent.getByText("Analytics, adverts, other sites")).toBeInTheDocument();
  });

  it("offers Leave the demo only on a site with the demo code", () => {
    // The marker is remembered once seen (leave-demo.ts), so the "absent" case runs first.
    const { unmount } = render(<AboutDemoScreen />);
    expect(screen.queryByTestId("about-leave-demo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("about-leave-demo-hero")).not.toBeInTheDocument();
    unmount();
    document.cookie = "wf_door=1; Path=/";
    render(<AboutDemoScreen />);
    expect(screen.getByTestId("about-leave-demo")).toHaveTextContent("Leave the demo");
    expect(screen.getByTestId("about-leave-demo-hero")).toBeInTheDocument();
  });

  it("is open to every desk, unlisted in the menus, and linked from Settings", () => {
    expect(screenForPath("/ward-flow/about")).toEqual({ screen: "about" });
    expect(WARD_NAV_INTENTIONALLY_UNLISTED.get("/ward-flow/about")).toMatch(/Settings/);
    const settings = readFileSync(
      join(process.cwd(), "src/components/ward-management/settings/settings-help-and-demo.tsx"),
      "utf8",
    );
    expect(settings).toContain('href="/ward-flow/about"');
  });
});
