// npm preinstall hook. The Dockerfile COPYs this file on its own before
// `npm ci`, so it stays import-free and restates the range as a literal;
// tests/check-runtime.test.ts pins this string to package.json engines.node,
// which remains the single source of truth.
const nodeRange = ">=24.22.1 <25";
const minimum = nodeRange.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
const exclusiveMajor = nodeRange.match(/<\s*(\d+)/);

if (!minimum || !exclusiveMajor) {
  console.error(`Could not read the supported Node range from package.json engines.node ("${nodeRange}").`);
  process.exit(1);
}

const required = [Number(minimum[1]), Number(minimum[2]), Number(minimum[3])];
const maxMajor = Number(exclusiveMajor[1]);
const nodeVersion = process.versions.node;
if (!/^\d+\.\d+\.\d+$/u.test(nodeVersion)) {
  console.error(`This project must be installed with a stable Node ${nodeRange}. Current runtime: ${nodeVersion}.`);
  process.exit(1);
}
const actual = nodeVersion.split(".").map(Number);

const belowFloor =
  actual[0] < required[0] ||
  (actual[0] === required[0] && actual[1] < required[1]) ||
  (actual[0] === required[0] && actual[1] === required[1] && actual[2] < required[2]);

// Keep installs on the stable Node 24 line at or above the repository pin.
if (belowFloor || actual[0] >= maxMajor) {
  console.error(`This project must be installed with Node ${nodeRange}. Current runtime: ${process.versions.node}.`);
  process.exit(1);
}

const npmUserAgent = process.env.npm_config_user_agent ?? "";
const npmVersion = npmUserAgent.match(/\bnpm\/(\d+\.\d+\.\d+)/)?.[1] ?? "";
const npmMajor = Number(npmVersion.split(".")[0]);

if (npmVersion && npmMajor !== 11) {
  console.error(`This project must be installed with npm 11.x. Current npm runtime: ${npmVersion}.`);
  process.exit(1);
}
