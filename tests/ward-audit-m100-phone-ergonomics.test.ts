// M100 (master audit list, 10 Nov 2026): phone ergonomics beyond tap size.
//
// Tap size is tested elsewhere (css-tap-area-helper, css-mobile-ergonomics-and-v9-contract), and the
// keyboard hook's own behaviour in ward-mobile-keyboard-hook and ward-mobile-keyboard-viewport. This
// file holds the stylesheet contract that keeps the on-screen keyboard and the floating bar (D-112)
// off the focused field and the submit buttons:
//
// 1. The page scrolls a focused field clear of the bar's clearance (`scroll-padding-bottom`), and the
//    page's content ends above the bar (`padding-bottom`).
// 2. While the keyboard is up (`html[data-wf-keyboard="open"]`, set by useMobileKeyboard) the bar steps
//    out of view and the clearance becomes the keyboard's height, so bars that seat on the bar's edge
//    rest on the keyboard instead, and the phone sheet's footer rises above it.
// 3. Both bars' clearance includes the home indicator (`env(safe-area-inset-bottom)`).
// 4. A phone bar or toast pinned to the foot follows the clearance, or is listed in FIXED_FOOT with
//    why. Fixed 10 Nov 2026 (D-125): the officer, ward answer and ready-to-leave toasts sat 92px up, on
//    the floating bar where the home indicator is (113px clearance), and now take the shared toast
//    region's sum above --wf-dock-clear; the four unused 92px toast classes were deleted.
//
// Not covered here: 200% text against the bar needs a browser at that zoom (manual script M97).
// Reads files with `readFileSync`; run it by name.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import postcss from "postcss";
import { describe, expect, it } from "vitest";

const LAYOUT = "src/app/ward-flow/ward-flow-layout.module.css";
const PAGE_DOCK = "src/components/ward-management/shell/ward-phone-page-dock.module.css";
const NEXT_DOCK = "src/components/ward-management/shell-next/next-phone-dock.module.css";
const MENU = "src/components/ward-management/shell/ward-phone-menu.module.css";
const KIT_PHONE = "src/components/wf/phone.module.css";

/** Every declaration in a file with the selectors and media around it. */
function declarations(file: string): { selector: string; media: string; prop: string; value: string }[] {
  const out: { selector: string; media: string; prop: string; value: string }[] = [];
  postcss.parse(readFileSync(file, "utf8")).walkDecls((decl) => {
    const rule = decl.parent;
    if (rule?.type !== "rule") return;
    const media: string[] = [];
    for (let at: postcss.Node | undefined = rule.parent; at; at = at.parent)
      if (at.type === "atrule") media.push((at as postcss.AtRule).params);
    out.push({
      selector: (rule as postcss.Rule).selector.replace(/\s+/g, " "),
      media: media.join(" & "),
      prop: decl.prop,
      value: decl.value,
    });
  });
  return out;
}

const find = (file: string, prop: string, selector: RegExp) =>
  declarations(file).filter((decl) => decl.prop === prop && selector.test(decl.selector));

describe("M100: the keyboard and the floating bar never hide the field or the submit button", () => {
  it("scrolls a focused field clear of the bar, and ends the page above it", () => {
    expect(
      declarations(LAYOUT).some((d) => d.prop === "scroll-padding-bottom" && /--wf-dock-clear/.test(d.value)),
    ).toBe(true);
    expect(declarations(PAGE_DOCK).some((d) => d.prop === "padding-bottom" && d.value === "var(--wf-dock-clear)")).toBe(
      true,
    );
  });

  it("hides the bar while the keyboard is up and seats pinned bars on the keyboard instead", () => {
    const open = /html\[data-wf-keyboard="open"\]/;
    expect(find(PAGE_DOCK, "visibility", open).map((d) => d.value)).toContain("hidden");
    expect(find(PAGE_DOCK, "--wf-dock-clear", open).map((d) => d.value)).toContain("var(--keyboard-height, 0px)");
    expect(find(PAGE_DOCK, "--wf-dock-top", open).map((d) => d.value)).toContain("var(--keyboard-height, 0px)");
    // The kit's phone sheet keeps its footer, with the submit button, above the keyboard.
    expect(find(KIT_PHONE, "padding-bottom", open).map((d) => d.value)).toContain("var(--keyboard-height, 0px)");
  });

  it.each([PAGE_DOCK, NEXT_DOCK, MENU])("%s counts the home indicator in the bar's clearance", (file) => {
    const clear = declarations(file).filter((d) => d.prop === "--wf-dock-clear" && !/keyboard/.test(d.value));
    expect(clear.length, `${file} sets no --wf-dock-clear`).toBeGreaterThan(0);
    for (const decl of clear) expect(decl.value, decl.selector).toMatch(/env\(safe-area-inset-bottom/);
  });
});

/**
 * Phone toasts and bars pinned to the foot by a fixed distance, not the bar's clearance. Empty since
 * 10 Nov 2026; a new one must follow `--wf-dock-clear` or `--wf-dock-top`, or be listed here with why.
 */
const FIXED_FOOT: Readonly<Record<string, string>> = {};

const PHONE = /max-width:\s*46\.4375rem/;
const FOLLOWS = /--wf-dock-(?:clear|top)|--keyboard-height|safe-area-inset-bottom|--wf-foot-bar-lift/;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).split("\\").join("/");
    if (/mockups|ward-redesign/.test(path)) return [];
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

describe("M100: phone bars and toasts pinned to the foot follow the bar's clearance", () => {
  it("lists every one that does not", () => {
    const fixed: Record<string, string> = {};
    for (const file of cssFiles("src/components/ward-management")) {
      postcss.parse(readFileSync(file, "utf8")).walkRules((rule) => {
        let at: postcss.Node | undefined = rule.parent;
        const media: string[] = [];
        for (; at; at = at.parent) if (at.type === "atrule") media.push((at as postcss.AtRule).params);
        if (!media.some((params) => PHONE.test(params))) return;
        let position = "";
        let bottom = "";
        rule.walkDecls((decl) => {
          if (decl.prop === "position") position = decl.value;
          if (decl.prop === "bottom") bottom = decl.value;
        });
        // A scrim or full sheet sits at 0; only something lifted off the foot can sit on the bar.
        if (position !== "fixed" || !bottom || /^0(?:px)?$/.test(bottom) || FOLLOWS.test(bottom)) return;
        const key = `${file.replace("src/components/ward-management/", "")} ${rule.selector.replace(/\s+/g, " ")} ${bottom}`;
        fixed[key] = FIXED_FOOT[key] ?? "NEW: follow --wf-dock-clear or --wf-dock-top";
      });
    }
    expect(fixed).toEqual(FIXED_FOOT);
  });
});
