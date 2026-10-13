import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import { azInvocation, escapeWindowsArgument } from "./az-command.mjs";

// Real values azure-setup passes: a JMESPath query with `||`, JSON for `--set`, a path with spaces,
// and a hostile administrator name that would run `calc` if cmd.exe saw its `&`.
const hostile = [
  "--query",
  "[?name=='AZURE_TENANT_ID' || name=='WARD_API_AUDIENCE'].{name:name}",
  "--set",
  'spa.redirectUris=["https://ward.example/mockups/ward-flow"]',
  "--template-file",
  "C:\\Users\\Ward Admin\\infra\\main.bicep",
  'administratorName=Ward" & calc & echo "Admin',
  "trailing\\",
  "100%PATH%!x!",
];

test("POSIX runs az directly with the argument array unchanged and no shell", () => {
  const call = azInvocation(hostile, "linux");
  assert.equal(call.command, "az");
  assert.deepEqual(call.args, hostile);
  assert.equal(call.options.shell, false);
});

test("Windows runs cmd.exe with verbatim, fully escaped arguments instead of shell: true", () => {
  const call = azInvocation(hostile, "win32", { ComSpec: "C:\\Windows\\system32\\cmd.exe" });
  assert.equal(call.command, "C:\\Windows\\system32\\cmd.exe");
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsVerbatimArguments, true);
  assert.deepEqual(call.args.slice(0, 3), ["/d", "/s", "/c"]);
  const line = call.args[3];
  assert.ok(line.startsWith('"az.cmd ') && line.endsWith('"'));
  // Inside the outer /s quotes, every cmd metacharacter is caret-escaped, so cmd.exe never sees a
  // bare `&`, `|`, `<`, `>`, `%` or `!` that could start another command or expand a variable.
  const body = line.slice(1, -1);
  for (const match of body.matchAll(/[&|<>%!]/g)) {
    const carets = /\^*$/.exec(body.slice(0, match.index))[0].length;
    assert.equal(carets % 2, 1, `unescaped ${match[0]} at ${match.index}`);
  }
});

test("Windows quoting follows the C runtime rules for quotes and trailing backslashes", () => {
  const unescapeCaretsTwice = (value) => value.replace(/\^(.)/g, "$1").replace(/\^(.)/g, "$1");
  assert.equal(unescapeCaretsTwice(escapeWindowsArgument('a"b')), '"a\\"b"');
  assert.equal(unescapeCaretsTwice(escapeWindowsArgument('a\\"b')), '"a\\\\\\"b"');
  assert.equal(unescapeCaretsTwice(escapeWindowsArgument("dir\\")), '"dir\\\\"');
  assert.equal(unescapeCaretsTwice(escapeWindowsArgument("a b")), '"a b"');
});

test("line breaks and NUL are refused on every platform", () => {
  for (const platform of ["linux", "win32"]) {
    assert.throws(() => azInvocation(["--name", "x\r\ncalc"], platform), /line break/);
    assert.throws(() => azInvocation(["x\0y"], platform), /NUL/);
  }
});

test("azure-setup never spawns Azure CLI through a shell", async () => {
  const source = await readFile(new URL("./azure-setup.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /shell\s*:/);
  assert.doesNotMatch(source, /spawnSync\(\s*["'`]az/);
  assert.equal((source.match(/azInvocation\(/g) ?? []).length, 2);
});

test("on Windows, az.cmd receives every argument intact", { skip: process.platform !== "win32" }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "ward-flow-az-command-"));
  try {
    await writeFile(join(folder, "echo.mjs"), "process.stdout.write(JSON.stringify(process.argv.slice(2)));");
    await writeFile(join(folder, "az.cmd"), `@node "${join(folder, "echo.mjs")}" %*\r\n`);
    const env = { ...process.env, PATH: `${folder}${delimiter}${process.env.PATH}` };
    const call = azInvocation(hostile, "win32", env);
    const result = spawnSync(call.command, call.args, { ...call.options, env });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), hostile);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
