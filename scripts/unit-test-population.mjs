// One offline collection contract shared by Vitest and the required batch gate.
export const NODE_UNIT_TEST_GLOBS = ["tests/**/*.test.ts"];
export const DOM_UNIT_TEST_GLOBS = ["tests/**/*.dom.test.tsx", "tests/**/*.contract.test.tsx"];
export const LIVE_UNIT_TEST_GLOBS = ["tests/**/*.live.test.ts"];

export function offlineUnitTestProject(file) {
  const relative = file.replace(/\\/g, "/");
  if (!relative.startsWith("tests/") || relative.split("/").includes("..")) return null;
  if (relative.endsWith(".live.test.ts")) return null;
  if (relative.endsWith(".test.ts")) return "node";
  if (relative.endsWith(".dom.test.tsx") || relative.endsWith(".contract.test.tsx")) return "jsdom";
  return null;
}

export const isOfflineUnitTestFile = (file) => offlineUnitTestProject(file) !== null;
