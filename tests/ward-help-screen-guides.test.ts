import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  readScreenGuides,
  screenGuideHtml,
  screenGuideMarkdown,
  writeScreenGuides,
} from "../scripts/build-help-cheat-sheets.mjs";
import { printScreenGuides } from "@/components/ward-management/help-content/ward-help-print";
import { SCREEN_HELP } from "@/components/ward-management/help/ward-help-content";
import { HOW_TOS } from "@/components/ward-management/help/ward-help-howto";
import { SCREEN_TOURS } from "@/components/ward-management/help/ward-help-screen-tours";

/**
 * Printable screen guides and the Help health check (Josh, 2 Nov 2026). Each screen walk round has a
 * one-page A4 guide generated from the same source, so paper and app say the same thing; and every
 * screen with help either has a walk round or is named here with the reason it has none.
 */

const guides = printScreenGuides();

/** Screens with help but no walk round, and why. A new screen must be walked or added here. */
const NOT_WALKED: Readonly<Record<string, string>> = {
  community: "Opens Places, Catchments, which has its own walk round (catchments).",
  "bed-finder": "A sheet from Tools, not a page; the See which wards have a bed that fits job walks it.",
};

describe("Help health check", () => {
  it("walks every screen with help, or names why not", () => {
    const walked = new Set(SCREEN_TOURS.map((tour) => tour.around));
    for (const screen of Object.keys(SCREEN_HELP)) {
      if (walked.has(screen)) continue;
      expect(NOT_WALKED[screen], `${screen} has help but no walk round and no reason given`).toBeTruthy();
    }
    for (const screen of Object.keys(NOT_WALKED)) expect(walked.has(screen), screen).toBe(false);
  });

  it("keeps every how-to's id, title and answer usable", () => {
    for (const howTo of HOW_TOS) {
      expect(howTo.id, howTo.title).toMatch(/^[a-z0-9-]{1,60}$/);
      expect(howTo.title.trim().length, howTo.id).toBeGreaterThan(5);
      expect(howTo.answer.trim().length, howTo.id).toBeGreaterThan(20);
      for (const step of howTo.showMe ?? []) {
        expect(step.title.trim().length, `${howTo.id}: ${step.title}`).toBeGreaterThan(2);
        expect(step.body.trim().length, `${howTo.id}: ${step.title}`).toBeGreaterThan(10);
      }
    }
  });
});

describe("printable screen guides", () => {
  it("prints one guide per walk round, with the same steps Show me lights on a computer", async () => {
    expect(guides).toHaveLength(SCREEN_TOURS.length);
    expect(await readScreenGuides()).toEqual(guides);
    for (const guide of guides) {
      const tour = SCREEN_TOURS.find((each) => each.around === guide.id)!;
      expect(guide.parts.length, guide.id).toBe(tour.showMe!.filter((step) => step.device !== "phone").length);
      expect(screenGuideMarkdown(guide)).toContain(guide.title);
      expect(existsSync(path.resolve(`public/help/screens/${guide.id}.html`)), guide.id).toBe(true);
    }
    expect(guides.find((guide) => guide.id === "legal-forms")?.jobs.join(" ")).toMatch(/Record a new legal form/);
  });

  it("regenerates every committed screen guide without a diff", async () => {
    expect(await writeScreenGuides(path.resolve("public/help/screens"), guides, true)).toBe(guides.length);
  });

  it("writes the same documents twice in a fresh folder", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "ward-help-screens-test-"));
    try {
      await writeScreenGuides(directory, guides);
      const names = readdirSync(directory).sort();
      expect(names).toHaveLength(guides.length * 2 + 1);
      await writeScreenGuides(directory, guides);
      expect(readdirSync(directory).sort()).toEqual(names);
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it("escapes content and needs no scripts or remote resources", () => {
    const html = screenGuideHtml({ ...guides[0], title: '<script>alert("fixture")</script>' });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toMatch(/<script|https?:|<iframe|<img/iu);
    expect(html).toContain("@page{size:A4");
  });
});
