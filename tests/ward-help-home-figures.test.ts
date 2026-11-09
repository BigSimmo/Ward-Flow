import { describe, expect, it } from "vitest";
import { SCREEN_HELP } from "@/components/ward-management/help/ward-help-content";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

describe("Explain this number: Home's figures in Help", () => {
  it("names all three figures and takes the bed alert line from its one source", () => {
    const entry = SCREEN_HELP.command?.questions?.find((each) => /figures at the top of Home/u.test(each.question));
    expect(entry).toBeDefined();
    for (const words of ["Open ED movements", "Beds ready", "at risk", "beds in use"]) {
      expect(entry?.answer).toContain(words);
    }
    expect(entry?.answer).toContain(`${CLINICAL_VALUES.bedAlertLine.value}% or more`);
  });
});
