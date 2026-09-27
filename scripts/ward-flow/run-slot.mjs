#!/usr/bin/env node
// Ward Flow run slots (Josh, 25 September 2026): one WIDE run on the PC at a time (full ward suite,
// build, journeys, screenshot runs) and up to two NARROW runs (full tsc, generator checks, organise
// check), fold gates first. Light work (editing, single-file tests) never needs a slot.
//
//   node scripts/ward-flow/run-slot.mjs run wide|narrow "<thread>" [--gate] -- <command> [args...]
//   node scripts/ward-flow/run-slot.mjs status
//
// `run` waits for a slot, runs the command, and always frees the slot afterwards. It claims a slot by
// creating a folder (atomic: two runs can never both get it), writes a line to gate-running.md so
// people can see it, and removes both when the command ends.
//   - Before claiming, it checks the processor averages 70% or less and at least 4 GB is free
//     (skipped with --gate, and on machines without PowerShell).
//   - A fold gate (--gate) goes first: while a gate holds or waits for the wide slot, other wide runs
//     wait, and narrow runs outside a gate wait while any wide run is going.
//   - A slot whose process is gone is stale and is cleared; the owner's process id is checked, not
//     just the age. A slot over 60 minutes old whose process is alive is reported, not broken.
// Exit code is the command's, or 3 if it could not get a slot within --wait minutes.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commitLogs } from "./logs-commit.mjs";

const LOGS = process.env.WARD_FLOW_LOGS ?? "D:/Repos/ward-flow-logs";
const SLOTS = path.join(LOGS, "slots");
const BOARD = path.join(LOGS, "gate-running.md");
const LIMIT = { wide: 1, narrow: 2 };
const POLL_MS = 20_000;
export const defaultWaitMinutes = (gate) => (gate ? 30 : 5);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
};

function holders() {
  if (!existsSync(SLOTS)) return [];
  const list = [];
  for (const name of readdirSync(SLOTS)) {
    const dir = path.join(SLOTS, name);
    let owner = null;
    try {
      owner = JSON.parse(readFileSync(path.join(dir, "owner.json"), "utf8"));
    } catch {
      // a folder still being written, or broken
    }
    if (owner && !alive(owner.pid)) {
      rmSync(dir, { recursive: true, force: true });
      removeBoardLine(owner.line);
      console.log(`run-slot: cleared a stale ${owner.kind} slot left by "${owner.who}" (process gone).`);
      continue;
    }
    list.push({ name, dir, owner });
  }
  return list;
}

function boardLines() {
  return existsSync(BOARD) ? readFileSync(BOARD, "utf8").split(/\r?\n/).filter(Boolean) : [];
}
function removeBoardLine(line) {
  if (!line) return;
  const kept = boardLines().filter((entry) => entry !== line);
  writeFileSync(BOARD, kept.length ? `${kept.join("\n")}\n` : "");
}
function addBoardLine(line) {
  writeFileSync(BOARD, `${[...boardLines(), line].join("\n")}\n`);
}

function machineHasRoom() {
  const probe = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "((Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 2 -MaxSamples 5).CounterSamples | Measure-Object CookedValue -Average).Average; (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB",
    ],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (probe.status !== 0) return { ok: true, note: "processor check unavailable" };
  const [cpu, freeGb] = probe.stdout.trim().split(/\s+/).map(Number);
  return { ok: cpu <= 70 && freeGb >= 4, note: `processor ${Math.round(cpu)}%, ${freeGb.toFixed(1)} GB free` };
}

/** Cheap scheduling check only. Atomic mkdir remains the authority for claiming a slot. */
export function slotUnavailable(kind, gate, current) {
  const wideBusy = current.some((slot) => slot.owner?.kind === "wide");
  const gateWaiting = current.some((slot) => slot.name.startsWith("gate-waiting"));
  if (kind === "wide" && !gate && gateWaiting) return "fold gate waiting";
  if (kind === "narrow" && !gate && wideBusy) return "wide run active";
  const names = new Set(current.map((slot) => slot.name));
  for (let index = 1; index <= LIMIT[kind]; index++) {
    if (!names.has(`${kind}-${index}`)) return null;
  }
  return `all ${kind} slots occupied`;
}

export function admissionRoom(kind, gate, current, probe = machineHasRoom) {
  const unavailable = slotUnavailable(kind, gate, current);
  if (unavailable) return { ok: false, note: unavailable };
  return gate ? { ok: true, note: "fold gate" } : probe();
}

function tryClaim(kind, who, gate) {
  // Re-read after the processor probe: another caller may have claimed or queued in the meantime.
  if (slotUnavailable(kind, gate, holders())) return null;
  for (let index = 1; index <= LIMIT[kind]; index++) {
    const dir = path.join(SLOTS, `${kind}-${index}`);
    try {
      mkdirSync(dir);
    } catch {
      continue;
    }
    const at = new Date().toISOString();
    const line = `${gate ? "GATE RUNNING" : `RUN | ${kind}`} | ${who} | ${at} (run-slot, pid ${process.pid})`;
    writeFileSync(
      path.join(dir, "owner.json"),
      JSON.stringify({ kind, who, gate, pid: process.pid, at, line }, null, 2),
    );
    addBoardLine(line);
    return { dir, line };
  }
  return null;
}

