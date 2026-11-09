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

describe("bed alert line tests the whole number shown (D-109)", () => {
  it("alerts at 84.5% (shown as 85%) and not at 84.4% (shown as 84%)", async () => {
    const { isBedAlert, formatOccupancyPercent } =
      await import("@/components/ward-management/shell/ward-service-bed-alerts");
    expect(formatOccupancyPercent(84.5)).toBe("85%");
    expect(isBedAlert(84.5)).toBe(true);
    expect(formatOccupancyPercent(84.4)).toBe("84%");
    expect(isBedAlert(84.4)).toBe(false);
  });
});
