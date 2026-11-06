import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * TE-06 (front-end audit, 5 Nov 2026): `ward-flow/error.tsx` cannot wrap the layout beside it, so a
 * render throw in the rail, the top bar or a note used to reach `src/app/error.tsx` and take the
 * whole ward away. Each now has its own `PanelBoundary`: the broken part shows a short error line
 * and the page keeps working. The real layout renders here with the broken parts swapped in.
 */
const broken = vi.hoisted(() => ({ rail: false, bar: false, broadcast: false }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "desktop", "sec-ch-ua-mobile": "?0" }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../src/components/ward-management/shell-next/next-rail", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell-next/next-rail")>();
  return {
    ...actual,
    NextRail: () => {
      if (broken.rail) throw new Error("synthetic rail failure");
      return <actual.NextRail />;
    },
  };
});
vi.mock("../src/components/ward-management/shell-next/next-bar", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell-next/next-bar")>();
  return {
    ...actual,
    NextBarMount: () => {
      if (broken.bar) throw new Error("synthetic bar failure");
      return <actual.NextBarMount />;
    },
  };
});
vi.mock("../src/components/ward-management/shell/ward-broadcast-banner", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell/ward-broadcast-banner")>();
  return {
    ...actual,
    WardBroadcastBanner: () => {
      if (broken.broadcast) throw new Error("synthetic broadcast failure");
      return <actual.WardBroadcastBanner />;
    },
  };
});

import Layout from "../src/app/ward-flow/layout";

async function renderLayout() {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const tree = await Layout({ children: <p data-testid="page-body">Synthetic page body</p> });
  render(tree);
}

afterEach(() => {
  cleanup();
  broken.rail = false;
  broken.bar = false;
  broken.broadcast = false;
  vi.restoreAllMocks();
});

describe("TE-06 shell chrome boundaries", () => {
  it("keeps the page and the bar when the sidebar throws", async () => {
    broken.rail = true;
    await renderLayout();
    expect(await screen.findByTestId("page-body")).toBeVisible();
    expect(screen.getByText("The sidebar could not be shown")).toBeInTheDocument();
    expect(screen.queryByText("The top bar could not be shown")).not.toBeInTheDocument();
  });

  it("keeps the page and the sidebar when the top bar throws", async () => {
    broken.bar = true;
    await renderLayout();
    expect(await screen.findByTestId("page-body")).toBeVisible();
    expect(screen.getByText("The top bar could not be shown")).toBeInTheDocument();
    expect(screen.queryByText("The sidebar could not be shown")).not.toBeInTheDocument();
  });

  it("keeps the page when a note throws, and logs the error type only", async () => {
    broken.broadcast = true;
    await renderLayout();
    expect(await screen.findByTestId("page-body")).toBeVisible();
    expect(screen.getByText("This note could not be shown")).toBeInTheDocument();
    const logged = vi.mocked(console.error).mock.calls.map((call) => String(call[0]));
    expect(logged).toContain("Ward Flow panel failed: This note (Error)");
  });
});
