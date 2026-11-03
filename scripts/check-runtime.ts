export type RuntimeCheckResult = {
  ok: boolean;
  expectedMajor: number;
  actualVersion: string;
  message: string;
};

function runtimeResult(runtimeName: string, version: string, expectedMajor: number): RuntimeCheckResult {
  const actualMajor = Number(version.split(".")[0]);

  if (!Number.isFinite(actualMajor)) {
    return {
      ok: false,
      expectedMajor,
      actualVersion: version,
      message: `Could not parse ${runtimeName} runtime version "${version}". Expected ${runtimeName} ${expectedMajor}.x.`,
    };
  }

  if (actualMajor === expectedMajor) {
    return {
      ok: true,
      expectedMajor,
      actualVersion: version,
      message: `${runtimeName} runtime ${version} matches required ${runtimeName} ${expectedMajor}.x.`,
    };
  }

  if (actualMajor < expectedMajor) {
    return {
      ok: false,
      expectedMajor,
      actualVersion: version,
      message: `${runtimeName} ${version} is too old. Use ${runtimeName} ${expectedMajor}.x for this project.`,
    };
  }

  return {
    ok: false,
    expectedMajor,
    actualVersion: version,
    message: `${runtimeName} ${version} is newer than the release target. Use ${runtimeName} ${expectedMajor}.x before release verification.`,
  };
}

// Must stay equal to the floor declared by package.json engines.node, which is
// the single source of truth. tests/check-runtime.test.ts pins the two together.
export const NODE_MINIMUM_VERSION = "24.22.1";

function isBelow(version: string, minimum: string): boolean {
  const actual = version.split(".").map(Number);
  const required = minimum.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const left = actual[index] ?? 0;
    const right = required[index] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}

export function checkNodeRuntime(
  version: string,
  expectedMajor = 24,
  minimumVersion = NODE_MINIMUM_VERSION,
): RuntimeCheckResult {
  if (!/^\d+\.\d+\.\d+$/u.test(version)) {
    return {
      ok: false,
      expectedMajor,
      actualVersion: version,
      message: `Could not parse Node runtime version "${version}". Use a stable Node ${expectedMajor}.x version from .nvmrc or .node-version.`,
    };
  }
  const result = runtimeResult("Node", version, expectedMajor);
  if (!result.ok) return result;

  // A matching major is not sufficient: installs and verification must meet
  // the stable version selected by .nvmrc and .node-version.
  if (isBelow(version, minimumVersion)) {
    return {
      ok: false,
      expectedMajor,
      actualVersion: version,
      // Name the existing pins and require activation in the invoking shell.
      message:
        `Node ${version} is below the ${minimumVersion} floor this project requires (package.json engines.node). ` +
        `Use your Node version manager to select the version pinned in .nvmrc or .node-version, ` +
        `then run \`node --version\` in the current shell before retrying.`,
    };
  }

  return result;
}

export function checkNpmRuntime(
  userAgent = process.env.npm_config_user_agent ?? "",
  expectedMajor = 11,
): RuntimeCheckResult {
  if (!userAgent) {
    return {
      ok: true,
      expectedMajor,
      actualVersion: "unknown",
      message: `npm runtime was not detected; skipping npm ${expectedMajor}.x check outside npm script execution.`,
    };
  }

  const version = userAgent.match(/\bnpm\/([^\s]+)/)?.[1] ?? "unknown";
  return runtimeResult("npm", version, expectedMajor);
}

function main() {
  const results = [checkNodeRuntime(process.versions.node), checkNpmRuntime()];
  for (const result of results) {
    console.log(`[Runtime Check] ${result.ok ? "PASS" : "FAIL"}: ${result.message}`);
  }
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("check-runtime.ts")) {
  main();
}
