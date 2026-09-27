import { describe, expect, it } from "vitest";

import { generateMetadata } from "@/app/mockups/ward-flow/ward/[unitId]/page";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE TAB KEEPS THE WARD'S NAME. The `h1` does not, and that is deliberate.**
 *
 * Task A1 makes the on-screen `h1` the constant **Ward**, per the drawing. **A browser showing
 * twenty-three tabs all reading "Ward" has lost the only thing that told them apart**, so the
 * document title carries what the heading gave up.
 *
 * ⚠️ **THIS FILE EXISTS BECAUSE THE DOM SUITE STRUCTURALLY CANNOT SEE IT.**
 * `ward-screen-third-edition-headings.dom.test.tsx` renders the COMPONENT; `generateMetadata` is the
 * ROUTE's, runs on the server, and never appears in that render. **A screen whose tab said "Ward"
 * for every ward would pass every assertion in the DOM suite** — the two files cover one change
 * between them and neither covers it alone.
 *
 * ⚠️ **POPULATION — what a green here walks.** `generateMetadata` alone, over several seeded units
 * and one unresolvable id. It says nothing about what the screen renders, nothing about the tab a
 * real browser paints, and nothing about the other fifteen routes.
 */

describe("the ward route's document title", () => {
  const units = allUnits();
  const walked = units.slice(0, 4);

  it("has several distinctly-named units, so the assertions below can discriminate", () => {
    expect(units.length, "no units in the fixture — every case below would be vacuous").toBeGreaterThan(3);
    expect(
      new Set(walked.map((unit) => unit.name)).size,
      "the walked units share a name, so a title hard-coding one could not be caught",
    ).toBe(walked.length);
  });

  it("names the ward, differently for each ward", async () => {
    const titles: string[] = [];

    for (const unit of walked) {
      const metadata = await generateMetadata({ params: Promise.resolve({ unitId: unit.id }) });
      expect(metadata.title, `the tab for ${unit.name} does not carry its name`).toBe(`Ward — ${unit.name}`);
      titles.push(String(metadata.title));
    }

    expect(
      new Set(titles).size,
      "every ward produced the same tab title — which is the defect this file exists to catch",
    ).toBe(walked.length);
  });

  /**
   * ⚠️ **An unresolvable id must not render a tab claiming a ward.** The screen shows "Ward not
   * found"; a title reading "Ward — undefined", or silently reading the last ward's name, would tell
   * a coordinator they are looking at a ward that this address does not name.
   */
  it("says so when the id names no ward, rather than inventing one", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ unitId: "no-such-ward-2026" }) });

    expect(String(metadata.title), "an unresolvable ward id produced a title that still claims a ward").not.toMatch(
      /—\s*(undefined|null)?\s*$/u,
    );
    expect(metadata.title, "an unresolvable ward id does not say so in the tab").toBe("Ward not found — Ward Flow");
  });
});
