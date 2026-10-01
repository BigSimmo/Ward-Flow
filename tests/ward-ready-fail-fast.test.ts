import { afterEach, expect, it, vi } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// Exercise the readiness orchestration without starting Git, tsc, tests or touching disk.
vi.mock("node:child_process", () => ({ execFileSync: vi.fn(), spawnSync: vi.fn() }));
vi.mock("node:fs", () => ({
  copyFileSync: vi.fn(),
  existsSync: vi.fn((file: string) => !file.endsWith("node_modules")),
  lstatSync: vi.fn(() => ({ isSymbolicLink: () => true })),
  mkdtempSync: vi.fn(() => "D:/Temp/ward-ready-fixture"),
  realpathSync: vi.fn((file: string) => file),
  rmSync: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it.each([0, 1, null])("readiness preserves verdict and cleanup for typecheck exit %s", async (status) => {
  vi.resetModules();
  vi.mocked(execFileSync).mockImplementation((_command, args) => {
    if (args?.[0] === "remote") return args[1] === "get-url" ? "https://github.com/BigSimmo/Ward-Flow.git" : "origin";
    if (args?.[0] === "diff") return "M\tsrc/components/ward-management/alerts/alerts-screen.tsx\n";
    return "fixture-commit";
  });
  vi.mocked(spawnSync).mockImplementation((_command, args) => {
    if (args?.[0] === "merge-tree")
      return { status: 0, stdout: "fixture-tree\n", stderr: "", pid: 0, output: [], signal: null };
    return {
      status: args?.includes("--incremental") ? status : 0,
      stdout: "",
      stderr: "",
      pid: 0,
      output: [],
      signal: null,
    };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  const exit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("fixture exit");
  });
  await expect(import("../scripts/ward-flow/ready-check.mjs")).rejects.toThrow("fixture exit");
  const ranTests = vi
    .mocked(spawnSync)
    .mock.calls.some(([, args]) => args?.some((arg) => arg.endsWith("related-tests.mjs")));
  expect(ranTests).toBe(status === 0);
  expect(exit).toHaveBeenCalledWith(status === 0 ? 0 : 1);
  expect(rmSync).toHaveBeenCalledWith("D:/Temp/ward-ready-fixture", { recursive: true, force: true });
});
