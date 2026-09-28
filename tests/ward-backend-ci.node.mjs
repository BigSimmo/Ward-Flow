import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const validate = /^  validate:\n([\s\S]*?)(?=^  required:)/m.exec(workflow)?.[1] ?? "";

function step(name) {
  const marker = `      - name: ${name}\n`;
  const start = validate.indexOf(marker);
  if (start < 0) return "";
  const end = validate.indexOf("\n      - name:", start + marker.length);
  return validate.slice(start, end < 0 ? undefined : end);
}

test("required Ward validation installs and tests the nested backend when present", () => {
  const install = step("Install locked Ward backend dependencies");
  const backendTest = step("Run Ward backend tests");

  assert.match(install, /id: backend-install/u);
  assert.match(install, /steps\.plan\.outputs\.full == 'true'/u);
  assert.match(install, /hashFiles\('backend\/ward-flow\/package\.json'\) != ''/u);
  assert.match(install, /working-directory: backend\/ward-flow/u);
  assert.match(install, /run: npm ci --ignore-scripts/u);
  assert.match(backendTest, /steps\.backend-install\.outcome == 'success'/u);
  assert.match(backendTest, /working-directory: backend\/ward-flow/u);
  assert.match(backendTest, /run: npm test/u);
  assert.ok(validate.indexOf(install) < validate.indexOf(backendTest));
  assert.doesNotMatch(validate, /continue-on-error:/u);
  assert.match(workflow, /^  required:\n[\s\S]*?needs: \[validate\]/mu);
  assert.match(workflow, /check-contracts\.mjs && node --test tests\/ward-backend-ci\.node\.mjs/u);
});
