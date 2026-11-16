import { describe, expect, it } from "vitest";

import { hhmm, hhmm24, windowText } from "@/components/ward-management/on-call/on-call-directory";
import { clockText } from "@/components/ward-management/pull-bed-facts";
import { settingsClock } from "@/components/ward-management/settings/settings-screen-model";
import { quietHoursText } from "@/components/ward-management/shell/ward-alert-preferences";
import { shiftLine } from "@/components/ward-management/ward/ward-screen-helpers";

/**
 * Live demo walk (16 Nov 2026): times on screen read am/pm (item 13). The Pull the bed dialog and
 * pulled row, the ward's shift line, the on-call hours, provider hours and the settings times all
 * said the 24-hour face. The printed downtime card and copied text keep 24-hour. Synthetic minutes only.
 */
describe("on-screen times read am/pm (16 Nov walk)", () => {
  it("Pull the bed: Accepted and the pulled row's times", () => {
    expect(clockText(9 * 60 + 57)).toBe("9:57 am");
    expect(clockText(22 * 60 + 42)).toBe("10:42 pm");
  });

  it("the ward's shift line", () => {
    expect(shiftLine(10 * 60 + 42)).toBe("Day shift 7:00 am to 3:00 pm");
    expect(shiftLine(16 * 60)).toMatch(/ 3:00 pm to 11:00 pm$/u);
  });

  it("on-call and provider hours on screen, 24-hour for the printed card", () => {
    expect(hhmm(20 * 60)).toBe("8:00 pm");
    expect(windowText([420, 1140])).toBe("7:00 am to 7:00 pm");
    expect(windowText([420, 1140], hhmm24)).toBe("07:00 to 19:00");
    expect(windowText(null)).toBe("24 hours");
  });

  it("settings times and quiet hours", () => {
    expect(settingsClock(570)).toBe("9:30 am");
    expect(quietHoursText({ start: 22 * 60, end: 7 * 60 })).toBe("10:00 pm to 7:00 am");
  });
});
