import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { looksLikeHelpQuestion } from "@/components/ward-management/help/ward-help-events";
import {
  HOW_TOS,
  askHelp,
  canShowMe,
  closestHowTos,
  questionWords,
  showMeSteps,
} from "@/components/ward-management/help/ward-help-howto";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";

/**
 * Ask help (Josh, 26 Oct 2026): a typed question finds the how-to answers, with no AI, and every
 * Show me step points at a control the source still carries.
 */

function sourceText(dir: string): string {
  return readdirSync(dir)
    .map((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceText(path);
      return /\.(tsx?|mts)$/.test(name) && !path.includes("ward-help-howto") ? readFileSync(path, "utf8") : "";
    })
    .join("\n");
}

const SOURCE = sourceText(join(process.cwd(), "src"));
const first = (query: string, role: Parameters<typeof askHelp>[1] = "coordinator") => askHelp(query, role)[0]?.howTo.id;

describe("how-to list", () => {
  it("has unique ids, known desks and a short answer each", () => {
    const desks = new Set([...Object.keys(CHROME_ROLE_LABELS), "admin"]);
    expect(new Set(HOW_TOS.map((howTo) => howTo.id)).size).toBe(HOW_TOS.length);
    for (const howTo of HOW_TOS) {
      if (howTo.desks !== "all") for (const desk of howTo.desks) expect(desks.has(desk), howTo.id).toBe(true);
      expect(howTo.answer.length, howTo.id).toBeLessThan(330);
    }
  });

  it("points every Show me step at a test id or setting the screens still carry", () => {
    for (const howTo of HOW_TOS) {
      for (const step of howTo.showMe ?? []) {
        const targets = step.target === undefined ? [] : Array.isArray(step.target) ? step.target : [step.target];
        for (const [, attribute, , value] of targets.flatMap((each) => [
          ...each.sel.matchAll(/\[(data-testid|data-setting)(\^?)="([^"]+)"\]/g),
        ])) {
          const written = attribute === "data-setting" ? `setting="${value}"` : value;
          // A test id built from a template ("movements-group-toggle-${id}") counts by its fixed start.
          const templated = [...value.matchAll(/-/g)].some((dash) =>
            SOURCE.includes(`${value.slice(0, (dash.index ?? 0) + 1)}\${`),
          );
          expect(SOURCE.includes(written) || templated, `${howTo.id}: ${value}`).toBe(true);
        }
      }
    }
  });

  it("keeps Statistics navigation on a phone without offering its desktop-only export step", () => {
    const statistics = HOW_TOS.find((howTo) => howTo.id === "statistics");
    expect(statistics).toBeDefined();
    expect(showMeSteps(statistics, true).map((step) => step.title)).toEqual(["Choose a view"]);
    expect(showMeSteps(statistics, false).map((step) => step.title)).toEqual(["Choose a view", "Export the figures"]);
  });

  it("can find a patient from the Patients page where the header search is absent", () => {
    const search = HOW_TOS.find((howTo) => howTo.id === "search-patient");
    const target = showMeSteps(search, false)[0]?.target;
    const targets = target === undefined ? [] : Array.isArray(target) ? target : [target];
    expect(targets.map((entry) => entry.sel)).toEqual([
      '[data-testid="ward-global-search-input"]',
      '[data-testid="ward-patient-typeahead-input"]',
    ]);
    expect(search?.answer).toContain("search on Patients");
  });

  it("keeps the next transport action inside the selected job, including when it has no next action", () => {
    const steps = showMeSteps(
      HOW_TOS.find((howTo) => howTo.id === "transport-job"),
      true,
    );
    const target = steps[1]?.target;
    const targets = target === undefined ? [] : Array.isArray(target) ? target : [target];
    expect(targets).toHaveLength(2);
    for (const entry of targets) {
      expect(entry.sel).toMatch(/^\[data-testid="ward-officer-detail"\]/);
      expect(entry.sel).not.toContain("ward-officer-next-");
      expect(entry.sel).not.toContain('aria-label="Next action"');
    }
    for (const stage of ["accept", "enroute", "collect", "arrive"]) {
      expect(targets[0]?.sel).toContain(`ward-officer-${stage}-`);
    }
    // A terminal selected job stays the fallback; it must never spotlight a different job's action.
    expect(targets[1]?.sel).toBe('[data-testid="ward-officer-detail"]');
  });

  it("lets a phone reopen the current Settings section before locating its controls", () => {
    for (const id of ["theme", "density", "notifications", "buzz", "rules"]) {
      const task = HOW_TOS.find((howTo) => howTo.id === id);
      const phoneSteps = showMeSteps(task, true);
      const deskSteps = showMeSteps(task, false);
      const section = id === "rules" ? "rules" : "device";
      expect(task?.go, id).toBe(`settings#${section}`);
      expect(phoneSteps[0]?.device, id).toBe("phone");
      expect(phoneSteps[0]?.continueLabel, id).toMatch(/^Open /);
      const openingTargets = JSON.stringify(phoneSteps[0]?.target);
      expect(openingTargets, id).toContain("ward-settings-phone-sheet");
      expect(openingTargets, id).toContain(`ward-settings-phone-area-${section}`);
      expect(openingTargets, id).toContain("button");
      expect(phoneSteps.slice(1), id).toEqual(deskSteps);
      expect(JSON.stringify(deskSteps), id).not.toContain("ward-settings-phone-area-");
      expect(JSON.stringify(task), id).not.toMatch(/Settings, (Display|Alerts)|phone-area-(display|alerts)/);
    }
    expect(HOW_TOS.find((howTo) => howTo.id === "tour")?.answer).toContain("Settings, Help");
  });

  it("offers no journey for an unknown task, an answer-only task or a task with no steps on this device", () => {
    expect(showMeSteps(undefined, false)).toEqual([]);
    const answer = HOW_TOS.find((howTo) => howTo.id === "undo");
    expect(showMeSteps(answer, true)).toEqual([]);
    for (const howTo of HOW_TOS.filter((task) => task.computerOnly)) {
      expect(showMeSteps(howTo, true), howTo.id).toEqual([]);
      expect(canShowMe(howTo, true), howTo.id).toBe(false);
      expect(canShowMe(howTo, false), howTo.id).toBe(true);
    }
    const phoneOnly = {
      ...HOW_TOS[0]!,
      showMe: [{ title: "Phone control", body: "Use this control on a phone.", device: "phone" as const }],
    };
    expect(canShowMe(phoneOnly, false)).toBe(false);
    expect(canShowMe(phoneOnly, true)).toBe(true);
  });

  it("hands record and form selection back to the person before highlighting controls inside them", () => {
    for (const id of [
      "pull-bed",
      "release-pulled-bed",
      "decide-referral",
      "ask-more-wards",
      "book-transport",
      "cancel-transport",
      "log-call",
      "new-referral",
      "transport-job",
      "pin-ward",
    ]) {
      const steps = showMeSteps(
        HOW_TOS.find((howTo) => howTo.id === id),
        false,
      );
      expect(steps.length, id).toBeGreaterThan(1);
      expect(steps[0]?.continueLabel, id).toMatch(/^(Open|Start) /);
    }
    const handover = showMeSteps(
      HOW_TOS.find((howTo) => howTo.id === "sign-off-handover"),
      true,
    );
    expect(handover.find((step) => step.title === "Before you sign")?.continueLabel).toBe("Open Before you sign");
  });

  it("opens Destination and its workflow disclosure before pointing at nested cancellation or release controls", () => {
    for (const [id, control] of [
      ["cancel-transport", "ward-cancel-transport-toggle"],
      ["release-pulled-bed", "ward-release-pull-toggle"],
    ] as const) {
      const steps = showMeSteps(
        HOW_TOS.find((howTo) => howTo.id === id),
        false,
      );
      const destination = steps.findIndex((step) =>
        JSON.stringify(step.target).includes("ward-patient-destination-row"),
      );
      const additional = steps.findIndex((step) =>
        JSON.stringify(step.target).includes("Additional workflow controls"),
      );
      const final = steps.findIndex((step) => JSON.stringify(step.target).includes(control));
      expect(destination, id).toBeGreaterThan(0);
      expect(additional, id).toBeGreaterThan(destination);
      expect(final, id).toBeGreaterThan(additional);
      expect(steps[destination]?.continueLabel, id).toBeTruthy();
      expect(steps[additional]?.continueLabel, id).toBeTruthy();
    }
  });

  it("opens the actual booking form and both call-form disclosures before highlighting their forms", () => {
    const booking = showMeSteps(
      HOW_TOS.find((howTo) => howTo.id === "book-transport"),
      false,
    );
    const bookingEntry = booking.findIndex((step) =>
      JSON.stringify(step.target).includes("ward-patient-gate-transport"),
    );
    const bookingForm = booking.findIndex((step) =>
      JSON.stringify(step.target).includes("ward-patient-transport-form"),
    );
    expect(bookingEntry).toBeGreaterThan(0);
    expect(bookingForm).toBeGreaterThan(bookingEntry);
    expect(booking[bookingEntry]?.continueLabel).toBeTruthy();

    for (const phone of [false, true]) {
      const calls = showMeSteps(
        HOW_TOS.find((howTo) => howTo.id === "log-call"),
        phone,
      );
      const patient = calls.findIndex((step) => JSON.stringify(step.target).includes("Show patient details"));
      const owner = calls.findIndex((step) => JSON.stringify(step.target).includes("Owner and calls"));
      const callForm = calls.findIndex((step) => JSON.stringify(step.target).includes("ward-referral-call-log-"));
      expect(patient).toBeGreaterThan(0);
      expect(owner).toBeGreaterThan(patient);
      expect(callForm).toBeGreaterThan(owner);
      expect(calls[patient]?.continueLabel).toBeTruthy();
      expect(calls[owner]?.continueLabel).toBeTruthy();
    }
  });

  it("includes the rebuilt referral match controls as well as the ward desk's own acceptance control", () => {
    const decision = HOW_TOS.find((howTo) => howTo.id === "decide-referral");
    const targets = JSON.stringify(showMeSteps(decision, false).map((step) => step.target));
    for (const control of [
      "ward-accept-",
      "ward-referral-match-phone-accept",
      "ward-referral-match-accept-community_team",
      "ward-referral-match-accept-emergency_department",
    ]) {
      expect(targets).toContain(control);
    }
  });

  it("never describes ranking, suggesting or placing for a person", () => {
    const words = HOW_TOS.map((howTo) => `${howTo.title} ${howTo.answer} ${JSON.stringify(howTo.showMe ?? [])}`).join(
      " ",
    );
    expect(words).not.toMatch(/best (match|ward)|recommended ward|risk score|acuity score|auto(-| )?(place|release)/i);
    expect(words).not.toMatch(/released automatically|returns to the ward/i);
  });
});

