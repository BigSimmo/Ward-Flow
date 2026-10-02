import { test, describe, expect } from "vitest";
import {
  headingToSlug,
  extractSlugs,
  brokenLinksIn,
} from "../scripts/ward-flow/check-doc-links.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removePathSync } from "../scripts/retryable-fs.mjs";

describe("headingToSlug", () => {
  test("slugifies simple heading", () => {
    expect(headingToSlug("Simple Heading")).toBe("simple-heading");
  });

  test("strips HTML tags and markdown formatting", () => {
    expect(headingToSlug("Heading with <code>tags</code> and [a link](https://example.com)")).toBe(
      "heading-with-tags-and-a-link"
    );
  });

  test("strips backticks and special punctuation", () => {
    expect(headingToSlug("Section 2 · For the owner: `get_data()`")).toBe(
      "section-2-for-the-owner-get_data"
    );
  });

  test("collapses multiple spaces into single hyphen", () => {
    expect(headingToSlug("Multi   Space   Heading")).toBe("multi-space-heading");
  });
});

describe("extractSlugs", () => {
  test("extracts markdown headings with deduplication counts", () => {
    const markdown = [
      "# Overview",
      "## Details",
      "## Details",
      "### Sub details",
    ].join("\n");
    const slugs = extractSlugs(markdown);
    expect(slugs.has("overview")).toBe(true);
    expect(slugs.has("details")).toBe(true);
    expect(slugs.has("details-1")).toBe(true);
    expect(slugs.has("sub-details")).toBe(true);
  });

  test("extracts explicit HTML anchor tags and attribute markers", () => {
    const markdown = [
      '# My Section <a id="custom-anchor"></a>',
      '<span name="named-span"></span>',
      "## Header with {#custom-id}",
    ].join("\n");
    const slugs = extractSlugs(markdown);
    expect(slugs.has("my-section")).toBe(true);
    expect(slugs.has("custom-anchor")).toBe(true);
    expect(slugs.has("named-span")).toBe(true);
    expect(slugs.has("custom-id")).toBe(true);
  });
});

describe("brokenLinksIn", () => {
  test("accepts valid relative links and reports missing files", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-link-test-"));
    try {
      const docA = join(root, "docA.md");
      const docB = join(root, "docB.md");
      writeFileSync(docA, "# Doc A\nLink to [Doc B](docB.md) and [Missing](missing.md).");
      writeFileSync(docB, "# Doc B\nContent.");

      const broken = brokenLinksIn(docA, "# Doc A\nLink to [Doc B](docB.md) and [Missing](missing.md).");
      expect(broken.length).toBe(1);
      expect(broken[0].target).toBe("missing.md");
      expect(broken[0].reason).toBe("file does not exist");
    } finally {
      removePathSync(root, { recursive: true });
    }
  });

  test("validates in-file and cross-file heading anchors", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-link-anchor-test-"));
    try {
      const docA = join(root, "docA.md");
      const docB = join(root, "docB.md");
      const contentB = "# Target Header\nSome text.";
      writeFileSync(docB, contentB);

      const contentA = [
        "# Doc A",
        "Valid in-file: [Self](#doc-a)",
        "Invalid in-file: [Bad](#bad-heading)",
        "Valid cross-file: [Target](docB.md#target-header)",
        "Invalid cross-file: [Bad Target](docB.md#missing-header)",
      ].join("\n");
      writeFileSync(docA, contentA);

      const slugsB = extractSlugs(contentB);
      const slugsA = extractSlugs(contentA);
      const mockSlugGetter = (file: string) => (file === docA ? slugsA : slugsB);

      const broken = brokenLinksIn(docA, contentA, mockSlugGetter);
      expect(broken.length).toBe(2);
      expect(broken[0].target).toBe("#bad-heading");
      expect(broken[1].target).toBe("docB.md#missing-header");
    } finally {
      removePathSync(root, { recursive: true });
    }
  });

  test("accepts GitHub line-range citations for source code files", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-link-code-test-"));
    try {
      const docA = join(root, "docA.md");
      const codeFile = join(root, "module.ts");
      writeFileSync(codeFile, "export const x = 1;");

      const contentA = [
        "# Doc A",
        "Line single: [Line 10](module.ts#L10)",
        "Line range: [Lines 10-25](module.ts#L10-L25)",
        "Line range alt: [Lines 10-25](module.ts#L10-25)",
      ].join("\n");
      writeFileSync(docA, contentA);

      const broken = brokenLinksIn(docA, contentA);
      expect(broken.length).toBe(0);
    } finally {
      removePathSync(root, { recursive: true });
    }
  });

  test("ignores code blocks, external links, and external-by-design entries", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-link-exempt-test-"));
    try {
      const docA = join(root, "docA.md");
      const contentA = [
        "# Doc A",
        "External URL: [Google](https://google.com)",
        "Mailto URL: [Mail](mailto:test@example.com)",
        "Fenced code:",
        "```",
        "[Not A Link](missing-inside-fence.md)",
        "```",
        "Inline code: `[Also Not A Link](missing-in-code.md)`",
        "Exempted design link: [Design](../../../development-system.md)",
      ].join("\n");
      writeFileSync(docA, contentA);

      const broken = brokenLinksIn(docA, contentA);
      expect(broken.length).toBe(0);
    } finally {
      removePathSync(root, { recursive: true });
    }
  });
});
