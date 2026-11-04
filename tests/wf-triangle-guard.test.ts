import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Triangle guard (plan 2k, 3 Nov 2026, after the icon audit in PR #1357). The warning triangle means
 * one true act-now, overdue or safety state on the row that needs a person now. It never sits inside a
 * chip, tab, segmented control or filter pill, never marks a routine count, and a wait shows its
 * wait-band colour instead of a mark. Status marks come from `StatusGlyph`
 * (src/components/wf/status-glyph.tsx), where `danger` is the triangle.
 *
 * The kit enforces this itself: `Tabs`, `PillTabs`, `Segmented`, `HeroTrack`, `FilterChip` and
 * `HeroChip` pass their tone through `controlTone`, so a `danger` tone draws the neutral ring
 * (tests/wf-triangle-guard.dom.test.tsx). This scan covers page code, three ways:
 * - `control`: a `danger` tone handed to one of those kit controls (inline, or through an `items`
 *   constant in the same file). The kit no longer draws it, but the page still asks for it;
 * - `raw`: a triangle (`<StatusGlyph tone="danger">`, a `danger` branch of a `StatusGlyph` tone,
 *   Lucide `TriangleAlert` or `AlertTriangle`, a typed ▲ or ⚠) inside an element whose class names a
 *   chip, pill, tab, segment, filter or tag, or a triangle `Icon` in a `tabs`, `chips`, `pills` or
 *   `filters` list;
 * - `wait`: a glyph tone read from `waitTone(...)`, which marks every long wait with a triangle.
 *
 * KNOWN lists today's page offenders by file, kind and site snippet, each with a one-line reason. Each owning page's
 * thread removes its own; the list may only shrink, so delete the entry in the same change. Mock-up
 * copies under ward-redesign are left out, as in tests/wf-no-side-stripes.test.ts.
 */
type Kind = "control" | "raw" | "wait";
/** `sites`: one snippet per offender, found in its line (or, for `control`, in the opening tag). */
type Known = { file: string; kind: Kind; sites: readonly string[]; reason: string };

const KNOWN: readonly Known[] = [
  {
    file: "src/components/ward-management/alerts/alert-detail.tsx",
    kind: "raw",
    sites: ['group === "act" ? "danger"'],
    reason: "phone alert detail head: an 'Act now' chip carries the triangle",
  },
  {
    file: "src/components/ward-management/coordinator/coordinator-screen.tsx",
    kind: "control",
    sites: ['label="Home list"', 'label="Flow stages"'],
    reason: "Home: Needs you segment and the Flow stage pill tabs ask for danger on a count",
  },
  {
    file: "src/components/ward-management/delays/delays-board-panels.tsx",
    kind: "wait",
    sites: ["<Glyph tone={waitTone(row.waited)} />"],
    reason: "Waiting panel clock marks a wait over 24 hours with the triangle",
  },
  {
    file: "src/components/ward-management/delays/delays-board-panels.tsx",
    kind: "raw",
    sites: ["Icon: TriangleAlert"],
    reason: "Waiting register: the Attention tab carries a TriangleAlert icon on its count",
  },
  {
    file: "src/components/ward-management/delays/delays-board.tsx",
    kind: "wait",
    sites: ["<Glyph tone={waitTone(row.waited)} />", "tone: waitTone(row.waited),"],
    reason: "Waiting rows (table and portrait) mark every wait over 24 hours with the triangle",
  },
  {
    file: "src/components/ward-management/discharges/discharge-board.tsx",
    kind: "raw",
    sites: ['<StatusGlyph tone="danger" size={9} />'],
    reason: "Discharges: every held-up row's blocker tag carries the triangle",
  },
  {
    file: "src/components/ward-management/discharges/discharge-detail-panes.tsx",
    kind: "control",
    sites: ['id === "barriers"'],
    reason: "Discharge detail: the Barriers pill tab asks for danger while a blocker is recorded",
  },
  {
    file: "src/components/ward-management/referrals/referral-board-hero.tsx",
    kind: "raw",
    sites: ['key === "overdue"'],
    reason: "referrals hero: the Overdue highlight pill draws a TriangleAlert on a count",
  },
  {
    file: "src/components/ward-management/restrictive-practice/seclusion-forms-view.tsx",
    kind: "raw",
    sites: ['<StatusGlyph tone="danger" size={8} />'],
    reason:
      "Seclusion register: the live episode's practice tag carries the triangle (came with main's seclusion view, cda9f1995)",
  },
];

const CONTROLS = ["FilterChip", "HeroChip", "PillTabs", "Tabs", "Segmented", "HeroTrack"] as const;
const TRIANGLE =
  /<StatusGlyph\b[^>]*?\btone=(?:"danger"|'danger'|\{[^}]*["']danger["'])|<TriangleAlert\b|<AlertTriangle\b|icon=\{(?:TriangleAlert|AlertTriangle)\}|"▲"(?!\s*:\s*"▼")|⚠ /u;
// A class that names a chip-like control. `tabularNum` and `tableFoot` are not tabs.
const CHIP_CLASS =
  /className=\{?[^}\n]*(?:[Cc]hip|[Pp]ill(?![a-z])|[Ss]eg(?![a-z])|[Ss]egment|[Tt]abs?(?![a-z])|[Ff]ilter|[Tt]ag(?![a-z]))/u;
const WAIT_TONE = /tone[=:]\s*\{?waitTone\(/u;
const LIST_ICON = /\b[Ii]con\s*:\s*(?:TriangleAlert|AlertTriangle)\b/u;
const CONTROL_LIST = /\b\w*(?:[Tt]abs|[Cc]hips|[Pp]ills|[Ff]ilters)\s*(?::[^=]*)?=\s*\[/u;

function tsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith(".tsx") ? [full] : [];
  });
}

/** Comments blanked (newlines kept), so an apostrophe or a quoted rule in a comment never counts. */
function stripComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/gu, " ");
  return source.replace(/\/\*[\s\S]*?\*\//gu, blank).replace(/(^|[^:"'`\\])\/\/[^\n]*/gu, (m, lead: string) => {
    return lead + blank(m.slice(lead.length));
  });
}

