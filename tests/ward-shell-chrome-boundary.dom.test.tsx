import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NextShellBoundary } from "@/components/ward-management/shell-next/next-shell-boundary";

/**
 * TE-06 (front-end audit, 5 Nov 2026; Josh, 6 Nov 2026): `ward-flow/error.tsx` cannot wrap the layout
 * beside it, so a render throw in the rail or the top bar used to reach `src/app/error.tsx` and take
 * the whole ward away. Each now sits in a light `NextShellBoundary`: the broken part shows a short
 * line with Reload page, and the page and the other part keep working. The real layout renders here
 * with the broken part swapped in.
 */
const broken = vi.hoisted(() => ({ rail: false, bar: false }));

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

import Layout from "../src/app/ward-flow/layout";

async function renderLayout() {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const tree = await Layout({ children: <p data-testid="page-body">Synthetic page body</p> });
  render(tree);
}

function Throws(): never {
  throw new Error("synthetic failure with record text");
}

afterEach(() => {
  cleanup();
  broken.rail = false;
  broken.bar = false;
  vi.restoreAllMocks();
});

describe("NextShellBoundary", () => {
  it("shows a short line with a focusable Reload page button, keeps its siblings, and logs the type only", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <div>
        <NextShellBoundary label="The sidebar">
          <Throws />
        </NextShellBoundary>
        <p>Still here</p>
      </div>,
    );
    const line = screen.getByRole("status");
    expect(line).toHaveTextContent("The sidebar could not load.");
    expect(line).toHaveAttribute("data-wf-shell-error");
    expect(screen.getByText("Still here")).toBeVisible();
    const reload = screen.getByRole("button", { name: "Reload page" });
    await userEvent.tab();
    expect(reload).toHaveFocus();
    const logged = vi.mocked(console.error).mock.calls.map((call) => String(call[0]));
    expect(logged).toContain("Ward Flow shell failed: The sidebar (Error)");
    expect(logged.join(" ")).not.toContain("record text");
  });

  it("renders its children untouched when nothing throws", () => {
    render(
      <NextShellBoundary label="The top bar">
        <p>Bar</p>
      </NextShellBoundary>,
    );
    expect(screen.getByText("Bar")).toBeVisible();
    expect(screen.queryByTestId("ward-shell-error")).not.toBeInTheDocument();
  });
});

describe("TE-06 shell chrome boundaries in the ward layout", () => {
  it("keeps the page and the bar when the sidebar throws", async () => {
    broken.rail = true;
    await renderLayout();
    expect(await screen.findByTestId("page-body")).toBeVisible();
    expect(screen.getByText("The sidebar could not load.")).toBeInTheDocument();
    expect(screen.queryByText("The top bar could not load.")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-bar")).toBeInTheDocument();
  });

  it("keeps the page and the sidebar when the top bar throws", async () => {
    broken.bar = true;
    await renderLayout();
    expect(await screen.findByTestId("page-body")).toBeVisible();
    expect(screen.getByText("The top bar could not load.")).toBeInTheDocument();
    expect(screen.queryByText("The sidebar could not load.")).not.toBeInTheDocument();
    expect(await screen.findByTestId("ward-rail")).toBeInTheDocument();
  });
});
