import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HERO_PAGES, PALE_PAGES, SHAPED_PAGES } from "@/app/bedchart/loading-routes";

/**
 * Audit four build clean-up (28 Nov 2026): the loading boundary cannot read the pages, so its lists
 * are kept by hand. This pins them to the folders: every page folder under src/app/bedchart sits in
 * exactly one list, and every listed path has a folder. A page with its own loading.tsx (Bed meeting)
 * draws its own placeholder and is left out.
 */
const ROOT = join(process.cwd(), "src/app/bedchart");
const folders = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !/^[_([@]/.test(entry.name))
  .map((entry) => entry.name);
const ownLoading = new Set(folders.filter((name) => existsSync(join(ROOT, name, "loading.tsx"))));
const lists = {
  shaped: Object.values(SHAPED_PAGES),
  hero: [...HERO_PAGES],
  pale: [...PALE_PAGES],
};

describe("the loading boundary's page lists", () => {
  it("has folders to check, so the test is not vacuous", () => {
    expect(folders.length).toBeGreaterThan(10);
  });

  it("puts every page folder in exactly one list", () => {
    for (const name of folders) {
      if (ownLoading.has(name)) continue;
      const path = `/bedchart/${name}`;
      const holding = Object.entries(lists).filter(([, paths]) => paths.includes(path));
      expect(
        holding.map(([list]) => list),
        `${path} must be in exactly one of SHAPED_PAGES, HERO_PAGES or PALE_PAGES`,
      ).toHaveLength(1);
    }
  });

  it("names only folders that exist, each once", () => {
    const all = [...lists.shaped, ...lists.hero, ...lists.pale];
    expect(new Set(all).size).toBe(all.length);
    for (const path of all) {
      if (path === "/bedchart") continue; // Home is the folder's own page.tsx.
      const name = path.replace(/^\/bedchart\//, "");
      expect(folders, path).toContain(name);
      expect(ownLoading.has(name), `${path} has its own loading.tsx`).toBe(false);
    }
  });
});
