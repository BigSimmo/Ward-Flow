import { describe, expect, it } from "vitest";

import { deskOpens, EVERY_LOGIN } from "@/components/ward-management/help/ward-help-access";
import {
  CHECKLIST_SUBTITLE,
  CHECKLIST_TICK_IDS,
  CHECKLISTS,
  checklistForDesk,
  checklistsForDesk,
  parseChecklistTicks,
  serialiseChecklistTicks,
} from "@/components/ward-management/help/ward-help-checklists";
import { howToHref } from "@/components/ward-management/help/ward-help-href";
import { HOW_TO_IDS } from "@/components/ward-management/help/ward-help-howto";

describe("guided checklists (Josh, 2 Nov 2026, approved word for word)", () => {
  it("keeps the approved wording, in order", () => {
    expect(
      CHECKLISTS.map((checklist) => [checklist.id, checklist.title, checklist.steps.map((step) => step.text)]),
    ).toEqual([
      [
        "start-of-shift",
        "Start of shift",
        [
          "Open Home and work down My list: Act now first, then referrals to decide.",
          "Open Alerts in the header for everything addressed to this desk.",
          "On Capacity, ask for an update when a ward's figure is old.",
          "On Waiting, use Due soon or on you, Form due and For handover.",
          "Check “Is it saved?”: a short message after each action says it was recorded.",
        ],
      ],
      [
        "handover",
        "Handover",
        [
          "Read Act now first, then anything due before the next handover.",
          "Chase the overdue ward promises first.",
          "Check the Before you sign list.",
          "Choose Sign off.",
          "Print handover and Present are under More.",
        ],
      ],
      [
        "bed-meeting",
        "Bed meeting",
        [
          "On Capacity, read Mismatch: people waiting against beds that fit, for each kind of bed.",
          "Open Bed meeting, or Open on TV for the meeting room screen (read only).",
          "On Referrals, press Bed meeting to open the agenda at its referrals.",
          "On Out of area, copy the bed meeting summary from the header.",
        ],
      ],
      [
        "downtime",
        "If Ward Flow is down",
        [
          "Tell the bed coordinator on shift. They decide when everyone switches to paper.",
          "Use the printed Downtime pack: beds by ward, the ED queue, pending moves and legal forms.",
          "Work from paper and the phone until the coordinator says Ward Flow is back.",
          "Then record what happened in the meantime.",
        ],
      ],
    ]);
    expect(CHECKLISTS[0]?.steps[0]?.note).toBe("Each row opens the record it is about.");
    expect(CHECKLIST_SUBTITLE).toBe("Reminders only. Ticking a step records nothing.");
    for (const checklist of CHECKLISTS) expect(checklist.subtitle).toBe(CHECKLIST_SUBTITLE);
  });

  it("names its desks: the coordinator, every login that opens Handover, and every desk", () => {
    const desks = Object.fromEntries(CHECKLISTS.map((checklist) => [checklist.id, checklist.desks]));
    expect(desks["start-of-shift"]).toEqual(["coordinator"]);
    expect(desks["bed-meeting"]).toEqual(["coordinator"]);
    expect(desks.downtime).toBe("all");
    expect(desks.handover).toEqual(EVERY_LOGIN.filter((role) => deskOpens(role, "handover")));
  });

  it("names only Show mes that exist, and places some desk may open", () => {
    for (const step of CHECKLISTS.flatMap((checklist) => checklist.steps)) {
      if (step.showMe) expect(HOW_TO_IDS.has(step.showMe), step.showMe).toBe(true);
      if (step.go) {
        const opens = EVERY_LOGIN.some((role) => howToHref(step.go, role, "/ward-flow") !== undefined);
        expect(opens, step.go).toBe(true);
      }
    }
  });

  it("gives each desk only its checklists, dropping links it cannot use but keeping the step", () => {
    expect(checklistsForDesk("coordinator").map((checklist) => checklist.id)).toEqual([
      "start-of-shift",
      "handover",
      "bed-meeting",
      "downtime",
    ]);
    for (const role of EVERY_LOGIN) {
      for (const checklist of checklistsForDesk(role)) {
        const source = CHECKLISTS.find((each) => each.id === checklist.id);
        expect(checklist.steps.map((step) => step.text)).toEqual(source?.steps.map((step) => step.text));
        for (const step of checklist.steps) {
          if (step.go) expect(howToHref(step.go, role, "/ward-flow")).toBeDefined();
        }
      }
    }
    const noHandover = EVERY_LOGIN.find((role) => !deskOpens(role, "handover"));
    if (noHandover) {
      expect(checklistForDesk("handover", noHandover)).toBeUndefined();
      expect(checklistForDesk("downtime", noHandover)?.steps[1]?.showMe).toBeUndefined();
    }
    expect(checklistForDesk("start-of-shift", "ward")).toBeUndefined();
  });

  it("reads back known tick ids only", () => {
    expect(CHECKLIST_TICK_IDS.has("handover:4")).toBe(true);
    expect([...parseChecklistTicks("handover:0,bogus,handover:9,downtime:3,handover:0")]).toEqual([
      "handover:0",
      "downtime:3",
    ]);
    expect(parseChecklistTicks(null).size).toBe(0);
    expect(serialiseChecklistTicks(["downtime:1", "typed words", "downtime:1"])).toBe("downtime:1");
  });
});
