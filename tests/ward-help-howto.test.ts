import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { looksLikeHelpQuestion } from "@/components/ward-management/help/ward-help-events";
import { HOW_TOS, askHelp, closestHowTos, questionWords } from "@/components/ward-management/help/ward-help-howto";
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
    for (const matches of [askHelp("ward flow down", paperOnly), closestHowTos("down", paperOnly, 50)]) {
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
