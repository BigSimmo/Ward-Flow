/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterChip, HeroTrack, PillTabs, Segmented, Tabs } from "@/components/wf/choice";
import { controlTone, StatusGlyph } from "@/components/wf/status-glyph";
import { HeroChip } from "@/components/wf/v10-pass2";

/**
 * Triangle guard (plan 2k, 3 Nov 2026): a chip, tab, segmented option or filter pill never draws the
 * act-now triangle. A `danger` tone there falls back to the neutral ring; other tones are kept.
 */
const items = [
  { id: "a", label: "Needs a bed", count: 3, tone: "danger" as const },
  { id: "b", label: "Moving", count: 1, tone: "warning" as const },
];

function glyphs(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("svg[data-wf-glyph]")].map((svg) => svg.getAttribute("data-wf-glyph"));
}

describe("kit controls never draw the triangle", () => {
  it("controlTone maps danger to neutral and keeps every other tone", () => {
    expect(controlTone("danger")).toBe("neutral");
    for (const tone of ["warning", "success", "info", "neutral", "closed"] as const)
      expect(controlTone(tone)).toBe(tone);
  });

  it.each([
    ["Tabs", Tabs],
    ["PillTabs", PillTabs],
    ["Segmented", Segmented],
    ["HeroTrack", HeroTrack],
  ] as const)("%s", (_name, Control) => {
    const { container } = render(<Control label="Stages" items={items} value="a" onChange={() => {}} />);
    expect(glyphs(container)).toEqual(["neutral", "warning"]);
  });

  it("Segmented as route links", () => {
    const { container } = render(
      <Segmented label="Stages" items={items.map((item) => ({ ...item, href: `/x/${item.id}` }))} value="a" />,
    );
    expect(glyphs(container)).toEqual(["neutral", "warning"]);
  });

  it("FilterChip and HeroChip", () => {
    const { container } = render(
      <>
        <FilterChip pressed={false} onPressedChange={() => {}} tone="danger" count={2}>
          Late
        </FilterChip>
        <HeroChip value={4} label="late" tone="danger" />
      </>,
    );
    expect(glyphs(container)).toEqual(["neutral", "neutral"]);
    expect(screen.getByRole("button", { name: /Late/u })).toBeInTheDocument();
  });

  it("a row's own StatusGlyph still draws the triangle", () => {
    const { container } = render(<StatusGlyph tone="danger" />);
    expect(glyphs(container)).toEqual(["danger"]);
  });
});
