import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GET } from "../src/app/mockups/ward-flow-digest/route";

/**
 * The digest route serves docs/ward-flow/mockups/ward-flow-digest.html as-is, but that design
 * reference links to the Google Fonts stylesheet, which the app's CSP (style-src 'self'
 * 'unsafe-inline') blocks in the browser. The route strips those <link> tags before responding;
 * this proves the stripping happens (not that the source file simply lacks the links).
 */
describe("ward-flow-digest route", () => {
  it("the source design reference still contains the Google Fonts link (so the route's stripping is the thing under test)", () => {
    const source = readFileSync(resolve(process.cwd(), "docs/ward-flow/mockups/ward-flow-digest.html"), "utf8");
    expect(source).toContain("fonts.googleapis.com");
  });

  it("serves the digest HTML with the Google Fonts links removed", async () => {
    const response = await GET();
    const body = await response.text();

    // The digest HTML is a fragment (no <html> tag) — its <title> is the anchor that proves this
    // is the digest content, not an empty or unrelated response.
    expect(body).toContain("<title>Ward Flow Digest</title>");
    expect(body).not.toContain("fonts.googleapis.com");
    expect(body).not.toContain("fonts.gstatic.com");
  });
});
