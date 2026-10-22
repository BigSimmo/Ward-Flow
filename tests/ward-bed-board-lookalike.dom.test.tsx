import { describe, expect, it } from "vitest";

import { cellWord, lookAlikeKeys } from "@/components/ward-management/ward/ward-bed-board";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";

describe("Bed board names that look alike (Audit 1, Josh 20 Oct, CS-16)", () => {
  const bed = (patientAlias: string, status: BedItem["status"] = "occupied") => ({ status, patientAlias }) as BedItem;

  it("counts a surname that starts the other as look-alike, with the same initial", () => {
    const keys = lookAlikeKeys([bed("Delia Kestrel"), bed("Dana Kestrelworth"), bed("Mara Kestrel")]);
    expect(keys).toEqual(new Set(["kestrel|D", "kestrelworth|D"]));
  });

  it("still counts an identical surname and initial, and ignores free beds", () => {
    expect([...lookAlikeKeys([bed("Iris Ferrowm"), bed("Ivo Ferrowm")])]).toEqual(["ferrowm|I"]);
    expect(lookAlikeKeys([bed("Iris Ferrowm"), bed("Ivo Ferrowm", "ready")]).size).toBe(0);
  });

  it("names a held bed by surname and initial", () => {
    expect(cellWord({ status: "ready", heldFor: "Delia Kestrel" } as BedItem)).toBe("Pulled, Kestrel, D");
  });
});
