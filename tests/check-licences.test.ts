import { describe, expect, it } from "vitest";
import { licenceInventory, licenceAllowed } from "../scripts/check-licences.mjs";

describe("production licence inventory", () => {
  it("includes optional runtime packages but excludes development-only packages", () => {
    expect(
      licenceInventory({
        packages: {
          "": {},
          "node_modules/demo": { version: "1", license: "MIT" },
          "node_modules/platform": { version: "2", optional: true, license: "LGPL-3.0-or-later" },
          "node_modules/test": { dev: true, license: "GPL-3.0" },
        },
      }),
    ).toEqual([
      { path: "node_modules/demo", version: "1", licence: "MIT", allowed: true },
      { path: "node_modules/platform", version: "2", licence: "LGPL-3.0-or-later", allowed: false },
    ]);
  });
  it("honours SPDX AND and OR and rejects unknown or missing expressions", () => {
    for (const licence of ["MIT", "(MIT OR GPL-3.0-only)", "Apache-2.0 AND MIT", "BSD-2-Clause"])
      expect(licenceAllowed(licence)).toBe(true);
    for (const licence of ["MIT AND LGPL-3.0-or-later", "MIT WITH custom-exception", "", "(MIT OR)", "MIT trailing"])
      expect(licenceAllowed(licence)).toBe(false);
  });
});
