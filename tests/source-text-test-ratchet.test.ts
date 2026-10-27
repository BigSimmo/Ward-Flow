import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// CQ-10 (code-quality audit 26 Oct 2026, H-0912): about 200 test files read app source as text and
// assert on it. Many are deliberate wording or structure guards, but a text match can pass while
// the behaviour is wrong, and a harmless edit can break one. This ratchet keeps the number from
// growing while the old ones are converted as they are touched.
//
// A test file counts when it calls a file read and names a path under `src/` in a string. That is a
// heuristic, so the list below is the measured set on 27 Oct 2026, not a judgement on each file.
//
// When this goes red because a new file appears: write the test so it renders or calls the code
// instead. If reading the source really is the point (a guard over every file in src, say), add the
// file to the list and say why in the PR. When it goes red because a listed file no longer reads
// source, or is gone: take it off the list. The list only shrinks by itself.

const projectRoot = path.resolve(import.meta.dirname, "..");
const testsRoot = path.join(projectRoot, "tests");
const listPath = path.join(testsRoot, "source-text-tests.json");
const self = "tests/source-text-test-ratchet.test.ts";

const fileRead = /readFileSync|readFile\(|readSource|readText/;
const sourcePath = /["'`][^"'`\n]*\bsrc\//;

function testFiles(): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (/\.test\.tsx?$/.test(entry.name))
        files.push(path.relative(projectRoot, filePath).split(path.sep).join("/"));
    }
  };
  visit(testsRoot);
  return files.sort();
}

function readsSourceAsText(file: string): boolean {
  const text = fs.readFileSync(path.join(projectRoot, file), "utf8");
  return fileRead.test(text) && sourcePath.test(text);
}

const listed: string[] = JSON.parse(fs.readFileSync(listPath, "utf8")).files;
const found = testFiles().filter((file) => file !== self && readsSourceAsText(file));

describe("source-text test ratchet (CQ-10)", () => {
  it("adds no new test that reads app source as text", () => {
    const added = found.filter((file) => !listed.includes(file));
    expect(added, "these tests read src as text; test behaviour instead, or list them with a reason").toEqual([]);
  });

  it("takes converted or deleted tests off the list", () => {
    const stale = listed.filter((file) => !found.includes(file));
    expect(stale, "these no longer read src as text (or are gone); remove them from source-text-tests.json").toEqual(
      [],
    );
  });

  it("keeps the list sorted and free of repeats", () => {
    expect(listed).toEqual([...new Set(listed)].sort());
  });
});
