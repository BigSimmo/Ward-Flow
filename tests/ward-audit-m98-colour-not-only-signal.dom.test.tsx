/** @vitest-environment jsdom */

// M98 (master audit list, 10 Nov 2026): colour is never the only signal.
//
// The design system's status-mark table (DESIGN-SYSTEM §4 "Status marks") gives one shape per tone.
// In greyscale every tone's colour collapses to a grey, and under forced colours the kit paints every
// glyph CanvasText (status-glyph.module.css). Either way only the geometry is left. This test renders
// every tone, strips everything colour-related, and checks each tone is still told apart by shape,
// at every size the kit draws it, and that a badge always carries its word beside the mark.

import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

import { Badge, Dot, StatusGlyph, type WfTone } from "@/components/wf";

const DESIGN_SYSTEM = readFileSync("docs/design/DESIGN-SYSTEM.md", "utf8");
const GLYPH_CSS = readFileSync("src/components/wf/status-glyph.module.css", "utf8");

/** The design system's table, word for word: "triangle act now (`danger`)" and so on. */
function designSystemTones(): { shape: string; tone: WfTone }[] {
  const paragraph = DESIGN_SYSTEM.split("\n").find((line) => line.startsWith("**Status marks.**"));
  expect(paragraph, "DESIGN-SYSTEM.md lost its **Status marks.** paragraph").toBeTruthy();
  const list = /One shape per tone: ([^.]+)\./.exec(paragraph!)?.[1] ?? "";
  // "triangle act now (`danger`)": the words before the tone, which start with the shape's name.
  return [...list.matchAll(/([a-z][a-z ,]*?) \(`(\w+)`\)/g)].map((row) => ({
    shape: row[1]!.replace(/^, /, ""),
    tone: row[2] as WfTone,
  }));
}

/**
 * The glyph with colour removed: element names, geometry and whether each part is filled or a
 * line. `currentColor`, classes and the tone name itself are dropped, because in greyscale or
 * forced colours they no longer tell anyone anything.
 */
function shapeWithoutColour(svg: SVGSVGElement): string {
  return [...svg.children]
    .map((part) => {
      const attributes = [...part.attributes]
        .filter((attribute) => !["class", "style", "color"].includes(attribute.name))
        .map((attribute) => {
          if (attribute.name === "fill") return `fill=${attribute.value === "none" ? "none" : "solid"}`;
          if (attribute.name === "stroke") return `stroke=${attribute.value === "none" ? "none" : "line"}`;
          return `${attribute.name}=${attribute.value}`;
        })
        .toSorted();
      return `${part.tagName.toLowerCase()}[${attributes.join(" ")}]`;
    })
    .join("+");
}

const TONES = designSystemTones();

describe("M98: every status mark is told apart without colour", () => {
  it("reads all six tones from the design system's table", () => {
    expect(TONES.map((row) => row.tone).toSorted()).toEqual(
      ["closed", "danger", "info", "neutral", "success", "warning"].toSorted(),
    );
    // The words the table uses for each shape, so a renamed shape is noticed here too.
    const expected: Record<WfTone, string> = {
      danger: "triangle",
      warning: "filled circle",
      success: "tick",
      info: "capsule",
      neutral: "ring",
      closed: "cross",
    };
    for (const row of TONES) expect(row.shape.startsWith(`${expected[row.tone]} `), row.shape).toBe(true);
  });

  it.each([8, 9, 10, 12, 16])("draws six different shapes at %ipx once colour is gone", (size) => {
    const shapes = TONES.map(({ tone }) => {
      const { container, unmount } = render(<StatusGlyph tone={tone} size={size} />);
      const svg = container.querySelector("svg")!;
      expect(svg.childElementCount, `${tone} drew nothing at ${size}px`).toBeGreaterThan(0);
      const shape = shapeWithoutColour(svg);
      unmount();
      return [tone, shape] as const;
    });
    const distinct = new Set(shapes.map(([, shape]) => shape));
    expect(distinct.size, `two tones share a shape at ${size}px: ${JSON.stringify(shapes)}`).toBe(TONES.length);
  });

  it("keeps the filled circle and the ring apart by fill, not by colour", () => {
    // The two circles are the closest pair: at-risk is solid, waiting is a line.
    const at = (tone: WfTone) => shapeWithoutColour(render(<Dot tone={tone} />).container.querySelector("svg")!);
    expect(at("warning")).toMatch(/fill=solid/);
    expect(at("warning")).not.toMatch(/stroke=line/);
    expect(at("neutral")).toMatch(/fill=none/);
    expect(at("neutral")).toMatch(/stroke=line/);
  });

  it("paints every glyph one system colour under forced colours, and never hides one", () => {
    const blocks: postcss.AtRule[] = [];
    postcss.parse(GLYPH_CSS).walkAtRules("media", (rule) => {
      if (/forced-colors\s*:\s*active/.test(rule.params)) blocks.push(rule);
    });
    expect(blocks).toHaveLength(1);
    const declarations: Record<string, string> = {};
    blocks[0]!.walkDecls((decl) => {
      declarations[decl.prop] = decl.value;
    });
    // One colour for all six, so the shape test above is what forced-colours users depend on.
    expect(declarations.color).toBe("CanvasText");
    expect(declarations.display).toBeUndefined();
    expect(declarations.visibility).toBeUndefined();
    expect(declarations.opacity).toBeUndefined();
    expect(GLYPH_CSS).not.toMatch(/forced-color-adjust\s*:\s*none/);
  });

  it.each(TONES.map((row) => row.tone))("a %s badge keeps its word beside the mark", (tone) => {
    const { container, getByText } = render(<Badge tone={tone}>Synthetic word</Badge>);
    expect(getByText("Synthetic word")).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