describe("askHelp", () => {
  it("answers the way staff ask", () => {
    expect(first("how do I pull a bed?")).toBe("pull-bed");
    expect(first("reserve a bed")).toBe("pull-bed");
    expect(first("book an ambulance")).toBe("book-transport");
    expect(first("dark mode")).toBe("theme");
    expect(first("sign off handover")).toBe("sign-off-handover");
    expect(first("put it on the telly")).toBe("tv");
    expect(first("how do i confirm numbers", "ward")).toBe("confirm-numbers");
  });

  it("lists another desk's job after this desk's, and finds nothing for noise", () => {
    const forWard = askHelp("pull a bed", "ward");
    expect(forWard.find((match) => match.howTo.id === "pull-bed")?.forThisDesk).toBe(false);
    expect(askHelp("xyzzy plover", "coordinator")).toEqual([]);
    expect(askHelp("how do I", "coordinator")).toEqual([]);
  });

  it("never points a login at another desk's twin with the same title", () => {
    const desks = HOW_TOS.find((howTo) => howTo.id === "downtime-paper")?.desks;
    const paperOnly = Array.isArray(desks) ? desks[0] : undefined;
    expect(paperOnly).toBeDefined();
    if (!paperOnly) return;
    // "last" and "saved" are only in the Handover twin's answer, so its own twin must stand in.
    for (const matches of [
      askHelp("ward flow down", paperOnly),
      askHelp("last", paperOnly),
      askHelp("Ward Flow down last saved", paperOnly),
      closestHowTos("down", paperOnly, 50),
      closestHowTos("last", paperOnly, 50),
    ]) {
      const ids = matches.map((match) => match.howTo.id);
      expect(ids).toContain("downtime-paper");
      expect(ids).not.toContain("downtime");
    }
    expect(askHelp("ward flow down", "coordinator").map((match) => match.howTo.id)).toContain("downtime");
  });

  it("gives the same answers for the same words", () => {
    expect(askHelp("cancel transport", "coordinator")).toEqual(askHelp("cancel transport", "coordinator"));
    expect(questionWords("Pulling the beds")).toEqual(["pull", "bed"]);
  });
});

describe("header search hand-over", () => {
  it("treats a question as help and a name as a search", () => {
    expect(looksLikeHelpQuestion("how do I pull a bed")).toBe(true);
    expect(looksLikeHelpQuestion("Where is Settings")).toBe(true);
    expect(looksLikeHelpQuestion("Howard")).toBe(false);
    expect(looksLikeHelpQuestion("UM100001")).toBe(false);
    expect(looksLikeHelpQuestion("how")).toBe(false);
  });
});
