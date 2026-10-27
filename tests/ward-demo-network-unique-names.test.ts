import { describe, expect, it } from "vitest";

import { demoNetwork, type DemoNetworkVariant } from "@/components/ward-management/ward-demo-network";

/**
 * Audit P005: two synthetic people shared one name ("Beryl, Noah": UM700001 and UM700241), a
 * wrong-patient trap on any screen that names people. Every generated person now has a name
 * nobody else in that network has. Synthetic seed data only.
 */
const VARIANTS: readonly DemoNetworkVariant[] = ["demo", "surge", "quiet", "winter", "ed-crisis"];

describe("demo network names (audit P005)", () => {
  for (const variant of VARIANTS) {
    it(`gives every person in the ${variant} network a name of their own`, () => {
      const seen = new Map<string, string>();
      const clashes: string[] = [];
      for (const patient of demoNetwork(variant).patients) {
        const name = `${patient.familyName}, ${patient.givenName}`;
        const other = seen.get(name);
        if (other) clashes.push(`${name}: ${other} and ${patient.umrn}`);
        else seen.set(name, patient.umrn);
      }
      expect(clashes).toEqual([]);
    });
  }
});
