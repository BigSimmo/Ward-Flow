import { afterEach, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { codeName, SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { filterGlossary } from "@/components/ward-management/help/ward-help-content";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";

afterEach(() => activateScenarioNetwork("standard"));

it("uses active fictional names for abbreviations and glossary, then switches back", () => {
  activateScenarioNetwork("wa-synthetic");
  expect(codeName("SYN-QUARTZ")).toBe("Fictional Quartz Hospital");
  expect(renderToStaticMarkup(<SpelledCodes text="From SYN-QUARTZ" />)).toContain('title="Fictional Quartz Hospital"');
  expect(filterGlossary("SYN-QUARTZ")).toEqual([{ term: "SYN-QUARTZ", meaning: "Fictional Quartz Hospital" }]);
  expect(filterGlossary("Royal Perth")).toEqual([]);
  activateScenarioNetwork("standard");
  expect(codeName("SYN-QUARTZ")).toBeUndefined();
  expect(codeName("RPH")).toBeDefined();
  expect(filterGlossary("SYN-QUARTZ")).toEqual([]);
});
