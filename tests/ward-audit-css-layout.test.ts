import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Two CSS-only layout defects that jsdom cannot see (it applies no real CSS module).
 *
 *  - Audit P034, All EDs Table view at 820 px: the table card scrolls sideways, but a visually
 *    hidden label inside it was positioned against an ancestor outside the scroller, so it escaped
 *    the clip and the page measured 951 px wide. The card must be its own containing block, and the
 *    table must be as wide as its own columns so every row line reaches the end of the scroll.
 *  - Audit P112, the Capacity "Next 48 hours" header: "whole network" was cut to "whole ..." in the
 *    narrow rail. The words must be allowed to wrap, and the header must be allowed to wrap too.
 *    The Capacity redesign (31 Oct 2026) replaced that header with the "Bed forecast" card head,
 *    whose actions (Network or Site, By ward, Try a scenario) sit in `.headActions`, so the same
 *    two promises are pinned there.
 */
const ED_CSS = readFileSync("src/components/ward-management/ed/ed-index.module.css", "utf8");
const FORECAST_CSS = readFileSync("src/components/ward-management/capacity/capacity-page.module.css", "utf8");

/** The declarations of every rule whose selector is exactly `.name` (outside or inside a media block). */
function bodies(css: string, name: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`(?:^|\\n)\\s*\\.${name}\\s*\\{([^}]*)\\}`, "g");
  for (const match of css.matchAll(pattern)) found.push(match[1] ?? "");
  return found;
}

describe("All EDs table card stays inside its own scroller (P034)", () => {
  it("makes the table card the containing block of anything positioned inside it", () => {
    const rules = bodies(ED_CSS, "tableCard");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((body) => /position:\s*relative/.test(body))).toBe(true);
  });

  it("scrolls the card sideways at every width instead of clipping the columns", () => {
    const rules = bodies(ED_CSS, "tableCard").join("\n");
    expect(rules).toMatch(/overflow-x:\s*auto/);
    expect(rules).not.toMatch(/overflow:\s*hidden/);
  });

  it("gives the table the width its nine columns need, not a smaller guess", () => {
    const widths = bodies(ED_CSS, "table").flatMap((body) => [...body.matchAll(/min-width:\s*(\d+)px/g)]);
    expect(widths.length).toBeGreaterThan(0);
    for (const width of widths) expect(Number(width[1])).toBeGreaterThanOrEqual(1060);
  });
});

describe("Capacity forecast header wraps instead of cutting words (P112)", () => {
  it("lets the header's actions wrap", () => {
    expect(bodies(FORECAST_CSS, "headActions").some((body) => /flex-wrap:\s*wrap/.test(body))).toBe(true);
  });

  it("lets the header's words wrap and never ellipsises them", () => {
    const scope = bodies(FORECAST_CSS, "headActions").join("\n");
    expect(scope.length).toBeGreaterThan(0);
    expect(scope).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(scope).not.toMatch(/white-space:\s*nowrap/);
    expect(scope).not.toMatch(/overflow:\s*hidden/);
  });
});
