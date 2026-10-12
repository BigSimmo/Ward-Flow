import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { RUNTIME_FILES } from "./package-deployment.mjs";

const providerFiles = ["providers.mjs", "supabase-config.mjs", "supabase-auth.mjs", "supabase-postgres.mjs"];

test("the explicit deployment manifest includes provider startup and lazy runtime imports", () => {
  for (const file of providerFiles) assert.ok(RUNTIME_FILES.includes(file), `Missing runtime module ${file}`);
  assert.equal(new Set(RUNTIME_FILES).size, RUNTIME_FILES.length);
  for (const file of RUNTIME_FILES) assert.doesNotMatch(file, /\.env|\.test\.mjs|SETUP|infra|migrations/);
});

const archive = process.env.WARD_TEST_DEPLOYMENT_ZIP;
test("extracted deployment ZIP loads its complete runtime module closure offline", { skip: !archive }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "wardflow-deployment-test-"));
  // The test owns this fresh absolute temporary directory. No existing checkout is modified.
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
  try {
    const python = spawnSync(
      "python",
      [
        "-c",
        "import sys; from zipfile import ZipFile; z=ZipFile(sys.argv[1]); assert z.testzip() is None; z.extractall(sys.argv[2])",
        path.resolve(archive),
        directory,
      ],
      { encoding: "utf8", timeout: 60_000 },
    );
    assert.equal(python.status, 0, python.stderr || "Archive extraction failed");
    for (const file of providerFiles) await readFile(path.join(directory, file));
    const load = `
      import { pathToFileURL } from 'node:url';
      import path from 'node:path';
      globalThis.fetch = () => { throw new Error('Provider calls are forbidden in package proof'); };
      for (const file of ['function.mjs','server.mjs','providers.mjs','config.mjs','database.mjs','auth.mjs','shared-http.mjs','postgres.mjs','push.mjs',${providerFiles.map((file) => JSON.stringify(file)).join(",")},'dist/engine.mjs']) {
        await import(pathToFileURL(path.join(process.cwd(),file)).href);
        console.log('Loaded '+file);
      }
      console.log('EXTRACTED_RUNTIME_MODULE_LOAD_PASS');
    `;
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(?:WARD_|AZURE_|AzureWebJobsStorage)/.test(key)) delete env[key];
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", load], {
      cwd: directory,
      env,
      encoding: "utf8",
      timeout: 90_000,
    });
    assert.equal(result.status, 0, [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n"));
    assert.match(result.stdout, /EXTRACTED_RUNTIME_MODULE_LOAD_PASS/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
