import { afterEach, expect, it, vi } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import { runOwnedChild } from "../scripts/owned-child.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";

const fixture = vi.hoisted(() => ({ release: vi.fn() }));
// Exercise selected merged-tree orchestration without Git, providers or child processes.
vi.mock("node:child_process", () => ({ execFileSync: vi.fn(), spawnSync: vi.fn() }));
vi.mock("../scripts/owned-child.mjs", () => ({ runOwnedChild: vi.fn() }));
vi.mock("../scripts/test-run-lock.mjs", () => ({
  acquireHeavyRunLock: vi.fn(() => ({ environment: {}, release: fixture.release })),
}));
vi.mock("../scripts/retryable-fs.mjs", () => ({ removePathSync: vi.fn() }));
vi.mock("node:fs", async (original) => ({
  ...(await original<typeof import("node:fs")>()),
  existsSync: vi.fn(() => false),
  lstatSync: vi.fn(() => ({ isSymbolicLink: () => true })),
  mkdtempSync: vi.fn(() => "D:/Temp/ward-ready-fixture"),
  realpathSync: vi.fn((file: string) => file),
}));
const priorExitCode = process.exitCode;
afterEach(() => {
  process.exitCode = priorExitCode;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function gitFixture(changedFile: string) {
  vi.mocked(execFileSync).mockImplementation((_command, args) => {
    if (args?.[0] === "remote") return args[1] === "get-url" ? "https://github.com/BigSimmo/Ward-Flow.git" : "origin";
    if (args?.[0] === "diff") return `M\t${changedFile}\n`;
    if (args?.includes("--show-toplevel")) return process.cwd();
    return "fixture-commit";
  });
  vi.mocked(spawnSync).mockReturnValue({
    status: 0,
    stdout: "fixture-tree\n",
    stderr: "",
    pid: 0,
    output: [],
    signal: null,
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
}

it.each([0, 1, null])("static compatibility preserves verdict and cleanup for child exit %s", async (status) => {
  vi.resetModules();
  gitFixture("README.md");
  vi.mocked(runOwnedChild).mockResolvedValue({ status, signal: null, stdout: "", stderr: "" });
  await import("../scripts/ward-flow/ready-check.mjs");
  expect(process.exitCode).toBe(status === 0 ? 0 : 1);
  const commands = vi.mocked(runOwnedChild).mock.calls.map(([, args]) => args);
  expect(commands).toHaveLength(status === 0 ? 2 : 1);
  expect(commands[0]?.[0]).toContain("check-docs-script-refs.mjs");
  if (status === 0) expect(commands[1]?.[0]).toContain("check-doc-links.mjs");
  expect(realpathSync).not.toHaveBeenCalled();
  expect(removePathSync).toHaveBeenCalledWith("D:/Temp/ward-ready-fixture", { recursive: true });
  expect(fixture.release).toHaveBeenCalledOnce();
});

it("retires broad READY before allocating scratch space or starting selected checks", async () => {
  vi.resetModules();
  gitFixture("src/components/ward-management/alerts/alerts-screen.tsx");
  const exit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("fixture exit");
  });
  await expect(import("../scripts/ward-flow/ready-check.mjs")).rejects.toThrow("fixture exit");
  expect(exit).toHaveBeenCalledWith(75);
  expect(runOwnedChild).not.toHaveBeenCalled();
  expect(mkdtempSync).not.toHaveBeenCalled();
  expect(removePathSync).not.toHaveBeenCalled();
});
