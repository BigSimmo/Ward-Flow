const explicitUnitTestPattern = /^(?:\.?[\\/])?tests[\\/].+\.test\.[cm]?[jt]sx?$/i;
const unsafeSharedFlags = [
  /^--coverage(?:=|\.|$)/,
  /^--config(?:=|$)/,
  /^-c$/,
  /^--workspace(?:=|$)/,
  /^--max(?:-?workers)(?:=|$)/i,
  /^--min(?:-?workers)(?:=|$)/i,
  /^--pool(?:-?options)(?:=|\.|$)/i,
];

export function vitestLeaseMode(args) {
  if (args.some((argument) => unsafeSharedFlags.some((pattern) => pattern.test(argument)))) return "exclusive";

  if (args[0] === "related" && args.includes("--run")) {
    const runIndex = args.indexOf("--run");
    if (args.slice(runIndex + 1).some((argument) => !argument.startsWith("-"))) return "shared";
  }

  if (args[0] === "run" && args.slice(1).some((argument) => explicitUnitTestPattern.test(argument))) {
    return "shared";
  }

  // `run-vitest.mjs <test files>` with no subcommand (the form HOW-WE-WORK gives owners) is the same
  // focused run: explicit test files only. Without this it queued behind every wide run on the PC.
  if (
    args.length > 0 &&
    explicitUnitTestPattern.test(args[0]) &&
    args.every((argument) => argument.startsWith("-") || explicitUnitTestPattern.test(argument))
  ) {
    return "shared";
  }

  return "exclusive";
}