/**
 * Start the command WITHOUT a shell, so every argument arrives exactly as given (a shell mangled
 * `bash -c '...'` and killed a gate on 25 September). `node` uses this Node binary. Only Windows
 * `.cmd` launchers (npm, npx, pnpm, yarn) need cmd.exe; they run as `cmd /d /s /c "<quoted>"`.
 */
export function spawnCommand(command, spawnImpl = spawn) {
  const [program, ...rest] = command;
  if (program === "node") return spawnImpl(process.execPath, rest, { stdio: "inherit" });
  if (process.platform === "win32" && /^(npm|npx|pnpm|yarn)(\.cmd)?$/i.test(program)) {
    const quoted = command.map((part) => (/[\s"&|<>^]/.test(part) ? `"${part.replace(/"/g, '""')}"` : part));
    return spawnImpl("cmd.exe", ["/d", "/s", "/c", `"${quoted.join(" ")}"`], {
      stdio: "inherit",
      windowsVerbatimArguments: true,
    });
  }
  return spawnImpl(program, rest, { stdio: "inherit" });
}

async function run(kind, who, gate, waitMinutes, command) {
  mkdirSync(SLOTS, { recursive: true });
  const deadline = Date.now() + waitMinutes * 60_000;
  let marker = null;
  if (gate && kind === "wide") {
    marker = path.join(SLOTS, `gate-waiting-${process.pid}`);
    mkdirSync(marker, { recursive: true });
    writeFileSync(
      path.join(marker, "owner.json"),
      JSON.stringify({ kind: "gate-waiting", who, pid: process.pid, at: new Date().toISOString() }),
    );
  }
  let slot = null;
  try {
    while (!slot) {
      // Do not spend ten seconds sampling CPU when scheduling already forbids admission.
      // A fresh resource probe is still required whenever a non-gate caller could be admitted.
      const room = admissionRoom(kind, gate, holders());
      if (room.ok) slot = tryClaim(kind, who, gate);
      if (slot) {
        console.log(`run-slot: ${kind} slot claimed by "${who}" (${room.note}).`);
        break;
      }
      if (Date.now() >= deadline) {
        console.log(`run-slot: no ${kind} slot after ${waitMinutes} minutes (${room.note}). Tell the coordinator.`);
        return 3;
      }
      for (const { owner } of holders()) {
        if (owner && Date.now() - Date.parse(owner.at) > 60 * 60_000) {
          console.log(
            `run-slot: ${owner.kind} slot held by "${owner.who}" for over 60 minutes (process alive). Report it.`,
          );
        }
      }
      await sleep(Math.min(POLL_MS, Math.max(0, deadline - Date.now())));
    }
  } finally {
    if (marker) rmSync(marker, { recursive: true, force: true });
  }
  const release = () => {
    rmSync(slot.dir, { recursive: true, force: true });
    removeBoardLine(slot.line);
  };
  process.on("SIGINT", () => {
    release();
    process.exit(130);
  });
  const child = spawnCommand(command);
  const started = Date.now();
  const heartbeat = setInterval(() => {
    console.log(`run-slot: "${who}" still running after ${Math.round((Date.now() - started) / 60_000)} minute(s).`);
  }, 60_000);
  const code = await new Promise((resolve) => {
    child.on("error", (error) => {
      console.log(`run-slot: could not start the command: ${error.message}`);
      resolve(1);
    });
    child.on("close", (status) => resolve(status ?? 1));
  });
  clearInterval(heartbeat);
  release();
  return code;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (isMain) {
  const argv = process.argv.slice(2);
  const [action] = argv;
  if (action === "status") {
    const list = holders();
    if (list.length === 0) console.log("run-slot: all slots free.");
    for (const { name, owner } of list)
      console.log(`${name}: ${owner ? `${owner.who} since ${owner.at}` : "being written"}`);
    process.exit(0);
  }
  const dashDash = argv.indexOf("--");
  const kind = argv[1];
  const who = argv[2];
  if (action !== "run" || !["wide", "narrow"].includes(kind) || !who || dashDash < 0 || dashDash === argv.length - 1) {
    console.log('Usage: run-slot.mjs run wide|narrow "<thread>" [--gate] [--wait <minutes>] -- <command...> | status');
    process.exit(2);
  }
  const options = argv.slice(3, dashDash);
  const gate = options.includes("--gate");
  const waitMinutes = options.includes("--wait")
    ? Number(options[options.indexOf("--wait") + 1])
    : defaultWaitMinutes(gate);
  if (!Number.isFinite(waitMinutes) || waitMinutes < 0) {
    console.log("run-slot: --wait must be a non-negative number of minutes.");
    process.exit(2);
  }
  const code = await run(kind, who, gate, waitMinutes, argv.slice(dashDash + 1));
  // Save any change to the shared notes (fold queue, sign-outs, this board) into their history.
  try {
    commitLogs(`after ${kind} run by ${who}`);
  } catch {
    // Never fail the caller over the notes history.
  }
  process.exit(code);
}
