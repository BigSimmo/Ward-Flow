# Ward Flow drawings — keep the new look, restore the rules — Implementation Plan

> **SUPERSEDED on 17 Sept 2026 by `docs/ward-flow/STATUS.md`.** Kept for history; do not follow. The restyle was never applied to the committed drawings, and the drawings at HEAD are the design. Its Global Constraints (D4, D5, tokens, no edge bars) still hold and are restated in `docs/ward-flow/HOW-WE-WORK.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Ward Flow drawings the visual look the owner liked in the 15 September rewrite, while every drawing again obeys the owner's written rules and shows only behaviour the working engine actually has.

**Architecture:** Start from the committed drawings (`1ef9ed3975`), which already carry every rule, refusal, disclosure, derived figure and responsive tier, and restyle their presentation to the new look. Do **not** start from the 15 September files and try to re-add what they removed: they removed about 1,400 functions, the shared shell, every disclosure line and every refusal, and hand-typed their figures. The new look uses the same fonts, type scale, radii and almost identical colour tokens as the standard, so what the owner is responding to is **composition** (summary-card strips, panel and table styling, filter bars, dialogs, the header) — and composition can be moved onto the committed skeleton. A new static checker is built first so that every screen task has a catcher that can fail.

**Tech Stack:** Self-contained HTML/CSS/JS drawings in `docs/ward-flow/mockups/`; Node 24 scripts; Vitest; the Playwright-based kit in `docs/ward-flow/mockups/third-edition-kit/`.

**Spec (read the committed copies with `git show 1ef9ed3975:<path>`; several working-tree copies were edited by the same sessions under review):**

- `docs/ward-flow/README.md`
- `docs/ward-flow/mockups/README.md` (owner rulings, lines 196–215)
- `docs/ward-flow/mockups/WARD-FLOW-DESIGN-SYSTEM.md` (the standard; §2 ten rules, §3 colour, §4 type, §5 layout, §8 wording, §9 accessibility, §11 recipe, §14 screens index)
- `docs/ward-flow/SCREEN-DEFINITION-OF-DONE.md`
- The owner's navigation request Q005, `docs/ward-flow/plans/2026-09-13-navigation-update.md` (uncommitted; confirm in Decision D2)
- Reference copies of the 15 September rewrite: `C:/Users/joshs/Backups/claude-work/ward-mockups-uncommitted-20260916-001518/full-working-copy/`

## Global Constraints

Every task's requirements include this section.

- 🔴 **Local only. Never push, never open a PR, never touch `origin/main`.** "Fold into main" means the local ward line.
- Never `git add -A`, never `git stash`, never delete or move anything under `docs/ward-flow/` without the owner's explicit yes.
- Work only in `D:/Worktrees/Database/ward-restyle` (created in Task 1). Do not edit `D:/Worktrees/Database/ward-lead`: it holds about 240 uncommitted files of other work.
- Only the controller commits. Workers edit files and hand back.
- Drawings are authoritative on design; the working engine is authoritative on behaviour. A drawing may not show an action the engine cannot perform unless the control says `Not wired in this prototype.`
- Serve drawings over HTTP to look at them. A drawing opened as a file renders as a different design.
- The third bed stage is **discharged**, never **released** (owner, 30 August 2026).
- Activity line, exact: `Invented figures, reconciled with each other, as at <time>` — never beginning `Live` (owner, 10 September 2026).
- Prototype mark tooltip, exact: `Every figure and name on this screen is invented. Not a medical device and not clinical decision support.`
- Rail foot note title begins, exact: `Every ward state, movement, referral, clock and figure on this screen is invented.`
- Never the negated form (`not invented`).
- Figures are derived from the page's own data on render, never hand-typed, and reconcile with each other on the screen and across screens.
- No coloured bar along any edge of a row, candidate or card, brass included, and no highlight along the top of a panel or control (owner, 9 September 2026). Brass is allowed only beside the active rail link, under the live tab, on the current stepper stage, and beside the wordmark.
- No real-seeming personal names: an uncommon given name plus a plant, bird or stone word, family name first. Clinicians and owners are a role, never a name. No `Dr` plus a surname.
- No phone number, pager, extension over two digits, address, date of birth, staff ID, AHPRA number, or invented record number. Contact placeholders are `ext 01` upward and addresses ending `example.invalid`, stated above the table and in its foot. Identifiers use `WF-0xx`, `WF-1xx`, `WF-2xx`, `RF-0xx`, in mono.
- Legal form codes shown as selectable are the engine's set only: `1A`, `3B`, `3D`, `4A`, `4C` (`src/components/ward-management/ward-legal-forms.ts:38`), pending Decision D5.
- Nothing below 12px in HTML. Seven type steps `--t-0` 12px to `--t-6` 26px. Geist and Geist Mono only. Sentence case; uppercase only at `--t-0`/`--t-1`, tracked.
- No semicolons, dashes as punctuation, or arrows in copy. A middle dot `·` separates facts.
- Tap targets 3rem (48px) at coarse pointer or phone width. The page never scrolls sideways at any width.
- Tokens only below the copied stylesheet: no raw hex, no new token (no `--surface-3`), rail width `--railw: 236px`.
- A control that is drawn but not wired says `Not wired in this prototype.` No `alert()`. No self-graded badges (`QA 100/100`, `PERFECTED`).
- Fixed search refusal sentences are used verbatim (standard §8, lines 821 and 828–829).

## Owner decisions — Phase 0 (the controller asks these before Task 3; each has a recommendation)

**Owner answers, 16 September 2026** (given in chat through structured questions, then "Ok go"):
D1 styling onto each screen's own sections, not the new arrangement, Discharges first as a pilot the owner compares with the reference before any other screen · D2 the 13 September four-group menu (Q005) · D3 **every screen now** (supersedes the recommendation below) · D4 anything the app cannot do is marked `Not wired in this prototype.` · D5 the app's form codes only, no section numbers or time limits · D6 not sure, so the full check at 390, 820 and 1440, light and dark · D7 delete the duplicate Patient search, keep the Claude draft as reference (confirm once more immediately before the protected deletion).

**Base, corrected 16 September 2026:** the newest saved Ward Flow line is `ward/lead-fixes-20260914` (tip `0d62f779bf`, 15 September 21:39, clean worktree `D:/Worktrees/Database/ward-fixes`). It contains the 14 September snapshot of Codex's app rebuild and the owner's WLQ rulings. Task 1's base of `1ef9ed3975` is replaced by a fast-forward onto that tip. That line already carries an earlier rewrite of several drawings (snapshot `fd4de02581`), so each screen task's starting file is the drawing as it stood at `1ef9ed3975`, restored in one recorded commit, and the line's own newer standard (`WARD-FLOW-DESIGN-SYSTEM.md`) is kept.

| #   | Question                                                                                                                                                                                                                                                     | Recommendation                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Which parts of the new look do you want kept? Shown side by side on three screens (Discharges, Legal forms, Alerts).                                                                                                                                         | Keep: summary-card strip, panel and table styling, filter bar, badges, dialogs and toasts, header. Change only where a rule forces it (title case to sentence case, `Live` chips removed). |
| D2  | Which navigation? The 13 September four-group sidebar (Q005: Operations · Service Hubs · Care Coordination · Oversight, 19 destinations), the 15 September three-group list, or the standard's eleven.                                                       | Q005, the most recent one recorded as your request.                                                                                                                                        |
| D3  | Restyle only the 14 rewritten screens, or every screen so the set looks consistent?                                                                                                                                                                          | Shared header and rail on every screen now (it is one shell). Screen bodies of the 14 now, the other bodies as a second wave.                                                              |
| D4  | New behaviours the engine cannot do: renewing a legal order, NDIS and SAT blockers, per-bed "Confirm admission", custody and Form 4A verification in transport, ward directory search filter, a six-role sign-in picker, the separate 48-hour horizon pages. | Draw only what the engine does. Keep the look of the others as `Not wired in this prototype.` Queue the ones you want as engine requests.                                                  |
| D5  | The Mental Health Act forms, section numbers and time limits in the drawings.                                                                                                                                                                                | You check them. Until then the drawings show only the engine's form codes and no section numbers or time limits.                                                                           |
| D6  | The 13 September "Q004 owner-approved amendment" (desktop-only visual review) and the record saying 34 of 34 screens were looked at. Did you approve those?                                                                                                  | If unsure, use the full check: 390, 820 and 1440 wide, light and dark.                                                                                                                     |
| D7  | `patient-search-perfected-third-edition.html` is byte-identical to `patient-search-third-edition.html`. `add-a-patient-third-edition-claude-draft.html` is an older-style draft.                                                                             | Delete the duplicate, and keep the draft only as reference (both need your yes; both are protected).                                                                                       |

---

## Phase 1 — a safe place to work

### Task 1: Worktree, reference copies, claim

**Files:**

- Create: worktree `D:/Worktrees/Database/ward-restyle` on branch `ward/restyle-drawings-20260916` from `1ef9ed3975`
- Create: `docs/ward-flow/mockups/reference/gemini-2026-09-15/*.html` (20 files, copied from backup)
- Create: `docs/ward-flow/mockups/reference/gemini-2026-09-15/README.md`
- Modify: `C:/Users/joshs/.claude/worktree-ownership.md` (add claim row)

**Interfaces:**

- Produces: the worktree path, the branch name, and the reference folder every later task reads.

- [ ] **Step 1: Confirm the base commit and that the worktree path is free**

```bash
git -C D:/Worktrees/Database/ward-lead rev-parse 1ef9ed3975
ls D:/Worktrees/Database/ward-restyle 2>/dev/null && echo "EXISTS - STOP" || echo "free"
```

Expected: a full SHA beginning `1ef9ed3975`, then `free`.

- [ ] **Step 2: Create the worktree**

```bash
git -C D:/Worktrees/Database/ward-lead worktree add -b ward/restyle-drawings-20260916 D:/Worktrees/Database/ward-restyle 1ef9ed3975
cd D:/Worktrees/Database/ward-restyle && git status --short | wc -l
```

Expected: `0`.

- [ ] **Step 3: Install dependencies and check by the tells, not the exit code**

```bash
cd D:/Worktrees/Database/ward-restyle && npm ci --include=dev 2>&1 | tee ../ward-restyle-npm.log | tail -3
grep -c "npm error" ../ward-restyle-npm.log; ls node_modules/.package-lock.json
```

Expected: `0` error lines and the lock file listed.

- [ ] **Step 4: Copy the reference files from the verified backup**

```bash
SRC="C:/Users/joshs/Backups/claude-work/ward-mockups-uncommitted-20260916-001518/full-working-copy"
DST="D:/Worktrees/Database/ward-restyle/docs/ward-flow/mockups/reference/gemini-2026-09-15"
mkdir -p "$DST"
for f in CONTACT-SHEET add-a-patient-third-edition add-a-patient-third-edition-claude-draft alerts-third-edition discharges-third-edition governance-third-edition legal-forms-third-edition movement-third-edition movement-gantt-third-edition network-horizon-third-edition on-call-third-edition out-of-area-third-edition patient-now-third-edition patient-search-third-edition patient-search-perfected-third-edition settings-third-edition sign-in-third-edition transport-officer-third-edition ward-answer-third-edition wards-third-edition; do cp "$SRC/$f.html" "$DST/$f.html"; done
ls "$DST" | wc -l
```

Expected: `20`.

- [ ] **Step 5: Write the reference README**

```markdown
# Reference only — the 15 September 2026 rewrite

These twenty files are the drawings as rewritten on the evening of 15 September 2026 (Gemini
Antigravity, uncommitted in ward-lead). The owner liked their look. They break several owner
rulings and remove most of the committed drawings' behaviour, so **nothing is built from them**.
They are kept so the restyle can copy their visual composition. See
`docs/ward-flow/plans/2026-09-16-drawings-new-look-with-rules.md`.
```

- [ ] **Step 6: Add the claim row to the ownership registry**

Append to `C:/Users/joshs/.claude/worktree-ownership.md`:

```markdown
## Ward Restyle — claimed 2026-09-16

    worktree   D:/Worktrees/Database/ward-restyle
    branch     ward/restyle-drawings-20260916
    based on   codex/task-ward-flow-live-state-20260831 @ 1ef9ed3975
    owns       docs/ward-flow/mockups/** in this worktree only, scripts/ward-flow/check-drawing-rules.mjs,
               tests/ward-drawing-rules.test.ts
    plan       docs/ward-flow/plans/2026-09-16-drawings-new-look-with-rules.md
```

- [ ] **Step 7: Commit**

```bash
cd D:/Worktrees/Database/ward-restyle
git add docs/ward-flow/mockups/reference/gemini-2026-09-15
git commit -m "docs(ward-flow): keep the 15 September rewrite as a reference copy, never a build source" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 2 — build the catcher first

### Task 2: A static rules checker for drawings

**Files:**

- Create: `scripts/ward-flow/check-drawing-rules.mjs`
- Test: `tests/ward-drawing-rules.test.ts`

**Interfaces:**

- Produces: `checkDrawing(html: string, fileName: string): Finding[]` where `Finding = { rule: string, line: number, excerpt: string, message: string }`; `copyText(html: string): string`; constants `SHELL_EXEMPT`, `SELECTABLE_LEGAL_FORMS`, `ACTIVITY_LINE`, `RAIL_NOTE_TITLE`, `PROTOTYPE_TOOLTIP`, `EDGE_BAR_ALLOWED`. CLI prints one line per file and a final `checked N file(s), M finding(s)` line; exit 0 only when M is 0; exit 2 when no files are given.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd D:/Worktrees/Database/ward-restyle && npx vitest run tests/ward-drawing-rules.test.ts`
Expected: FAIL — cannot resolve `../scripts/ward-flow/check-drawing-rules.mjs`.

- [ ] **Step 3: Write the checker**

```js
#!/usr/bin/env node
// Static, read-only check of a Ward Flow drawing against the owner's written rules.
// Usage: node scripts/ward-flow/check-drawing-rules.mjs <drawing.html> [...]
// Rules and sources: docs/ward-flow/plans/2026-09-16-drawings-new-look-with-rules.md, Global Constraints.
// It reads copy from text, from title/aria-label/placeholder/alt/value attributes, and from string
// literals inside scripts, because these drawings build much of their copy with JavaScript.
// It cannot judge names, reconciliation or looks: those stay with a person.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

export const SHELL_EXEMPT = new Set([
  "sign-in-third-edition.html",
  "design-system-third-edition.html",
  "CONTACT-SHEET.html",
  "ward-flow-digest.html",
]);
export const SELECTABLE_LEGAL_FORMS = ["1A", "3B", "3D", "4A", "4C"];
export const ACTIVITY_LINE = "Invented figures, reconciled with each other, as at";
export const RAIL_NOTE_TITLE = "Every ward state, movement, referral, clock and figure on this screen is invented.";
export const PROTOTYPE_TOOLTIP =
  "Every figure and name on this screen is invented. Not a medical device and not clinical decision support.";
// Selectors allowed a bar: the three brass "you are here" places only. Filled in Task 2 Step 5.
export const EDGE_BAR_ALLOWED = [];

const spaces = (s) => s.replace(/[^\n]/g, " ");

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, spaces).replace(/\/\*[\s\S]*?\*\//g, spaces);
}

function keepStringLiterals(code) {
  let out = "";
  let i = 0;
  let q = null;
  while (i < code.length) {
    const c = code[i];
    if (q) {
      if (c === "\\" && i + 1 < code.length) {
        out += code[i + 1] === "\n" ? " \n" : "  ";
        i += 2;
        continue;
      }
      if (c === q) {
        q = null;
        out += " ";
        i++;
        continue;
      }
      if (q === "`" && c === "$" && code[i + 1] === "{") {
        let depth = 0;
        while (i < code.length) {
          const d = code[i];
          if (d === "{") depth++;
          if (d === "}" && --depth === 0) {
            out += " ";
            i++;
            break;
          }
          out += d === "\n" ? "\n" : " ";
          i++;
        }
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      out += " ";
      i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    out += c === "\n" ? "\n" : " ";
    i++;
  }
  return out;
}

function blankTagsKeepCopyAttributes(s) {
  return s.replace(/<[^>]*>/g, (tag) => {
    let out = spaces(tag);
    for (const m of tag.matchAll(/\b(?:title|aria-label|placeholder|alt|value)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const val = m[1] ?? m[2];
      const start = m.index + m[0].indexOf(val);
      out = out.slice(0, start) + val + out.slice(start + val.length);
    }
    return out;
  });
}

// Copy the reader sees: text, copy attributes and script string literals, positions preserved.
export function copyText(html) {
  let s = stripComments(html);
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, spaces);
  s = s.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (whole, body) => {
    const open = whole.slice(0, whole.indexOf(">") + 1);
    return spaces(open) + keepStringLiterals(body) + spaces("</script>");
  });
  return blankTagsKeepCopyAttributes(s);
}

// Copy written directly in the markup only (scripts and styles blanked), with entities blanked.
function markupText(html) {
  let s = stripComments(html);
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, spaces).replace(/<script\b[\s\S]*?<\/script>/gi, spaces);
  s = blankTagsKeepCopyAttributes(s);
  return s.replace(/&(?!mdash;|ndash;|rarr;|larr;)[a-zA-Z0-9#]+;/g, spaces);
}

function styleOnly(html) {
  const s = stripComments(html);
  let out = spaces(s);
  for (const m of s.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const start = m.index + m[0].indexOf(m[1]);
    out = out.slice(0, start) + m[1] + out.slice(start + m[1].length);
  }
  return out;
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function scan(text, re, rule, message) {
  return [...text.matchAll(re)].map((m) => ({
    rule,
    line: lineAt(text, m.index),
    excerpt: m[0].trim().slice(0, 80),
    message,
  }));
}

function selectorAt(css, index) {
  const open = css.lastIndexOf("{", index);
  const prevClose = css.lastIndexOf("}", open);
  return css.slice(prevClose + 1, open).trim();
}

export function checkDrawing(html, fileName) {
  if (!/<(?:body|main|nav)\b/i.test(html)) {
    return [{ rule: "R0", line: 1, excerpt: fileName, message: "Not a drawing: no body, main or nav element" }];
  }
  const copy = copyText(html);
  const markup = markupText(html);
  const css = styleOnly(html);
  const code = stripComments(html);
  const f = [];

  f.push(
    ...scan(
      copy,
      /(?<![A-Za-z])[Rr]eleas(?:e|ed|es|ing)\b/g,
      "R1",
      'The third bed stage is "discharged", never "released" (owner, 30 August 2026)',
    ),
  );
  f.push(
    ...scan(
      copy,
      /QA 100\/100|PERFECTED|\breal[- ]time\b|(?<![-\w])live\b/gi,
      "R2",
      "No liveness or self-graded claims on invented figures (owner, 9 to 10 September 2026)",
    ),
  );
  f.push(...scan(copy, /\bnot invented\b/gi, "R3", "Never the negated form of the disclosure"));
  f.push(
    ...scan(
      copy,
      /(?:\(0[2-9]\)|\b0[2-9])\s?\d{4}\s?\d{4}\b|\b(?:direct|tel|phone|ph)\.?:?\s*\d{4}\s?\d{4}\b|\bpager\s*#?\s*\d+|\bext\.?\s*\d{3,}\b|\bspeed dial\b/gi,
      "R4",
      "No phone, pager or extension numbers. Use ext 01 placeholders",
    ),
  );
  f.push(
    ...scan(
      copy,
      /\bAHPRA\s+[A-Z]{3}\d+|\b[A-Z]{3}\d{8,}\b|\bstaff id\s*#?\s*\d+|#[A-Z]{2,}-\d+|\bDOB\b/gi,
      "R5",
      "No registration numbers, staff IDs, invented record numbers or dates of birth",
    ),
  );
  f.push(...scan(copy, /\bDr\.?\s+[A-Z]/g, "R6", "Clinicians are a role, never a name"));
  f.push(...scan(code, /\balert\s*\(/g, "R7", "No alert(). An unwired control says: Not wired in this prototype."));
  for (const m of copy.matchAll(/\bForm\s+(\d{1,2}[A-Z])\b/g)) {
    if (!SELECTABLE_LEGAL_FORMS.includes(m[1])) {
      f.push({
        rule: "R8",
        line: lineAt(copy, m.index),
        excerpt: m[0],
        message: `Form ${m[1]} is not in the engine's form set (${SELECTABLE_LEGAL_FORMS.join(", ")})`,
      });
    }
  }
  f.push(
    ...scan(
      markup,
      /[;—–→←]|&mdash;|&ndash;|&rarr;|&larr;/g,
      "R9",
      "No semicolons, dashes or arrows in copy. A middle dot separates facts",
    ),
  );

  const name = basename(fileName);
  if (!SHELL_EXEMPT.has(name)) {
    const required = [
      [ACTIVITY_LINE, "the Activity line"],
      [RAIL_NOTE_TITLE, "the rail foot disclosure"],
      [PROTOTYPE_TOOLTIP, "the prototype mark tooltip"],
      ['id="railCheck"', "the reconciliation line"],
      ['id="rail"', "the shared rail"],
    ];
    for (const [needle, what] of required) {
      if (!html.includes(needle))
        f.push({ rule: "R10", line: 1, excerpt: needle.slice(0, 80), message: `Missing ${what}` });
    }
  }
  if (name === "sign-in-third-edition.html") {
    f.push(...scan(code, /<(?:input|select|textarea)\b/gi, "R11", "Sign in contains no input element of any kind"));
    f.push(...scan(copy, /\bsigned in\b/gi, "R11", "Nothing on Sign in may claim a session exists"));
  }
  for (const m of css.matchAll(/font(?:-size)?\s*:[^;{}]*?(\d+(?:\.\d+)?)px/g)) {
    if (Number(m[1]) < 12)
      f.push({ rule: "R12", line: lineAt(css, m.index), excerpt: m[0].slice(0, 80), message: "Nothing below 12px" });
  }
  for (const m of css.matchAll(
    /border-(?:left|top|right|bottom)(?:-width)?\s*:\s*(?:[2-9]|\d{2,})px|box-shadow\s*:\s*inset\s+-?[2-9]px/g,
  )) {
    const selector = selectorAt(css, m.index);
    if (!EDGE_BAR_ALLOWED.includes(selector)) {
      f.push({
        rule: "R13",
        line: lineAt(css, m.index),
        excerpt: `${selector} { ${m[0]} }`.slice(0, 80),
        message: "No coloured bar along an edge, no top highlight (owner, 9 September 2026)",
      });
    }
  }
  return f;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/ward-flow/check-drawing-rules.mjs <drawing.html> [...]");
    process.exit(2);
  }
  let total = 0;
  for (const file of files) {
    const findings = checkDrawing(readFileSync(file, "utf8"), file);
    total += findings.length;
    console.log(`${basename(file)}: ${findings.length === 0 ? "clean" : `${findings.length} finding(s)`}`);
    for (const x of findings) console.log(`  ${x.rule} line ${x.line}: ${x.excerpt}  (${x.message})`);
  }
  console.log(`checked ${files.length} file(s), ${total} finding(s)`);
  process.exit(total === 0 ? 0 : 1);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/ward-drawing-rules.test.ts`
Expected: the summary line reports `Tests  15 passed (15)` and `Test Files  1 passed (1)`. Read the counts, not the exit code.

- [ ] **Step 5: Calibrate against the committed Command drawing, which the owner has accepted**

Run: `node scripts/ward-flow/check-drawing-rules.mjs docs/ward-flow/mockups/command-third-edition.html`

For each finding, decide with the Spec open:

- An R13 finding whose selector is the active rail link, the live tab underline, the current stepper stage or the wordmark mark: add that exact selector string to `EDGE_BAR_ALLOWED` with a one-line comment naming which of the four places it is.
- **Any other finding on Command: stop and hand back to the controller.** Do not widen a pattern and do not allowlist anything else. A finding on an accepted drawing is either a checker defect or a real defect in Command, and that is the owner's call.

Re-run until `command-third-edition.html: clean` or the task has been handed back.

- [ ] **Step 6: Prove the checker can fail on the real problem**

Run: `node scripts/ward-flow/check-drawing-rules.mjs docs/ward-flow/mockups/reference/gemini-2026-09-15/discharges-third-edition.html docs/ward-flow/mockups/reference/gemini-2026-09-15/on-call-third-edition.html`
Expected: exit 1, `checked 2 file(s)`, and at least R1 and R10 on Discharges and R4 on On-call. If either file reports clean, the checker is broken: stop and hand back.

- [ ] **Step 7: Commit**

```bash
git add scripts/ward-flow/check-drawing-rules.mjs tests/ward-drawing-rules.test.ts
git commit -m "feat(ward-flow): a static checker that fails a drawing which breaks the owner's written rules" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 3 — write down the look

### Task 3: The new-look specification (needs D1, D2, D3)

**Files:**

- Create: `docs/ward-flow/mockups/NEW-LOOK-SPEC.md`

**Interfaces:**

- Consumes: the reference folder from Task 1.
- Produces: named component recipes (CSS copied from the reference, rewritten onto standard tokens) that every screen task applies: `summary strip`, `summary card`, `panel`, `panel head`, `table wrap`, `filter bar`, `badge`, `button`, `dialog`, `toast`, `header`, `rail` (Q005 groups if D2 is accepted).

- [ ] **Step 1: Extract each component's CSS from the reference**

```bash
R=docs/ward-flow/mockups/reference/gemini-2026-09-15
for cls in kpiStrip kpiCard kpiLabel kpiVal kpiSub panel ph tableWrap filterBar filterBtn badge btn primary modal modalDialog modalHead modalBody modalFoot toast hdrTitle hdrEnd rail railGroup railLink railEyebrow railFoot; do
  echo "== .$cls"; grep -n "\.$cls\b[^{]*{" "$R/discharges-third-edition.html" | head -3
done
```

Expected: line numbers for each class. Copy each rule block into the spec under its component name.

- [ ] **Step 2: Rewrite each recipe onto the standard**

For every copied block, in the spec:

- Replace any raw colour with the standard token of the same role (`--surface`, `--line`, `--ink-soft`, `--accent`, `--good`, `--warn`, `--danger` and their `-soft` forms).
- Delete any `border-left`, `border-top` or inset shadow used as a bar.
- Replace `--surface-3` with `--surface-2`; set rail width to `var(--railw)` at 236px.
- Headings in sentence case. Uppercase only for `--t-0`/`--t-1` labels, tracked 0.08em.
- Dialogs: state that they must follow standard rule 53 (focus to first control, outside inert, Tab wraps, Escape and Close return focus).
- Toasts: state that a toast confirming an unwired action ends with `Not wired in this prototype.`
- Summary card values: state that each is computed from the page's data array, never typed.

- [ ] **Step 3: List every place the look must change to obey a rule**

Add a section `Where the look changes, and why` with one line each: title case to sentence case; `Live` chips removed; hand-typed counts now computed; three-group rail replaced by the D2 navigation; the in-page QA badge removed; toasts carry `Not wired in this prototype.`

- [ ] **Step 4: Owner sign-off**

The controller shows the owner the spec summary beside one reference screen and records the owner's answer, with date and his words, at the top of the spec. **No screen task starts before this line exists.**

- [ ] **Step 5: Commit**

```bash
git add docs/ward-flow/mockups/NEW-LOOK-SPEC.md
git commit -m "docs(ward-flow): the new look written down as recipes on the standard's own tokens" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 4 — the shared shell

### Task 4: Restyle the shell on Command

**Files:**

- Modify: `docs/ward-flow/mockups/command-third-edition.html` (stylesheet, rail, header only; not the Command body)

**Interfaces:**

- Consumes: `NEW-LOOK-SPEC.md` header and rail recipes; the D2 navigation.
- Produces: the reference shell every other screen copies verbatim.

- [ ] **Step 1: Record the before-state**

```bash
F=docs/ward-flow/mockups/command-third-edition.html
grep -c "function " $F; grep -o "<h2[^>]*>[^<]*" $F | sed 's/<h2[^>]*>//'
```

Save both outputs into `docs/ward-flow/plans/drawings-new-look/command-before.txt`.

- [ ] **Step 2: Apply the header and rail recipes**

Keep, unchanged in behaviour: the JavaScript-built rail and its open/closed states, `data-rail`, the skip link, the Service selector, Activity, Tasks and Tools drawers, the live region, `#railCheck`, the rail note and the prototype mark. Change only their CSS and the rail's `SCREENS`/`GROUPS`/`SCREEN_ORDER` data to the D2 groups.

- [ ] **Step 3: Run the four catchers**

```bash
node scripts/ward-flow/check-drawing-rules.mjs docs/ward-flow/mockups/command-third-edition.html
node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/command-third-edition.html platinum
node docs/ward-flow/mockups/third-edition-kit/check-shell.mjs docs/ward-flow/mockups/command-third-edition.html platinum
grep -c "function " docs/ward-flow/mockups/command-third-edition.html
```

Expected: `checked 1 file(s), 0 finding(s)`; the check.mjs output contains `ALL GREEN`; check-shell exits 0; the function count is not lower than in Step 1. Quote the decisive line of each in the report.

- [ ] **Step 4: Look at it**

Serve the folder and look at 390, 820 and 1440 wide, light and dark, with each drawer open. Record what was seen in `docs/ward-flow/plans/drawings-new-look/command.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/ward-flow/mockups/command-third-edition.html docs/ward-flow/plans/drawings-new-look/command-before.txt docs/ward-flow/plans/drawings-new-look/command.md
git commit -m "feat(ward-flow): the shared header and rail in the new look, with every shell behaviour kept" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

### Task 5: Copy the shell to every shell screen

**Files:**

- Modify: every `docs/ward-flow/mockups/*-third-edition.html` except `sign-in`, `design-system` and the reference folder
- Modify: `docs/ward-flow/mockups/third-edition-kit/shell-sweep.mjs` (page list only)

- [ ] **Step 1: Widen shell-sweep's page list to every shell screen**

Open `shell-sweep.mjs`, find its list of sixteen pages, and replace it with the output of:

```bash
ls docs/ward-flow/mockups/*-third-edition.html | xargs -n1 basename | grep -v -e sign-in -e design-system
```

- [ ] **Step 2: Copy Command's stylesheet shell block, rail, header and shell script into each page verbatim**

- [ ] **Step 3: Run the sweep and the checker on every page**

```bash
node docs/ward-flow/mockups/third-edition-kit/shell-sweep.mjs
node scripts/ward-flow/check-drawing-rules.mjs $(ls docs/ward-flow/mockups/*-third-edition.html)
```

Expected: shell-sweep exits 0; the checker's last line reports the same number of files as `ls` counted. Remaining findings belong to screen bodies and are expected here; list them in the report as the input to Phase 5.

- [ ] **Step 4: Commit**

```bash
git add docs/ward-flow/mockups/*-third-edition.html docs/ward-flow/mockups/third-edition-kit/shell-sweep.mjs
git commit -m "feat(ward-flow): one shell, copied to every screen, swept identical" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 5 — screen bodies

### Screen recipe (every Phase 5 task runs all of these steps for its screen `S`)

- [ ] **R-1: Record the before-state**

```bash
F=docs/ward-flow/mockups/S
B=docs/ward-flow/plans/drawings-new-look/S-before.txt
mkdir -p docs/ward-flow/plans/drawings-new-look
grep -c "function " $F > $B; grep -o "<h2[^>]*>[^<]*" $F | sed 's/<h2[^>]*>//' >> $B
```

- [ ] **R-2: Open the committed file, its reference twin `reference/gemini-2026-09-15/S`, and `NEW-LOOK-SPEC.md` side by side.**

- [ ] **R-3: Restyle the committed body with the spec's recipes.** Every panel, section, data array, function, refusal, empty state, `aria-live` region and `@media` rule stays. Panels keep their order and type (a table stays a table). Where the reference shows a summary strip, build it from the page's existing data functions.

- [ ] **R-4: Apply this screen's fix list** (in its task below). Where the reference added a feature, include it only if its task says so.

- [ ] **R-5: Run the catchers**

```bash
node scripts/ward-flow/check-drawing-rules.mjs docs/ward-flow/mockups/S
node docs/ward-flow/mockups/third-edition-kit/check.mjs docs/ward-flow/mockups/S platinum
node docs/ward-flow/mockups/third-edition-kit/shell-sweep.mjs --files=S
grep -c "function " docs/ward-flow/mockups/S
grep -o "<h2[^>]*>[^<]*" docs/ward-flow/mockups/S | sed 's/<h2[^>]*>//'
```

Expected: `checked 1 file(s), 0 finding(s)`; check.mjs output contains `ALL GREEN`; shell-sweep exits 0; function count not lower than R-1; the h2 list matches R-1 except for wording changes listed in the report.

- [ ] **R-6: Report** in `docs/ward-flow/plans/drawings-new-look/S.md`: every deviation from the reference look with its rule; every deviation from the committed layout with its reason; the decisive line of each catcher; what was not checked.

- [ ] **R-7: Controller commits**

```bash
git add docs/ward-flow/mockups/S docs/ward-flow/plans/drawings-new-look/S.md docs/ward-flow/plans/drawings-new-look/S-before.txt
git commit -m "feat(ward-flow): S in the new look, obeying the owner's rules" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Worker tier: Sonnet at high effort (catchers named in R-5). Each batch of three screens gets one Opus adversarial review of the frozen diffs before the owner looks.

### Wave A — privacy, legal and safety first

**Task 6: `on-call-third-edition.html`**

- Every phone, extension, pager and speed-dial number replaced with `ext 01` upward; state `Contact details are placeholders` above each table and in its foot.
- Every person named becomes a role. Remove `Live Duty Matrix`, `Live 24/7`, `AHPRA Verified`.
- The Tier 3 escalation button's toast ends `Not wired in this prototype.` and no longer claims a governance ledger row is written.
- Reconcile WF-009's department with Alerts (the reference puts it at Peel ED here and SCGH ED there). Use the department the committed data gives.

**Task 7: `legal-forms-third-edition.html`** (needs D4, D5)

- Form codes are the engine's: `1A`, `3B`, `3D`, `4A`, `4C`. No section numbers or time limits in copy until D5.
- Keep the committed `If nobody renews it` panel and the Explainable shortlist.
- Summary cards, the rail count, the catalogue badge and the filter label all computed from one array (the reference shows 47, 27 and 6 for the same population).
- No renew or re-authorise action: the engine writes a form's due time once, at intake (`ward-flow-reducer.ts`, `RAISE_REFERRAL`). Draw the control as `Not wired in this prototype.` or remove it, per D4.
- Remove `Cryptographically issued`, `satisfies all legislative obligations`, `Verified against Chief Psychiatrist Registry standards`, the AHPRA number and every clinician name.

**Task 8: `sign-in-third-edition.html`** (needs D4)

- No `<select>`, no input of any kind. No `Signed in` text. No staff ID. No `Real-time`.
- Keep the committed `What this role can do`, `What this role cannot do` and `Refused to every role` sections.
- A role picker is drawn only if D4 accepts it, as buttons, using the engine's roles (`coordinator`, `ed`, `ward`, `officer`, `community`), not the reference's six invented roles.

**Task 9: `transport-officer-third-edition.html`** (needs D4)

- Keep the four-stage stepper: Accepted, En route, Collected, Arrived (the engine has these).
- Remove the `Statutory guard` claim and Form 4A verification: the engine's collect step never reads the legal form. Draw as `Not wired in this prototype.` only if D4 keeps it.
- Keep the committed `Refused actions` panel. Transfer count computed from the run cards (the reference says 3 and shows 2).

**Task 10: `discharges-third-edition.html`** (needs D4)

- Every `release` word becomes `discharge`: Blocked discharges, Confirmed discharges, Expected discharges.
- Keep the committed `Outside the four groups` bucket and the Explainable shortlist.
- Blocker reasons are the engine's list only (`ward-change-reasons.ts:75`): no NDIS or SAT category.
- Clearing a blocker does not move a discharge to Confirmed. The engine only clears the flag.
- Counts computed from rows (the reference says 5 and shows 3, says 4 and shows 2). No `alert()`.

### Wave B — the operational screens

**Task 11: `ward-answer-third-edition.html`** — no per-bed "Confirm admission" toggle: the engine pulls a bed only onto an accepted movement and counts beds, not labelled cells (`PULL_PATIENT`, `ward-bed-availability.ts:172`). No patient name, date of birth, or `NUM` staff name. The clinical note about aggression is not a verdict about a person: remove it from any verdict slot. Keep `Recent answers` and the gates line.

**Task 12: `alerts-third-edition.html`** — `Automatic release` becomes discharge wording. Rename patients to the naming formula. Remove `Engine Status: Synchronized`. The broadcast toast ends `Not wired in this prototype.` Keep `Needs you`, `For other roles`, `Nobody selected`, and `Nothing here decides anything`.

**Task 13: `governance-third-edition.html`** — remove the AHPRA number and every clinician and patient name. Remove `Audit Compliance: 100% Logged`. Keep the Access record table.

**Task 14: `out-of-area-third-edition.html`** — rename patients, drop age and sex, drop `#REPAT-881`, drop `Dr. Peter Hall`. Keep `The five groups`, `Catchment data`, and `What this screen does not say`.

**Task 15: `add-a-patient-third-edition.html`** — the duplicate check stays the committed one, which checks the whole board; the reference's two hard-coded names are not used. Remove the Patient Master Index stamp and `Cryptographic`. Keep `Already on the board`.

**Task 16: `patient-now-third-edition.html`** — the heading is computed from the selected person, never a hard-coded name. Remove `User: Sarah Jenkins (Bed Desk)`: the rail foot shows a role only. The reference's journey stepper marks the current step with a filled brass dot, which is banned: use the standard stepper, where brass is a bar. Remove `--surface-3`, `--danger-border` and the raw hover hex. Keep the committed journey and verdict panels.

**Task 17: `wards-third-edition.html`** (needs D4) — the engine's wards screen has no search box or profile pop-up. Keep `About this list`, the Explainable shortlist and the `Not placed in a health service` bucket. The ward count is read from the data, never typed: the reference says 23 in three places and its table has 12 rows. The table carries all 23 real wards from the committed data. `Ext. 4102` and `Vocera #NUM-01` become placeholders. No `&rarr;` arrows on buttons.

**Task 18: `settings-third-edition.html`** — `Auto-release` and `releases reservation` become discharge wording. Keep the committed Appearance, The rail, Default service, and handover print sections. Remove `Production Clinical Security Profile` and the invented `Rail Density Preference` control.

**Task 19: `patient-search-third-edition.html`** — keep the committed `What this search refuses` panel with the fixed refusal sentences verbatim, and the Access record. Fix the unrendered `${p.name}` heading. Results stay a table. Do not carry over anything from the reference's patient data: it invents `UM-4012xx` record numbers and ordinary real-sounding names. One of them uses a real WA place name that is also a Noongar family name, on a record flagged Aboriginal, so none of that data is reused. The prototype mark uses the exact tooltip sentence, at 12px or larger. Load Geist Mono 400 to 600 only.

**Task 20: `movement-third-edition.html`** — the rewrite barely changed this screen, but it replaced "Today's traffic" with a 48-hour bed horizon block. Keep the committed `Today's traffic`. Draw the horizon only if D4 accepts it, and then: its sentence (`24 active transfers, 11 Form 5A trial leaves, 19 planned discharges`) is computed from its own data (which holds 4, 2 and 7); no `➔` arrow; nothing below 12px; no shadow or lift on bars; no raw `#fff`; form codes from the engine set (there is no 5A).

### Wave C — extras (need D4 and D7)

**Task 21:** `movement-gantt-third-edition.html` and `network-horizon-third-edition.html` — keep or drop per D4. Together with the block in Movement, the rewrite built the same "48-hour horizon" three separate times, with three datasets that disagree. If D4 keeps a horizon, it is built **once**, as a component in the standard, and re-cut into the screens that show it (standard §11). Neither reference page is a build source: Network horizon has no responsive rules at all, text at 10 to 11.5px throughout, no disclosure, a dead `#` rail, and the claim `Authorisation gates remain non-bypassable`. Movement gantt adds two new tokens, gradients, raw hex, a top highlight, hover brightening and `RN C. Jenkins`.

**Task 22:** `patient-search-perfected-third-edition.html` (identical duplicate) and `add-a-patient-third-edition-claude-draft.html` — per D7, with the owner's explicit yes for any deletion, using `CLAUDE_ALLOW_PROTECTED_DELETE=1` only after that yes.

---

## Phase 6 — finish

### Task 23: Regenerate records, owner look, fold locally

**Files:**

- Modify: `docs/ward-flow/mockups/MANIFEST.json`, `docs/ward-flow/mockups/CONTACT-SHEET.html`, `docs/ward-flow/screen-verification.json`, `docs/ward-flow/SCREEN-VERIFICATION.md`

- [ ] **Step 1: Regenerate the contact sheet and manifest**

```bash
node scripts/ward-flow/contact-sheet.mjs
node scripts/ward-flow/mockup-manifest.mjs
node scripts/ward-flow/mockup-manifest.mjs --check
```

Expected: the final `--check` exits 0.

- [ ] **Step 2: Whole-set checker run**

```bash
node scripts/ward-flow/check-drawing-rules.mjs $(ls docs/ward-flow/mockups/*-third-edition.html)
ls docs/ward-flow/mockups/*-third-edition.html | wc -l
```

Expected: `checked N file(s), 0 finding(s)` with N equal to the `wc -l` count.

- [ ] **Step 3: The owner looks**

The owner looks at every changed screen at 390, 820 and 1440 wide, light and dark (or at the coverage D6 sets). Record each look in `screen-verification.json` with date, widths, themes, verdict and the drawing's manifest hash. Regenerate: `node scripts/ward-flow/screen-verification.mjs`.

- [ ] **Step 4: Commit**

```bash
git add docs/ward-flow/mockups/MANIFEST.json docs/ward-flow/mockups/CONTACT-SHEET.html docs/ward-flow/screen-verification.json docs/ward-flow/SCREEN-VERIFICATION.md
git commit -m "docs(ward-flow): the restyled drawings recorded as looked at, with their hashes" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Before any fold into the local ward line, ask the owner**

`D:/Worktrees/Database/ward-lead` still has the 15 September edits uncommitted on the same drawing files, and about 240 other uncommitted files from the 13 September app rebuild. A fold will collide with the drawing edits. Restoring those drawings to the committed version discards them from that folder. They are backed up at `C:/Users/joshs/Backups/claude-work/ward-lead-uncommitted-20260916-004246/`, but this still needs the owner's explicit yes. Run `bash ~/.claude/scripts/backup-work.sh` first. Never push.

---

## Not in this plan

- The real application's React screens. The 13 September Codex work rebuilt them against the committed drawings and is uncommitted in `ward-lead`. Once these drawings are accepted, those screens need a matching pass, planned separately.
- Committing that Codex work. It is a separate owner decision and the largest current risk of loss.
- Any engine behaviour change requested under D4.
