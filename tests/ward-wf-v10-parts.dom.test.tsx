import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
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
  Button,
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
    expect(ring).toHaveAccessibleName("Statewide 90.3% of beds occupied. Alert line 90%. At risk, over 90%.");
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
    // A dimmed row drops the fit tint (pass 4), so only the matching places stand out.
    expect(row).not.toHaveAttribute("data-fit");
    expect(row).toHaveTextContent("90.0%");
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("marks a fit place that is not dimmed", () => {
    render(
      <WardCapacityRow
        name="Moodjar"
        segments={[{ id: "occ", value: 10, fill: "data-1", label: "Occupied" }]}
        percent={50}
        alertAt={85}
        fit
      />,
    );
    expect(screen.getByTestId("wf-ward-capacity-row")).toHaveAttribute("data-fit", "true");
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

  // Site review B6 (12 Oct 2026): the band was decided after hydration, so every heroed page
  // painted a rounded card first and jumped (layout shift up to 0.49). The server HTML must already
  // be the band: a band hero with no measured `data-band`, which the desktop CSS paints as the band.
  it("server-renders a band hero as the band, before any measure", () => {
    const html = renderToString(
      <div data-wf-scroller="">
        <Hero title="Alerts" testId="band-hero" />
        <Hero title="As at 10:42" quiet testId="quiet-hero" />
        <Hero title="Inset" band={false} testId="card-hero" />
      </div>,
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    const band = host.querySelector('[data-testid="band-hero"]')!;
    expect(band).toHaveAttribute("data-wf-hero", "band");
    expect(band).not.toHaveAttribute("data-band");
    expect(host.querySelector('[data-testid="quiet-hero"]')).toHaveAttribute("data-wf-hero", "quiet");
    expect(host.querySelector('[data-testid="card-hero"]')).toHaveAttribute("data-wf-hero", "card");

    const css = readFileSync("src/components/wf/hero.module.css", "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
    const desktop =
      /@media\s*\(min-width:\s*48\.0625rem\)\s*\{\s*:global\(\[data-wf-scroller\]\)\s*\.hero\[data-wf-hero="band"\]:not\(\[data-band\]\)\s*\{([^}]*)\}/u.exec(
        css,
      )?.[1];
    expect(desktop, "no desktop server-band rule in hero.module.css").toBeDefined();
    expect(desktop).toMatch(/margin-top:\s*calc\(-1 \* var\(--wf-band-top\)\)/u);
    expect(desktop).toMatch(/border-radius:\s*0/u);
    // Phone keeps its own measured band: no server-band rule under 48rem.
    const phoneBlocks = [...css.matchAll(/@media\s*\(max-width:\s*48rem\)\s*\{([\s\S]*?)\n\}/gu)].map((m) => m[1]);
    expect(phoneBlocks.join("")).not.toMatch(/:not\(\[data-band\]\)/u);
  });

  it("ends the server band once measured: on when the page opens on it, off when it does not", () => {
    const scroller = document.createElement("div");
    scroller.setAttribute("data-wf-scroller", "");
    document.body.append(scroller);
    try {
      render(<Hero title="Below a banner" testId="measured-hero" />, { container: scroller });
      // jsdom has no layout, so the hero reads as far from the header: measured, not a band.
      expect(screen.getByTestId("measured-hero")).toHaveAttribute("data-band", expect.stringMatching(/^(on|off)$/u));
    } finally {
      scroller.remove();
    }
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

describe("placement Button availability", () => {
  it("exposes its real gate to keyboard users and blocks submit until it clears", () => {
    const submit = vi.fn((event) => event.preventDefault());
    const view = render(
      <form onSubmit={submit}>
        <Button
          type="submit"
          variant="pri"
          size="md"
          data-placement-action
          disabledReason="No allocatable bed remains."
          reasonDisplay="tooltip"
        >
          Pull patient
        </Button>
      </form>,
    );
    let button = screen.getByRole("button", { name: "Pull patient" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("No allocatable bed remains.");
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(submit).not.toHaveBeenCalled();
    view.rerender(
      <form onSubmit={submit}>
        <Button type="submit" variant="pri" size="md" data-placement-action>
          Pull patient
        </Button>
      </form>,
    );
    button = screen.getByRole("button", { name: "Pull patient" });
    fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
