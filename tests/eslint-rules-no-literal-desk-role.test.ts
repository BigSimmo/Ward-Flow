import { ESLint, Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

import rule from "../eslint-rules/no-literal-desk-role.mjs";
import { NO_LITERAL_DESK_ROLE_BASELINE } from "../eslint-rules/no-literal-desk-role-baseline.mjs";

// R-STRUCT-1/3 (D-222, D-223, Josh 14 Nov 2026): the session's desk is stamped on every change, so a
// literal desk role in a dispatched change is a ratchet that only shrinks.
const linter = new Linter();

function lint(code: string, max = 0) {
  return linter.verify(code, {
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { local: { rules: { "no-literal-desk-role": rule } } },
    rules: { "local/no-literal-desk-role": ["error", { max }] },
  });
}

describe("no-literal-desk-role", () => {
  it("flags a change that types its desk role", () => {
    expect(lint('dispatch({ type: "CONFIRM_CAPACITY", role: "ward", unitId });')).toHaveLength(1);
    expect(lint('const raise = useWardRaise("coordinator");')).toHaveLength(1);
    expect(lint('wardRaise(dispatch, "ed", now)("RECORD_EXAMINATION", {});')).toHaveLength(1);
  });

  it("leaves the desk's own role, the demonstration controls and non-change objects alone", () => {
    expect(lint('dispatch({ type: "CONFIRM_CAPACITY", role: desk.role, unitId });')).toHaveLength(0);
    expect(lint('dispatch({ type: "ADVANCE_CLOCK", role: "demo", minutes: 15 });')).toHaveLength(0);
    expect(lint('const option = { type: "button", role: "ward" };')).toHaveLength(0);
    expect(lint("const raise = useWardRaise(routeRole);")).toHaveLength(0);
  });

  it("lets a file keep its baseline count and refuses one more", () => {
    const two = 'a({ type: "A_B", role: "ward" }); b({ type: "C_D", role: "ed" });';
    expect(lint(two, 2)).toHaveLength(0);
    expect(lint(two, 1)).toHaveLength(1);
  });
});

describe("the baseline follows the files down", () => {
  const entries = Object.entries(NO_LITERAL_DESK_ROLE_BASELINE) as [string, number][];
  const counts = new Map<string, number>();

  beforeAll(async () => {
    const eslint = new ESLint({
      cwd: process.cwd(),
      cache: false,
      ruleFilter: ({ ruleId }) => ruleId === "local/no-literal-desk-role",
      overrideConfig: { rules: { "local/no-literal-desk-role": ["error", { max: 0 }] } },
    });
    for (const result of await eslint.lintFiles(entries.map(([file]) => file))) {
      const file = entries.find(([entry]) => result.filePath.endsWith(entry))?.[0] ?? result.filePath;
      counts.set(file, result.messages.filter((message) => message.ruleId === "local/no-literal-desk-role").length);
    }
  }, 120_000);

  it("holds each file's count exactly, so a removed literal lowers the baseline", () => {
    const loose = entries
      .filter(([file, max]) => counts.get(file) !== max)
      .map(([file, max]) => `${file}: baseline ${max}, file ${counts.get(file) ?? "missing"}`);
    expect(loose, "lower or delete these entries in eslint-rules/no-literal-desk-role-baseline.mjs").toEqual([]);
  });
});
