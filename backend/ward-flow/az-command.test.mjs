import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { azInvocation, azResponse, executeAz, priorDeployment, escapeWindowsArgument } from "./az-command.mjs";

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

test("every platform bounds CLI execution and preserves a longer deployment budget", () => {
  for (const platform of ["linux", "win32"]) {
    assert.equal(azInvocation(["account", "show"], platform).options.timeout, 120_000);
    assert.equal(azInvocation(["account", "show"], platform).options.killSignal, "SIGKILL");
    assert.equal(azInvocation(["deployment", "group", "create"], platform).options.timeout, 600_000);
  }
});

test("a hanging local child times out after receiving correctly quoted Node arguments", async () => {
  const { options } = azInvocation(["account", "show"], "linux");
  const started = performance.now();
  // A small test budget exercises the supervised timeout without running Azure or waiting
  // for the production budget. The child has no descendants or external effects.
  const result = await executeAz({
    command: process.execPath,
    args: ["-e", 'process.stdout.write("started");setInterval(() => {}, 1000)'],
    options: { ...options, timeout: 10_000 },
  });
  assert.equal(result.stdout, "started", "the fixture must actually run before the timeout");
  assert.equal(result.error?.code, "ETIMEDOUT");
  assert.ok(performance.now() - started < 20_000, "the hanging child must not hold the caller indefinitely");
  if (process.platform === "win32") assert.equal(result.treeTermination?.status, 0);
  assert.throws(
    () => azResponse(result, ["account", "show"]),
    /timed out; the provider operation may still be running/,
  );
});

test("process failure paths are explicit and do not expose provider output", () => {
  for (const [failure, reason] of [
    [{ error: { code: "ETIMEDOUT" } }, /timed out/],
    [{ error: { code: "ENOENT" } }, /execution error ENOENT/],
    [{ error: { code: "ETREEKILL" } }, /process-tree termination could not be confirmed/],
    [{ signal: "SIGTERM" }, /terminated by signal SIGTERM/],
    [{ status: null }, /missing exit status/],
    [{ status: 2 }, /exit status 2/],
  ]) {
    assert.throws(
      () =>
        azResponse(
          { status: 0, stdout: "synthetic-sensitive-output", stderr: "synthetic-sensitive-output", ...failure },
          ["account", "show"],
        ),
      (error) => {
        assert.match(error.message, /Azure command failed \(account show\)/);
        assert.match(error.message, reason);
        assert.doesNotMatch(error.message, /synthetic-sensitive-output/);
        return true;
      },
    );
  }
});

test("response validation accepts declared shapes and refuses missing directory fields", () => {
  const result = (stdout) => ({ status: 0, stdout });
  assert.deepEqual(
    azResponse(result('{"id":"synthetic","tenantId":"synthetic"}'), ["account", "show"], "object", ["id", "tenantId"]),
    { id: "synthetic", tenantId: "synthetic" },
  );
  assert.deepEqual(azResponse(result("[]"), ["postgres", "flexible-server", "list"], "array"), []);
  assert.deepEqual(azResponse(result('[{"name":"synthetic"}]'), ["postgres", "flexible-server", "list"], "array"), [
    { name: "synthetic" },
  ]);
  assert.equal(azResponse(result(""), ["functionapp", "cors", "add"], "none"), null);
  assert.throws(
    () => azResponse(result('{"id":42}'), ["account", "show"], "object", ["id", "tenantId"]),
    /missing required string fields/,
  );
  for (const output of ["", "  ", "not-json", "null", "[]", "42"]) {
    assert.throws(() => azResponse(result(output), ["account", "show"]), /Azure response invalid \(account show\)/);
  }
});

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
    const result = await executeAz({ ...call, options: { ...call.options, env } });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), hostile);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("a timed-out database deployment is resumed rather than blocking setup retries", () => {
  const name = "wardflow-shared-database";
  assert.equal(priorDeployment([], name), null);
  assert.equal(priorDeployment([{ name: "other", properties: { provisioningState: "Succeeded" } }], name), null);
  const done = {
    name,
    properties: { provisioningState: "Succeeded", outputs: { functionSubnetId: { value: "/sub/x" } } },
  };
  assert.equal(priorDeployment([done], name), done);
  for (const state of ["Running", "Accepted", "Deleting"])
    assert.throws(() => priorDeployment([{ name, properties: { provisioningState: state } }], name), /still running/);
  assert.throws(() => priorDeployment([{ name, properties: { provisioningState: "Failed" } }], name), /Failed/);
});
test(
  "a Windows timeout terminates the mock az.cmd descendant before returning",
  { skip: process.platform !== "win32" },
  async () => {
    const folder = await mkdtemp(join(tmpdir(), "ward-flow-az-tree-"));
    const heartbeat = join(folder, "heartbeat.json");
    const ended = join(folder, "ended.json");
    await writeFile(
      join(folder, "child.mjs"),
      `import fs from 'node:fs';const tick=()=>fs.writeFileSync(${JSON.stringify(heartbeat)},JSON.stringify({pid:process.pid,at:Date.now()}));tick();const timer=setInterval(tick,50);setTimeout(()=>{clearInterval(timer);fs.writeFileSync(${JSON.stringify(ended)},'bounded fixture completed');process.exit(0)},20000);`,
    );
    await writeFile(join(folder, "az.cmd"), `@node "${join(folder, "child.mjs")}" %*\r\n`);
    const env = { ...process.env, PATH: `${folder}${delimiter}${process.env.PATH}` };
    const call = azInvocation(["account", "show"], "win32", env);
    let result;
    try {
      result = await executeAz({ ...call, options: { ...call.options, env, timeout: 10_000 } });
      const first = JSON.parse(await readFile(heartbeat, "utf8"));
      assert.ok(Number.isSafeInteger(first.pid), "the descendant must have started");
      assert.equal(result.error?.code, "ETIMEDOUT");
      assert.equal(result.treeTermination?.status, 0, "the native tree-kill must complete before reporting timeout");
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert.deepEqual(
        JSON.parse(await readFile(heartbeat, "utf8")),
        first,
        "the descendant must stop writing heartbeats",
      );
      assert.throws(() => azResponse(result, ["account", "show"]), /timed out/);
    } finally {
      // Preserve the fixture and its explicit receipt. If cleanup failed, wait for its own bounded
      // terminal marker rather than killing a PID which might have been reused by another task.
      if (result?.treeTermination?.status !== 0) {
        const until = Date.now() + 25_000;
        while (Date.now() < until) {
          try {
            await readFile(ended, "utf8");
            break;
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      await writeFile(
        join(folder, "test-terminal.json"),
        JSON.stringify({ errorCode: result?.error?.code, treeTermination: result?.treeTermination }),
      );
    }
  },
);
