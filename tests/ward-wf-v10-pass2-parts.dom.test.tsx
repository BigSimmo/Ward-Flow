import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  BarList,
  CardHead,
  CheckingFoot,
  FactGrid,
  Hero,
  HeroChip,
  HeroChips,
  HeroStat,
  JourneyStrip,
  OccupancyRing,
  PillTabs,
  StatusPill,
  TimeRail,
  ToastProvider,
  WF_PHONE_QUERY,
  rowDim,
  useIsPhone,
  useToast,
} from "@/components/wf";
import { Activity } from "lucide-react";

/**
 * v10 build pass 2 shared parts (10 Oct 2026): the parts page agents built locally in pass 1 and
 * asked to share. Each case pins what a page relies on so the local copies can go.
 */

const read = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");

describe("OccupancyRing sizes only its own gauge", () => {
  it("scopes the gauge size and stroke rules to the ring's direct svg, so the status glyph keeps its size", () => {
    const css = read("src/components/wf/v10-parts.module.css");
    expect(css).toMatch(/\.ring > svg \{[^}]*width: 148px/u);
    expect(css).toMatch(/\.ring > svg path \{/u);
    expect(css).not.toMatch(/\.ring svg\b/u);
    expect(css).not.toMatch(/\.ring path\b/u);
  });
});

describe("Hero lead slot and slash stat", () => {
  it("renders the lead before the title in the first row, without CSS reordering", () => {
    render(
      <Hero
        eyebrow="Statewide"
        title="Capacity"
        lead={<OccupancyRing percent={91.2} alertAt={90} scope="Statewide" />}
        bar={
          <HeroChips label="Right now">
            <HeroChip value={3} label="wards over the line" />
          </HeroChips>
        }
      />,
    );
    const hero = screen.getByRole("region", { name: "Capacity" });
    const firstRow = hero.firstElementChild as HTMLElement;
    const lead = firstRow.querySelector("[data-wf-hero-lead]");
    expect(lead).not.toBeNull();
    expect(firstRow.firstElementChild).toBe(lead);
    expect(within(lead as HTMLElement).getByTestId("wf-occupancy-ring")).toBeInTheDocument();
    // Eyebrow and title come before the chip row in the document, so phone never puts chips first.
    const eyebrow = screen.getByText("Statewide");
    const chips = screen.getByRole("group", { name: "Right now" });
    expect(eyebrow.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pins the phone order: eyebrow and title first, then the lead, then chips", () => {
    const css = read("src/components/wf/hero.module.css");
    const phone = css.slice(css.indexOf("@media (max-width: 48rem)"));
    expect(phone).toMatch(/\.titleBlock \{\s*order: 0;/u);
    expect(phone).toMatch(/\.lead \{\s*order: 1;/u);
    expect(phone).toMatch(/\.firstRow \{\s*order: 0;/u);
    expect(phone).toMatch(/\.barRow \{\s*order: 1;/u);
  });

  it("shows a slash figure and reads it as N of M", () => {
    render(<HeroStat value={2} total={7} label="steps done" />);
    expect(screen.getByText("2 of 7")).toBeInTheDocument();
    const shown = screen.getByText("/").parentElement as HTMLElement;
    expect(shown).toHaveAttribute("aria-hidden", "true");
    expect(shown.textContent).toBe("2/7");
  });
});

describe("useIsPhone", () => {
  it("follows the one phone query", () => {
    const listeners: Array<() => void> = [];
    let matches = false;
    const original = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY && matches,
      media: query,
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    try {
      const { result } = renderHook(() => useIsPhone());
      expect(result.current).toBe(false);
      matches = true;
      act(() => listeners.forEach((cb) => cb()));
      expect(result.current).toBe(true);
      expect(WF_PHONE_QUERY).toBe("(max-width: 48rem)");
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("PillTabs", () => {
  function Harness() {
    const [tab, setTab] = useState<"now" | "hist" | "docs">("now");
    return (
      <PillTabs
        label="The record"
        value={tab}
        onChange={setTab}
        idPrefix="rec"
        items={[
          { id: "now", label: "Now" },
          { id: "hist", label: "History", count: 3 },
          { id: "docs", label: "Documents" },
        ]}
      />
    );
  }

  it("is a tablist with one tab stop that arrow keys move and select", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist", { name: "The record" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-controls", "rec-panel-hist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(within(list).getByRole("tab", { name: /History/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(list, { key: "End" });
    expect(within(list).getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "true");
  });

  it("never wraps: the track scrolls sideways", () => {
    const css = read("src/components/wf/choice.module.css");
    expect(css).toMatch(/\.pt \{[^}]*overflow-x: auto/u);
    expect(css).toMatch(/\.ptItem \{[^}]*white-space: nowrap/u);
  });
});

describe("StatusPill, rowDim and CheckingFoot unavailable", () => {
  it("keeps the words neutral ink and lets the glyph carry tone", () => {
    render(<StatusPill tone="danger">Follow-up</StatusPill>);
    const pill = screen.getByTestId("wf-status-pill");
    expect(pill).toHaveTextContent("Follow-up");
    expect(pill.querySelector("svg")).not.toBeNull();
    const css = read("src/components/wf/v10-pass2.module.css");
    const rule = css.slice(css.indexOf(".pill {"), css.indexOf("}", css.indexOf(".pill {")));
    expect(rule).toContain("color: var(--wf-ink-1)");
    expect(rule).not.toMatch(/--wf-(danger|warning)/u);
  });

  it("dims a legacy table row by attribute, and the token layer reaches its cells", () => {
    render(
      <table>
        <tbody>
          <tr {...rowDim(true)} data-testid="dim">
            <td>Dabakarn</td>
          </tr>
          <tr {...rowDim(false)} data-testid="lit">
            <td>Moodjar</td>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("dim")).toHaveAttribute("data-dim", "true");
    expect(screen.getByTestId("lit")).not.toHaveAttribute("data-dim");
    const tokens = read("src/app/ward-flow-v9-tokens.css");
    expect(tokens).toMatch(/tr\[data-dim="true"\] > :is\(td, th\),[\s\S]*?\{\s*color: var\(--wf-dim\);/u);
  });

  it("shows an item it could not check as not checked, never as 0", () => {
    render(
      <CheckingFoot
        items={[
          { id: "a", label: "Overdue", value: 0 },
          { id: "b", label: "Transport feed", unavailable: true },
        ]}
      />,
    );
    const foot = screen.getByTestId("wf-checking-foot");
    expect(foot).toHaveTextContent("Overdue0");
    expect(foot).toHaveTextContent("Transport feednot checked");
    expect(foot).not.toHaveTextContent(/All clear/i);
  });
});

describe("HeroChip, HeroChips and FactGrid", () => {
  it("renders a plain chip, a pressed toggle chip and a twin read in words", () => {
    const onPress = vi.fn();
    render(
      <HeroChips label="Pack">
        <HeroChip value={12} label="beds free" />
        <HeroChip value={3} label="moves" twin="+2" twinLabel="2 more since the last pack" onPress={onPress} pressed />
      </HeroChips>,
    );
    const group = screen.getByRole("group", { name: "Pack" });
    expect(within(group).getByText("beds free")).toBeInTheDocument();
    const toggle = within(group).getByRole("button", { name: /moves/ });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveTextContent("2 more since the last pack");
    fireEvent.click(toggle);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("lays facts out as a description list", () => {
    render(
      <FactGrid
        facts={[
          { id: "u", label: "UMRN", value: "UM100023" },
          { id: "w", label: "Ward", value: "Dabakarn" },
        ]}
      />,
    );
    expect(screen.getByText("UMRN").tagName).toBe("DT");
    expect(screen.getByText("UM100023").tagName).toBe("DD");
  });
});

describe("TimeRail", () => {
  it("puts past marks in the Passed bay, plots the span, counts the rest, and names each mark", () => {
    const onSelect = vi.fn();
    const now = 600;
    render(
      <TimeRail
        now={now}
        formatTime={(at) => `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`}
        verbs={{ passed: "expired", upcoming: "expires" }}
        marks={[
          { id: "p", at: 540, code: "1A", name: "Form 1A", tone: "danger", onSelect },
          { id: "a", at: 720, code: "3A", name: "Form 3A", tone: "warning", onSelect },
          { id: "b", at: 780, code: "4A", name: "Form 4A", onSelect },
          { id: "z", at: 2000, code: "6A", name: "Form 6A", onSelect },
        ]}
        laterText={(n) => `${n} more after the rail`}
      />,
    );
    const rail = screen.getByTestId("wf-time-rail");
    expect(within(rail).getByRole("button", { name: "Form 1A expired 09:00, open" })).toBeInTheDocument();
    // 3A and 4A are an hour apart, inside the 150-minute cluster: one button, labels never overlap.
    const cluster = within(rail).getByRole("button", { name: "Form 3A expires 12:00 and 1 more close after, open" });
    fireEvent.click(cluster);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(rail).toHaveTextContent("1 more after the rail");
    expect(rail).toHaveTextContent("Now");
  });
});

describe("JourneyStrip", () => {
  it("sizes each stage by its real duration and names the path", () => {
    render(
      <JourneyStrip
        label="Journey since ED arrival"
        formatDuration={(m) => `${Math.floor(m / 60)}h ${m % 60}m`}
        stages={[
          { id: "t", label: "ED triage", minutes: 20 },
          { id: "w", label: "Waiting for a bed", minutes: 600, quiet: true },
          { id: "o", label: "On ward", minutes: 300, now: true },
        ]}
      />,
    );
    const bar = screen.getByRole("img", { name: /Journey since ED arrival: ED triage 0h 20m/ });
    expect(bar.getAttribute("aria-label")).toContain("Now on ward.");
    const segs = Array.from(bar.children) as HTMLElement[];
    expect(segs.map((seg) => seg.style.flexGrow)).toEqual(["20", "600", "300"]);
    expect(segs[1]).toHaveAttribute("data-quiet", "true");
    expect(segs[2]).toHaveAttribute("data-now", "true");
    expect(screen.getByTestId("wf-journey")).toHaveTextContent("Short stages: ED triage 0h 20m");
  });
});

describe("BarList axis, CardHead plain icon and the layout toast", () => {
  it("gives tick numbers and the mean label their own lines", () => {
    const { container } = render(
      <BarList
        label="Beds"
        axis
        mean={4.2}
        rows={[
          { id: "a", label: "A", value: 3 },
          { id: "b", label: "B", value: 6 },
        ]}
      />,
    );
    expect(container.querySelector('[data-two-lines="true"]')).not.toBeNull();
    expect(read("src/components/wf/chart.module.css")).toMatch(
      /\.axisRow\[data-two-lines="true"\] \{\s*height: calc\(2 \* var\(--wf-lh-12\) \+ 6px\);/u,
    );
  });

  it("draws a plain line icon with no tile when asked", () => {
    const { container } = render(<CardHead title="Activity" icon={Activity} iconPlain />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("svg")?.parentElement?.tagName).toBe("DIV");
  });

  it("mounts one ToastProvider in the ward-flow layout so useToast works on every page", () => {
    const layout = read("src/app/ward-flow/layout.tsx");
    // Audit 13 Oct 2026: the provider now carries the offline note as a prop.
    expect(layout.match(/<ToastProvider[ >]/gu)).toHaveLength(1);
    function Pusher() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() =>
            toast.push({ tone: "success", title: "Bed held", undo: { durationMs: 5000, onUndo: () => undefined } })
          }
        >
          push
        </button>
      );
    }
    render(
      <ToastProvider>
        <Pusher />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "push" }));
    expect(screen.getByTestId("toast")).toHaveTextContent("Bed held");
    expect(within(screen.getByTestId("toast")).getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });
});
