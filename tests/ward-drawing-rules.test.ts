import { describe, expect, it } from "vitest";
import { checkDrawing } from "../scripts/ward-flow/check-drawing-rules.mjs";

const SHELL = `<nav class="rail" id="rail"></nav><p id="railCheck"></p>
<span title="Every figure and name on this screen is invented. Not a medical device and not clinical decision support.">Prototype</span>
<p class="railNote" title="Every ward state, movement, referral, clock and figure on this screen is invented. The hospital sites and health services are real WA names.">Every figure is invented.</p>
<script>const line = "Invented figures, reconciled with each other, as at " + t;</script>`;
const page = (body: string) => `<html><body>${SHELL}<main>${body}</main></body></html>`;
const rules = (html: string, name = "discharges-third-edition.html") => checkDrawing(html, name).map((f) => f.rule);

describe("check-drawing-rules", () => {
  it("passes a clean shell page", () => {
    expect(checkDrawing(page("<h2>Discharged today</h2>"), "discharges-third-edition.html")).toEqual([]);
  });
  it("R0 refuses something that is not a drawing", () => {
    expect(rules("")).toContain("R0");
  });
  it("R1 flags released in text, attributes and script strings, not identifiers", () => {
    expect(rules(page("<h2>Blocked Releases</h2>"))).toContain("R1");
    expect(rules(page('<button aria-label="release the bed">x</button>'))).toContain("R1");
    expect(rules(page('<script>toast("Bed released")</script>'))).toContain("R1");
    expect(rules(page("<script>const n = bedReleases.length;</script>"))).not.toContain("R1");
  });
  it("R2 flags liveness and self-grading", () => {
    expect(rules(page("<span>Live Duty Matrix</span>"))).toContain("R2");
    expect(rules(page("<span>QA 100/100: PERFECTED</span>"))).toContain("R2");
    expect(rules(page("<p>Real-time tracking</p>"))).toContain("R2");
    expect(rules(page('<script>el.setAttribute("aria-live", "polite")</script>'))).not.toContain("R2");
  });
  it("R3 flags the negated disclosure", () => {
    expect(rules(page("<p>These figures are not invented</p>"))).toContain("R3");
  });
  it("R4 flags phone numbers, pagers and long extensions but allows ext 01", () => {
    expect(rules(page("<td>08 6457 3333</td>"))).toContain("R4");
    expect(rules(page("<td>Pager #112</td>"))).toContain("R4");
    expect(rules(page("<td>Ext. 4192</td>"))).toContain("R4");
    expect(rules(page("<td>ext 01</td>"))).not.toContain("R4");
  });
  it("R5 flags registration numbers, staff IDs, record stamps and dates of birth", () => {
    expect(rules(page("<p>AHPRA MED00038192</p>"))).toContain("R5");
    expect(rules(page("<p>Staff ID #98214</p>"))).toContain("R5");
    expect(rules(page("<p>#REPAT-881</p>"))).toContain("R5");
    expect(rules(page("<p>DOB: 14/09/1995</p>"))).toContain("R5");
    expect(rules(page("<p>WF-009</p>"))).not.toContain("R5");
  });
  it("R6 flags a clinician named by surname", () => {
    expect(rules(page("<td>Dr. P. Hughes</td>"))).toContain("R6");
  });
  it("R7 flags alert()", () => {
    expect(rules(page("<script>alert('x')</script>"))).toContain("R7");
  });
  it("R8 flags legal form codes outside the engine set", () => {
    expect(rules(page("<td>Form 6A</td>"))).toContain("R8");
    expect(rules(page("<td>Form 4C</td>"))).not.toContain("R8");
  });
  it("R9 flags semicolons, dashes and arrows in visible copy but not in CSS or entities", () => {
    expect(rules(page("<p>Held — awaiting bed</p>"))).toContain("R9");
    expect(rules(page("<p>Peel ED → Graylands</p>"))).toContain("R9");
    expect(rules(page("<p>one; two</p>"))).toContain("R9");
    expect(rules(page("<style>.a{color:red;}</style><p>A&nbsp;B</p>"))).not.toContain("R9");
  });
  it("R10 requires the shell disclosures on shell screens and exempts sign-in", () => {
    expect(rules("<html><body><main>x</main></body></html>")).toContain("R10");
    expect(rules("<html><body><main>x</main></body></html>", "sign-in-third-edition.html")).not.toContain("R10");
  });
  it("R11 keeps sign-in free of inputs and of a session claim", () => {
    const html = '<html><body><main><select id="s"></select><p>Signed in Clinician</p></main></body></html>';
    const found = rules(html, "sign-in-third-edition.html");
    expect(found.filter((r) => r === "R11").length).toBe(2);
  });
  it("R12 flags CSS text below 12px", () => {
    expect(rules(page("<style>.b{font:11px/1.2 var(--mono)}</style>"))).toContain("R12");
    expect(rules(page("<style>.b{font-size:12px}</style>"))).not.toContain("R12");
  });
  it("R13 flags an edge bar on a card", () => {
    expect(rules(page("<style>.kpiCard{border-left:3px solid var(--warn)}</style>"))).toContain("R13");
  });
});
