import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  admissionRoom,
  defaultWaitMinutes,
  slotUnavailable,
  spawnCommand,
  syncBoard,
} from "../scripts/ward-flow/run-slot.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";
const roots: string[] = [];
const temp = () => {
  const root = mkdtempSync(path.join(tmpdir(), "ward-run-slot-"));
  roots.push(root);
  return root;
};
const environment = (logs: string) => {
  const env: NodeJS.ProcessEnv = { ...process.env, WARD_FLOW_LOGS: logs, TEMP: logs, TMP: logs };
  delete env.CLINICAL_KB_HEAVY_LOCK_PATH;
  delete env.CLINICAL_KB_HEAVY_LOCK_TOKEN;
  return env;
};
afterEach(() => roots.splice(0).forEach((root) => removePathSync(root, { recursive: true })));

const script = path.resolve(__dirname, "../scripts/ward-flow/run-slot.mjs");

describe("run-slot", () => {
  it("status is read-only even when stale owners and foreign board lines exist", () => {
    const logs = temp(),
      slot = path.join(logs, "slots", "wide-1");
    mkdirSync(slot, { recursive: true });
    const owner = JSON.stringify({ pid: 2147483647, kind: "wide", who: "stale", at: "2000-01-01" });
    writeFileSync(path.join(slot, "owner.json"), owner);
    writeFileSync(path.join(logs, "gate-running.md"), "foreign owner\n");
    const result = spawnSync(process.execPath, [script, "status"], { encoding: "utf8", env: environment(logs) });
    expect(result.status).toBe(0);
    expect(readFileSync(path.join(slot, "owner.json"), "utf8")).toBe(owner);
    expect(readFileSync(path.join(logs, "gate-running.md"), "utf8")).toBe("foreign owner\n");
    expect(existsSync(path.join(logs, "slots", "board.lock"))).toBe(false);
  });
  it("board reconciliation preserves foreign lines and derives both owned holders", () => {
    const logs = temp();
    writeFileSync(path.join(logs, "gate-running.md"), "foreign owner\nold (run-slot, pid 99)\n");
    for (const [name, line] of [
      ["narrow-1", "one (run-slot, pid 1)"],
      ["narrow-2", "two (run-slot, pid 2)"],
    ]) {
      const dir = path.join(logs, "slots", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "owner.json"), JSON.stringify({ pid: process.pid, line }));
    }
    syncBoard(logs);
    expect(readFileSync(path.join(logs, "gate-running.md"), "utf8")).toBe(
      "foreign owner\none (run-slot, pid 1)\ntwo (run-slot, pid 2)\n",
    );
  });
  it("bounds routine waits while giving fold gates time to acquire the shared slot", () => {
    expect(defaultWaitMinutes(false)).toBe(5);
    expect(defaultWaitMinutes(true)).toBe(30);
  });

  it.each([
    ["narrow", false, [{ name: "wide-1", owner: { kind: "wide" } }]],
    ["wide", false, [{ name: "gate-waiting-123", owner: { kind: "gate-waiting" } }]],
    ["wide", true, [{ name: "wide-1", owner: { kind: "wide" } }]],
    [
      "narrow",
      false,
      [
        { name: "narrow-1", owner: null },
        { name: "narrow-2", owner: null },
      ],
    ],
  ])("does not probe CPU when scheduling blocks %s (gate %s)", (kind, gate, holders) => {
    const probe = vi.fn(() => ({ ok: true, note: "unused" }));
    expect(admissionRoom(kind, gate, holders, probe).ok).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });

  it("requires a fresh resource verdict for each available non-gate admission", () => {
    const probe = vi
      .fn()
      .mockReturnValueOnce({ ok: false, note: "processor 95%, 3.0 GB free" })
      .mockReturnValueOnce({ ok: true, note: "processor 30%, 8.0 GB free" });
    expect(admissionRoom("narrow", false, [], probe).ok).toBe(false);
    expect(admissionRoom("narrow", false, [], probe).ok).toBe(true);
    expect(probe).toHaveBeenCalledTimes(2);
    expect(
      slotUnavailable("narrow", false, [
        { name: "narrow-1", owner: { kind: "narrow" } },
        { name: "narrow-2", owner: { kind: "narrow" } },
      ]),
    ).not.toBeNull();
  });

  it("preserves the existing same-gate narrow exception without bypassing slot capacity", () => {
    const probe = vi.fn();
    expect(admissionRoom("narrow", true, [{ name: "wide-1", owner: { kind: "wide" } }], probe).ok).toBe(true);
    expect(probe).not.toHaveBeenCalled();
  });

  it("refuses a busy slot without starting the command or changing its owner", () => {
    const logs = temp();
    const slot = path.join(logs, "slots", "wide-1");
    mkdirSync(slot, { recursive: true });
    const owner = JSON.stringify({ kind: "wide", pid: process.pid, at: new Date().toISOString() });
    writeFileSync(path.join(slot, "owner.json"), owner);
    const result = spawnSync(
      process.execPath,
      [script, "run", "narrow", "blocked-test", "--wait", "0", "--", "node", "-e", "process.exit(99)"],
      { encoding: "utf8", timeout: 5000, env: environment(logs) },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(3);
    expect(result.stdout).toContain("wide run active");
    expect(readFileSync(path.join(slot, "owner.json"), "utf8")).toBe(owner);
  });

  it.each(["-1", "NaN", "Infinity"])("rejects invalid wait %s before claiming a slot", (wait) => {
    const logs = temp();
    const result = spawnSync(
      process.execPath,
      [script, "run", "narrow", "invalid", "--wait", wait, "--", "node", "-e", "process.exit(99)"],
      { encoding: "utf8", timeout: 5000, env: environment(logs) },
    );
    expect(result.status).toBe(2);
  });
  it("passes arguments through without a shell, so bash -c '...' arrives intact", () => {
    const logs = temp();
    const out = path.join(logs, "out.txt");
    const result = spawnSync(
      process.execPath,
      [
        script,
        "run",
        "narrow",
        "test",
        "--gate",
        "--wait",
        "0",
        "--",
        "node",
        "-e",
        `require("fs").writeFileSync(${JSON.stringify(out)}, "a b 'c' \\"d\\" & e")`,
      ],
      { encoding: "utf8", timeout: 15000, env: environment(logs) },
    );
    expect(result.status).toBe(0);
    expect(readFileSync(out, "utf8")).toBe(`a b 'c' "d" & e`);
    // The slot line is removed again once the command ends.
    expect(readFileSync(path.join(logs, "gate-running.md"), "utf8").trim()).toBe("");
  });

  it("returns the command's own exit code", () => {
    const logs = temp();
    const result = spawnSync(
      process.execPath,
      [script, "run", "narrow", "test", "--gate", "--", "node", "-e", "process.exit(7)"],
      {
        encoding: "utf8",
        timeout: 15000,
        env: environment(logs),
      },
    );
    expect(result.status).toBe(7);
  });

  it("spawns programs directly, using the shell only for Windows .cmd launchers", () => {
    const calls: Array<[string, string[], Record<string, unknown>]> = [];
    const fake = ((program: string, args: string[], options: Record<string, unknown>) => {
      calls.push([program, args, options]);
      return {};
    }) as never;
    spawnCommand(["bash", "-c", "echo 'x y'"], fake);
    expect(calls[0][0]).toBe("bash");
    expect(calls[0][1]).toEqual(["-c", "echo 'x y'"]);
    expect(calls[0][2].shell).toBeUndefined();
    spawnCommand(["node", "a.mjs"], fake);
    expect(calls[1][0]).toBe(process.execPath);
  });
});
