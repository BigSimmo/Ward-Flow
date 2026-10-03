import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { checkLinksIn, headingIds, inlineLinks, main, selectFiles } from "../scripts/ward-flow/check-doc-links.mjs";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ward-doclinks-"));
  roots.push(root);
  mkdirSync(join(root, "docs", "ward-flow"), { recursive: true });
  const file = join(root, "README.md");
  writeFileSync(file, "# Home\n");
  return { root, file };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) removePathSync(root, { recursive: true });
});

describe("offline documentation links", () => {
  it("selects maintained root files explicitly and rejects missing/escaping/non-Markdown selections", () => {
    const { root, file } = fixture();
    expect(selectFiles(["--file", "README.md", "--file", "README.md", "--anchors"], root)).toEqual({
      files: [file],
      explicit: true,
      anchors: true,
    });
    expect(() => selectFiles(["--file", "missing.md"], root)).toThrow();
    expect(() => selectFiles(["--file", "../outside.md"], root)).toThrow(/Invalid/);
    expect(() => selectFiles(["--file", "package.json"], root)).toThrow(/Invalid/);
    expect(() => selectFiles(["--unknown"], root)).toThrow(/Usage/);
  });

  it("keeps default Ward scope and reports missing local paths without fetching URLs", () => {
    const { root, file } = fixture();
    const ward = join(root, "docs", "ward-flow", "guide.md");
    writeFileSync(ward, "# Guide\n");
    expect(selectFiles([], root)).toEqual({ files: [ward], explicit: false, anchors: false });
    const result = checkLinksIn(
      file,
      "[ok](docs/ward-flow/guide.md) [bad](missing.md) [web](https://invalid.example/a) [mail](mailto:x@example.invalid)",
      { root },
    );
    expect(result.broken).toEqual([expect.objectContaining({ target: "missing.md", reason: "missing path" })]);
    expect(result.advisory).toEqual([]);
  });

  it.each(["docs", "docs/ward-flow"])(
    "refuses a default tree whose %s parent resolves outside the repository",
    (selectedParent) => {
      const { root } = fixture();
      const outside = mkdtempSync(join(tmpdir(), "ward-doclinks-outside-"));
      roots.push(outside);
      mkdirSync(join(outside, "ward-flow"));
      writeFileSync(join(outside, "outside.md"), "# Outside\n");
      writeFileSync(join(outside, "ward-flow", "outside.md"), "# Outside\n");
      removePathSync(join(root, selectedParent), { recursive: true });
      symlinkSync(outside, join(root, selectedParent), "junction");
      expect(() => selectFiles([], root)).toThrow(/outside repository/);
      expect(() => selectFiles(["--file", `${selectedParent}/outside.md`], root)).toThrow(/repository file/);
    },
  );

  it("checks same-file and cross-file supported headings including duplicate and setext headings", () => {
    const { root, file } = fixture();
    const other = join(root, "guide.md");
    writeFileSync(other, '# **Hello** `world`!\n# Hello world!\nSetext title\n============\n<a id="manual"></a>\n');
    const source =
      "# Home\n[home](#home) [one](guide.md#hello-world) [two](guide.md#hello-world-1) [setext](guide.md#setext-title) [id](guide.md#manual) [gone](guide.md#removed)";
    expect(checkLinksIn(file, source, { root, anchors: true }).broken).toEqual([
      expect.objectContaining({ target: "guide.md#removed" }),
    ]);
    expect(checkLinksIn(file, source, { root }).broken).toEqual([]);
  });

  it("does not invent headings or links from fenced and inline examples", () => {
    const { root, file } = fixture();
    const source =
      "# Real\n```md\n# Fake\n[bad](missing.md)\n```\n~~~md\n# Also fake\n[bad](missing2.md)\n~~~\n`[bad](missing3.md)`\n[real](#real)";
    expect([...headingIds(source)]).toEqual(["real"]);
    expect(checkLinksIn(file, source, { root, anchors: true }).broken).toEqual([]);
  });

  it("keeps inline code across LF boundaries out of links and explicit HTML IDs", () => {
    const { root, file } = fixture();
    const source =
      '# A `code` heading\n`[example](missing.md)\ncontinued`\n`<a id="ghost"></a>`\n[real](#a-code-heading)\n[ghost](#ghost)';
    expect([...headingIds(source)]).toEqual(["a-code-heading"]);
    expect(checkLinksIn(file, source, { root, anchors: true }).broken).toEqual([
      expect.objectContaining({ target: "#ghost", line: 6 }),
    ]);
    expect(inlineLinks("``[example](missing.md)\n` continued``\n[actual](missing2.md)")).toEqual([
      { raw: "missing2.md", line: 3 },
    ]);
  });

  it("checks LF-spanning inline link labels and retains their starting line", () => {
    const { root, file } = fixture();
    expect(checkLinksIn(file, "Intro\n[two\nlines](missing.md)", { root }).broken).toEqual([
      expect.objectContaining({ target: "missing.md", line: 2 }),
    ]);
  });

  it("accepts encoded/angle paths, titles and balanced parentheses", () => {
    const { root, file } = fixture();
    writeFileSync(join(root, "my guide.md"), "# Heading\n");
    writeFileSync(join(root, "guide(v2).md"), "# Heading\n");
    const source = '[encoded](my%20guide.md#heading "Title") [angle](<my guide.md> "Title") [paren](guide(v2).md)';
    expect(inlineLinks(source).map((item: { raw: string }) => item.raw)).toEqual([
      "my%20guide.md#heading",
      "my guide.md",
      "guide(v2).md",
    ]);
    expect(checkLinksIn(file, source, { root, anchors: true }).broken).toEqual([]);
  });

  it("checks nested route labels rather than silently losing their destinations", () => {
    const { root, file } = fixture();
    expect(checkLinksIn(file, "[board/[unitId]/page.tsx](missing.md)", { root }).broken).toEqual([
      expect.objectContaining({ target: "missing.md" }),
    ]);
  });

  it("does not treat unfinished link syntax as an actual missing destination", () => {
    expect(inlineLinks("[draft](missing.md\n[angle](<missing.md>\n")).toEqual([]);
  });

  it("keeps code line ranges and forensic evidence advisory", () => {
    const { root, file } = fixture();
    writeFileSync(join(root, "source.ts"), "export {};\n");
    const result = checkLinksIn(file, "[source](source.ts#L1-L2) [old](file:///retired/worktree/report.md)", {
      root,
      anchors: true,
    });
    expect(result.broken).toEqual([]);
    expect(result.advisory.map((item: { reason: string }) => item.reason)).toEqual([
      "code line reference (bounds not checked)",
      "nonportable file evidence",
    ]);
  });

  it("does not globally exempt an outside-repository lesson path", () => {
    const { root, file } = fixture();
    expect(checkLinksIn(file, "[outside](../../../development-system.md)", { root }).broken).toEqual([
      expect.objectContaining({ reason: "outside repository" }),
    ]);
  });

  it("fails selected maintained missing targets while excluding preserved history and unselected files", () => {
    const { root, file } = fixture();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    writeFileSync(join(root, "unselected.md"), "[bad](unselected-missing.md)\n");
    writeFileSync(
      file,
      "# Home\n<!-- docs-script-refs:historical-start -->\n[old](retired.md)\n<!-- docs-script-refs:historical-end -->\n",
    );
    expect(main(["--file", "README.md", "--anchors"], root)).toBe(0);
    writeFileSync(file, "# Home\n[bad](missing.md)\n");
    expect(main(["--file", "README.md"], root)).toBe(1);
    writeFileSync(file, "<!-- docs-script-refs:historical-start -->\n");
    expect(() => main(["--file", "README.md"], root)).toThrow(/Unclosed/);
  });

  it("rejects invalid encoded destinations rather than skipping them", () => {
    const { root, file } = fixture();
    expect(checkLinksIn(file, "[bad](%ZZ.md)", { root }).broken).toEqual([
      expect.objectContaining({ reason: "invalid URI encoding" }),
    ]);
  });
});
