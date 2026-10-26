import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/components/ward-management/legal-forms/legal-forms-view";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";

// Forms 3B and 3C share the opening words of their register titles, so a cut-off name read the
// same (layout thread, 26 Oct). Each now names the other, and the movement row leads with the code.
describe("Forms 3B and 3C read differently", () => {
  it("names the other form and the difference in the requirements sheet", () => {
    const tip = (code: string) => CATALOGUE.find((entry) => entry.code === code)?.tip ?? "";
    expect(tip("3B")).toContain("Not the same as Form 3C");
    expect(tip("3C")).toContain("Not the same as Form 3B");
    expect(tip("3C")).toContain("further examination by a psychiatrist");
    expect(tip("3A")).not.toContain("Not the same as");
  });

  it("leads with the code, so a cut-off name still tells them apart", () => {
    expect(legalFormName({ code: "3B" }).startsWith("Form 3B")).toBe(true);
    expect(legalFormName({ code: "3C" }).startsWith("Form 3C")).toBe(true);
  });
});
