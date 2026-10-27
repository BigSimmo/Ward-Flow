import { describe, expect, it } from "vitest";

import { cellWord, lookAlikeKeys } from "@/components/ward-management/ward/ward-bed-board";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";

describe("Bed board names that look alike (Audit 1, Josh 20 Oct, CS-16)", () => {
  const bed = (patientAlias: string, status: BedItem["status"] = "occupied") => ({ status, patientAlias }) as BedItem;

  it("counts a surname that starts the other as look-alike, with the same given name", () => {
    const keys = lookAlikeKeys([bed("Delia Kestrel"), bed("Delia Kestrelworth"), bed("Mara Kestrel")]);
    expect(keys).toEqual(new Set(["kestrel|delia", "kestrelworth|delia"]));
  });

  it("still counts an identical surname and given name, and ignores free beds", () => {
    expect([...lookAlikeKeys([bed("Iris Ferrowm"), bed("Iris Ferrowm")])]).toEqual(["ferrowm|iris"]);
    expect(lookAlikeKeys([bed("Iris Ferrowm"), bed("Ivo Ferrowm")]).size).toBe(0);
    expect(lookAlikeKeys([bed("Iris Ferrowm"), bed("Iris Ferrowm", "ready")]).size).toBe(0);
  });

  it("names a pulled bed by surname and given name in full (D-83)", () => {
    expect(cellWord({ status: "ready", heldFor: "Delia Kestrel" } as BedItem)).toBe("Pulled, Kestrel, Delia");
  });
});
