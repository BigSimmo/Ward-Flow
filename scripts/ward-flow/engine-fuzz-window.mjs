import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ENGINE_FUZZ_SEQUENCES = 16;
export const ENGINE_FUZZ_STEPS = 100;

/** Each UTC day gets a distinct non-overlapping window within the 32-bit generator range. */
export function engineFuzzWindow(date = new Date().toISOString().slice(0, 10)) {
  const instant = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !Number.isFinite(instant) ||
    new Date(instant).toISOString().slice(0, 10) !== date
  )
    throw new Error("Expected a valid UTC date YYYY-MM-DD");
  const day = Math.floor(instant / 86_400_000);
  const windows = Math.floor((2 ** 32 - 1) / ENGINE_FUZZ_SEQUENCES);
  const firstSeed = 1 + (((day % windows) + windows) % windows) * ENGINE_FUZZ_SEQUENCES;
  return {
    schemaVersion: 1,
    strategy: "utc-day-window-v1",
    generator: "mulberry32",
    date,
    firstSeed,
    lastSeed: firstSeed + ENGINE_FUZZ_SEQUENCES - 1,
    sequences: ENGINE_FUZZ_SEQUENCES,
    steps: ENGINE_FUZZ_STEPS,
    eventBudget: ENGINE_FUZZ_SEQUENCES * ENGINE_FUZZ_STEPS,
  };
}

export function engineFuzzEnvironment(window) {
  return {
    WARD_ENGINE_FUZZ_FIRST_SEED: String(window.firstSeed),
    WARD_ENGINE_FUZZ_SEQUENCES: String(window.sequences),
    WARD_ENGINE_FUZZ_STEPS: String(window.steps),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!["--date", "--output", "--github-env"].includes(args[index]) || !args[index + 1])
      throw new Error("usage: engine-fuzz-window.mjs [--date YYYY-MM-DD] [--output PATH] [--github-env PATH]");
    options[args[index]] = args[index + 1];
  }
  const window = engineFuzzWindow(options["--date"]);
  const json = `${JSON.stringify(window, null, 2)}\n`;
  if (options["--output"]) {
    mkdirSync(path.dirname(options["--output"]), { recursive: true });
    writeFileSync(options["--output"], json);
  }
  if (options["--github-env"])
    appendFileSync(
      options["--github-env"],
      Object.entries(engineFuzzEnvironment(window))
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
  process.stdout.write(json);
}
