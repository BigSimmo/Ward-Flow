import { describe, expect, it } from "vitest";
import { knownFailurePattern, knownFailureTitles } from "../scripts/ward-flow/known-journey-failures.mjs";

const LIST = [
  "# Browser journeys excluded from the gate",
  "tests\\ui-ward-search.spec.ts:104 | no column of the results table escapes its scroll container, and the page never scrolls sideways, at 375/641/700/760/820px",
  "tests\\ui-ward-forced-colors.spec.ts:395 | @mockup does repointing --ward-border under forced colours change what is painted?",
  "",
].join("\n");

describe("known-failing journeys list", () => {
  it("reads the titles and ignores comments and blank lines", () => {
    expect(knownFailureTitles(LIST)).toHaveLength(2);
  });

  it("matches listed titles literally, even with regex characters, and nothing else", () => {
    const pattern = knownFailurePattern(LIST);
    expect(pattern).not.toBeNull();
    expect(
      pattern!.test(
        "@mockup Ward search › no column of the results table escapes its scroll container, and the page never scrolls sideways, at 375/641/700/760/820px",
      ),
    ).toBe(true);
    expect(pattern!.test("x @mockup does repointing --ward-border under forced colours change what is painted?")).toBe(
      true,
    );
    expect(pattern!.test("@mockup does repointing --ward-border under forced colours change what is painted")).toBe(
      false,
    );
    expect(pattern!.test("CONTROL: the search screen renders its composer")).toBe(false);
  });

  it("gives no pattern for an empty list", () => {
    expect(knownFailurePattern("# nothing\n")).toBeNull();
  });
});