/** From `start` (a `<`) to the `>` that closes the opening tag, skipping braces and strings. */
function tagExtent(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === quote && source[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/** The initialiser after `=` up to the `;` that ends it. */
function initialiser(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === quote && source[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if ("([{".includes(c)) depth += 1;
    else if (")]}".includes(c)) depth -= 1;
    else if (c === ";" && depth <= 0) return source.slice(start, i);
  }
  return source.slice(start);
}

type Finding = { file: string; kind: Kind; line: number; site: string };

export function triangleFindings(file: string, raw: string): Finding[] {
  const source = stripComments(raw);
  const found: Finding[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;
  for (const match of source.matchAll(new RegExp(String.raw`<(${CONTROLS.join("|")})\b`, "gu"))) {
    const tag = tagExtent(source, match.index);
    let danger = /["']danger["']/u.test(tag);
    const named = /items=\{(\w+)\}/u.exec(tag);
    if (!danger && named) {
      const declared = new RegExp(String.raw`(?:const|let)\s+${named[1]}\b[^=]*=`, "u").exec(source);
      danger = declared ? /["']danger["']/u.test(initialiser(source, declared.index + declared[0].length)) : false;
    }
    if (danger) found.push({ file, kind: "control", line: lineOf(match.index), site: tag });
  }
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (WAIT_TONE.test(line)) found.push({ file, kind: "wait", line: index + 1, site: line });
    if (LIST_ICON.test(line) && CONTROL_LIST.test(lines.slice(Math.max(0, index - 12), index).join("\n")))
      found.push({ file, kind: "raw", line: index + 1, site: line });
    if (!TRIANGLE.test(line)) return;
    const context = lines.slice(Math.max(0, index - 4), index + 1).join("\n");
    if (CHIP_CLASS.test(context)) found.push({ file, kind: "raw", line: index + 1, site: line });
  });
  return found;
}

/** Matches each finding to one unused KNOWN site. Returns the findings no site covers and the sites no finding uses. */
function matchKnown(findings: Finding[]): { unlisted: string[]; stale: string[] } {
  const open = KNOWN.flatMap((k) => k.sites.map((site) => ({ ...k, site, used: false })));
  const unlisted: string[] = [];
  for (const f of findings) {
    const hit = open.find((k) => !k.used && k.file === f.file && k.kind === f.kind && f.site.includes(k.site));
    if (hit) hit.used = true;
    else unlisted.push(`${f.file}:${f.line} ${f.kind}`);
  }
  return { unlisted, stale: open.filter((k) => !k.used).map((k) => `${k.file} ${k.kind} ${k.site}`) };
}

describe("triangle guard (plan 2k, 3 Nov 2026)", () => {
  it("page code puts no new triangle in a chip, tab, segment or pill, and marks no wait with one", () => {
    const root = process.cwd();
    const findings = tsxFiles(path.join(root, "src"))
      .map((full) => path.relative(root, full).split(path.sep).join("/"))
      .filter((file) => !file.startsWith("src/components/wf/") && !/\/(?:ward-redesign|mockups)\//u.test(file))
      .flatMap((file) => triangleFindings(file, readFileSync(path.join(root, file), "utf8")));
    const { unlisted, stale } = matchKnown(findings);
    expect(unlisted, "new triangles at sites KNOWN does not list").toEqual([]);
    expect(stale, "KNOWN sites that are fixed: delete them so the list shrinks").toEqual([]);
  });

  it("every known offender carries a reason", () => {
    for (const known of KNOWN) expect(known.reason.length, known.file).toBeGreaterThan(10);
  });

  it("catches each kind and leaves row marks, carets and lookalike classes alone", () => {
    const scan = (source: string) => triangleFindings("f.tsx", source).map((f) => f.kind);
    expect(scan(`<PillTabs items={[{ id: "a", label: "A", tone: late ? "danger" : undefined }]} />`)).toEqual([
      "control",
    ]);
    expect(scan(`const ITEMS = [{ id: "a", label: "A", tone: "danger" }];\n<Segmented items={ITEMS} />`)).toEqual([
      "control",
    ]);
    expect(scan(`<FilterChip tone="danger" pressed onPressedChange={f}>Late</FilterChip>`)).toEqual(["control"]);
    expect(
      scan(`<button className={styles.pill}>\n  <TriangleAlert size={12} aria-hidden="true" />\n</button>`),
    ).toEqual(["raw"]);
    expect(scan(`<span className={s.blockerTag}>\n  <StatusGlyph tone="danger" size={9} />\n</span>`)).toEqual(["raw"]);
    expect(scan(`<span className={s.chip}>\n  <StatusGlyph size={9} tone="danger" />\n</span>`)).toEqual(["raw"]);
    expect(scan(`<span className={s.chip}>\n  <StatusGlyph tone={'danger'} size={9} />\n</span>`)).toEqual(["raw"]);
    expect(scan(`<span className={s.chip}>\n  <StatusGlyph size={9} tone="warning" />\n</span>`)).toEqual([]);
    expect(scan(`<Glyph tone={waitTone(row.waited)} />`)).toEqual(["wait"]);
    expect(scan(`const tabs = [\n  {\n    id: "a",\n    Icon: TriangleAlert,\n  },\n];`)).toEqual(["raw"]);
    expect(scan(`const rows = [\n  {\n    id: "a",\n    Icon: TriangleAlert,\n  },\n];`)).toEqual([]);

    expect(scan(`<div className={s.row}>\n  <StatusGlyph tone="danger" size={9} />\n</div>`)).toEqual([]);
    expect(scan(`<dd className={s.tabularNum}>\n  <StatusGlyph tone="danger" size={9} />\n</dd>`)).toEqual([]);
    expect(scan(`<span className={s.caret}>{open ? "▲" : "▼"}</span>`)).toEqual([]);
    expect(scan(`<PillTabs items={[{ id: "a", label: "A", tone: "warning" }]} />`)).toEqual([]);
    expect(scan(`{/* the chip's danger tone */}\n<Segmented items={[{ id: "a", label: "A" }]} />`)).toEqual([]);
  });
});
