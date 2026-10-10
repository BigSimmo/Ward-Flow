import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import {
  CheckingFoot,
  CountCircle,
  DataRow,
  Frac,
  GroupHead,
  Hero,
  OccupancyRing,
  SinceYouLooked,
  StepsDots,
  WardCapacityRow,
  registerWfBandHero,
} from "@/components/wf";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Design system v10 shared parts and the band header state (10 Oct 2026). These pin the rules a
 * page agent relies on: what the parts say, what they never say, and that dimming is an attribute
 * the token layer turns into colour, never opacity or a filter.
 */

describe("CheckingFoot", () => {
  it("lists what was checked with each count, and what was not", () => {
    render(
      <CheckingFoot
        items={[
          { id: "overdue", label: "Overdue", value: 14, tone: "danger" },
          { id: "silent", label: "Wards not reporting", value: 0 },
        ]}
        notChecked={["private hospitals, no feed"]}
      />,
    );
    const foot = screen.getByRole("group", { name: "What this page checks" });
    expect(foot).toHaveTextContent("Checking");
    expect(foot).toHaveTextContent("Overdue14");
    expect(foot).toHaveTextContent("Wards not reporting0");
    expect(foot).toHaveTextContent("Not checked: private hospitals, no feed");
  });

  it("never says All clear, even when every count is 0", () => {
    render(<CheckingFoot items={[{ id: "a", label: "Overdue", value: 0 }]} />);
    expect(screen.getByTestId("wf-checking-foot").textContent).not.toMatch(/all clear/i);
  });
});

describe("Frac and StepsDots", () => {
  it("shows a mono fraction and reads it as N of M", () => {
    render(<Frac done={7} total={9} label="checks done" />);
    expect(screen.getByTestId("wf-frac")).toHaveTextContent("7/9");
    expect(screen.getByText("7 of 9 checks done")).toBeInTheDocument();
  });

  it("draws one dot per leg and names the progress", () => {
    render(<StepsDots steps={["done", "done", "now", "todo"]} label="Transfer legs" />);
    const dots = screen.getByRole("img", { name: "Transfer legs: 2 of 4 done, step 3 under way" });
    expect(dots.querySelectorAll("i")).toHaveLength(4);
  });
});

describe("OccupancyRing", () => {
  it("says at risk at or over the alert line, with the figure to one decimal", () => {
    render(<OccupancyRing percent={90.34} alertAt={90} scope="Statewide" />);
    const ring = screen.getByTestId("wf-occupancy-ring");
    expect(ring).toHaveAccessibleName("Statewide 90.3% of open beds occupied. Alert line 90%. At risk, over 90%.");
  });

  it("says Not recorded rather than drawing a value it does not hold", () => {
    render(<OccupancyRing percent={null} alertAt={85} scope="East Metro" />);
    expect(screen.getByTestId("wf-occupancy-ring")).toHaveAccessibleName(
      "East Metro occupancy not recorded. Alert line 85%. Not recorded.",
    );
  });
});

describe("WardCapacityRow, GroupHead and SinceYouLooked", () => {
  it("dims by attribute and marks a fit place, and opens with its own name", () => {
    const onSelect = vi.fn();
    render(
      <WardCapacityRow
        name="Dabakarn"
        segments={[
          { id: "occ", value: 18, fill: "data-1", label: "Occupied" },
          { id: "ready", value: 2, fill: "ready", label: "Ready" },
        ]}
        percent={90}
        alertAt={85}
        dim
        fit
        onSelect={onSelect}
        actionLabel="Open Dabakarn"
      />,
    );
    const row = screen.getByRole("button", { name: "Open Dabakarn" });
    expect(row).toHaveAttribute("data-dim", "true");
    expect(row).toHaveAttribute("data-fit", "true");
    expect(row).toHaveTextContent("90.0%");
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("folds a group from its head and shows 0 rather than nothing", () => {
    const onToggle = vi.fn();
    render(<GroupHead title="Waiting on a bed" count={0} onToggle={onToggle} expanded controls="g1" />);
    const head = screen.getByRole("button", { name: /Waiting on a bed/ });
    expect(head).toHaveAttribute("aria-expanded", "true");
    expect(head).toHaveTextContent("0");
    fireEvent.click(head);
    expect(onToggle).toHaveBeenCalled();
  });

  it("lists what changed since the person looked and offers handover text", () => {
    const onCopy = vi.fn();
    render(
      <SinceYouLooked
        since="07:12"
        items={[{ id: "adm", value: 4, word: "admitted", detail: "2 Dabakarn", tone: "success" }]}
        onCopy={onCopy}
      />,
    );
    expect(screen.getByRole("region", { name: "Since you looked at 07:12" })).toHaveTextContent("4admitted");
    fireEvent.click(screen.getByRole("button", { name: "Copy as handover text" }));
    expect(onCopy).toHaveBeenCalled();
  });
});

describe("CountCircle and DataRow dim", () => {
  it("marks an urgent count by its edge and keeps the number readable", () => {
    render(<CountCircle n={7} urgent label="7 still open" />);
    expect(screen.getByText("7").parentElement).toHaveAttribute("data-urgent", "true");
    expect(screen.getByText("7 still open")).toBeInTheDocument();
  });

  it("dims a row by attribute and keeps it in the list", () => {
    render(
      <DataRow columns="1fr" dim role="row">
        <span>Row</span>
      </DataRow>,
    );
    expect(screen.getByRole("row")).toHaveAttribute("data-dim", "true");
  });

  it("dims by colour tokens only: no opacity or grayscale in the convention or the parts", () => {
    const tokens = readFileSync("src/app/ward-flow-v9-tokens.css", "utf8");
    const rule = /\[data-dim="true"\]\s*\{([^}]*)\}/u.exec(tokens)?.[1] ?? "";
    expect(rule).toMatch(/color:\s*var\(--wf-dim\)/u);
    expect(rule).not.toMatch(/opacity|filter/u);
    const parts = readFileSync("src/components/wf/v10-parts.module.css", "utf8");
    expect(parts).not.toMatch(/grayscale|opacity:\s*0/u);
  });
});

describe("Hero: quiet and band", () => {
  it("a quiet hero never takes the band", () => {
    render(<Hero title="As at 10:42" quiet testId="quiet-hero" />);
    expect(screen.getByTestId("quiet-hero")).toHaveAttribute("data-wf-hero", "quiet");
    expect(screen.getByTestId("quiet-hero")).not.toHaveAttribute("data-band");
  });
});

describe("WardBar band state (desktop and tablet)", () => {
  let release: (() => void) | null = null;
  afterEach(() => {
    release?.();
    release = null;
  });

  function renderBar() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar />
      </WardFlowProvider>,
    );
  }

  it("keeps the ordinary header when the page has no band hero", () => {
    renderBar();
    expect(screen.getByTestId("ward-bar")).not.toHaveAttribute("data-band");
  });

  it("sits in hero ink at rest while a band hero is registered, and drops it when it goes", () => {
    renderBar();
    act(() => {
      release = registerWfBandHero();
    });
    expect(screen.getByTestId("ward-bar")).toHaveAttribute("data-band", "ink");
    act(() => {
      release?.();
      release = null;
    });
    expect(screen.getByTestId("ward-bar")).not.toHaveAttribute("data-band");
  });
});
