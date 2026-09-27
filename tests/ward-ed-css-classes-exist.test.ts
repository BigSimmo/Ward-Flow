import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Commit 8035fdfa9f rewrote ed.module.css for the third-edition token layer and, in doing so,
 * silently dropped seven classes ed-screen.tsx still references: referralForm, referralGrid,
 * referralCheckbox, declineFieldset, declineLegend, declineOption, declineSubmit. Nothing caught
 * it because a CSS Module resolves an unknown property to `undefined`, which React happily
 * renders as `className={undefined}` — no build error, no runtime error, just an element with no
 * class and whatever the cascade happens to supply. This file is the catcher that a class
 * `ed-screen.tsx` asks for by name actually exists in `ed.module.css`, so the next rewrite cannot
 * repeat the drop silently.
 *
 * It also pins the production tap-target floor (48px / 3rem, `--spacing-tap` in
 * `src/app/globals.css`) on the ED action-button classes, restored alongside the missing seven
 * after the same rewrite shrank `.acceptButton`/`.declineButton` to 2.5rem and `.arrivedButton`
 * to 2.25rem.
 */

const edScreenSource = readFileSync(
  new URL("../src/components/ward-management/ed/ed-screen.tsx", import.meta.url),
  "utf8",
);
const edCss = readFileSync(new URL("../src/components/ward-management/ed/ed.module.css", import.meta.url), "utf8");

/** Every `styles.<identifier>` and `styles["identifier"]` / `styles['identifier']` reference in
 *  ed-screen.tsx, deduplicated. `styles` is the CSS Module import (`import styles from
 *  "./ed.module.css"`, confirmed at the top of ed-screen.tsx) — nothing else in this file is
 *  named `styles`. */
function usedClassNames(): string[] {
  const names = new Set<string>();
  for (const match of edScreenSource.matchAll(/\bstyles\.([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of edScreenSource.matchAll(/\bstyles\[["']([^"']+)["']\]/g)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `.<name>` appears as a class selector anywhere in ed.module.css — as its own rule,
 *  combined with siblings (`.a,\n.b {`), or with an attribute/pseudo suffix (`.a[aria-disabled=
 *  "true"]`, `.a:hover`). A trailing identifier character would mean we matched a *longer* class
 *  name that merely starts with this one, so the lookahead excludes that. */
function definesClass(name: string): boolean {
  return new RegExp(`\\.${escapeForRegExp(name)}(?![A-Za-z0-9_-])`).test(edCss);
}

/*
 * The five classes `styles.dataTable`, `styles.n`, `styles.formCol`, `styles.fresh`, and
 * `styles.popBody` — introduced by commit ae908cdd1b and never defined in ed.module.css — have
 * since been resolved against the ED drawing
 * (docs/ward-flow/mockups/emergency-department-third-edition.html):
 *   - `.dataTable`: removed from ed-screen.tsx. The drawing's `.dataTable` table-level rule adds
 *     nothing `.boardTable` doesn't already provide (width/border-collapse/colours match; the
 *     font-size differs by 0.5px, imperceptible).
 *   - `.n`: defined, scoped `.boardTable .n` / `.boardTable th.n` / `.boardTable td.n` — the
 *     drawing right-aligns these numeric/identifier columns with tabular-nums, which no sibling
 *     class provided.
 *   - `.formCol`: removed from ed-screen.tsx. The drawing never defines `.formCol` at all (grep
 *     confirms zero CSS rules for it) — a marker class with no visual effect in the drawing
 *     either.
 *   - `.fresh`: defined. The drawing pairs it with `.meta` on the same element in exactly this
 *     popHead context (`.popHead .fresh.meta`), confirming the combination is intentional, and
 *     gives it real properties (inline-flex, mono font, flex-basis) `.meta` doesn't.
 *   - `.popBody`: defined, scoped `.pxDrawer .popBody` — activates `.pxBody`'s existing
 *     `align-content: start` (a no-op without a flex/grid display) and clamps the single column.
 * This allowlist is now empty. It stays as an explicit, named list — not deleted — so the "keeps
 * the allowlist honest" check below still exercises both of its assertions (a re-added entry must
 * still be referenced AND still undefined) rather than iterating zero items and silently passing
 * either arm.
 */
const KNOWN_UNSTYLED_CLASSES: string[] = [];

describe("ed.module.css carries every class ed-screen.tsx references", () => {
  const used = usedClassNames();
  const checked = used.filter((name) => !KNOWN_UNSTYLED_CLASSES.includes(name));

  it("found a non-trivial number of styles.<name> usages to check", () => {
    // A canary for the extraction itself: if this drops to zero, the regex broke, not the CSS.
    expect(used.length).toBeGreaterThan(50);
  });

  it.each(checked)("defines .%s", (name) => {
    expect(definesClass(name), `ed.module.css has no ".${name}" selector`).toBe(true);
  });

  it("keeps the known-gap allowlist honest — every entry must still be used and still missing", () => {
    // A self-invalidating guard: if a future change defines one of these classes (or stops
    // referencing it), this fails loudly rather than letting the allowlist quietly go stale in
    // either direction — see docs/ward-flow's convention of pinning a finding beside the thing
    // that will invalidate it. The list is empty now that the five-class gap above is resolved, so
    // this loop currently asserts nothing on its own and passes vacuously — that is fine, because
    // every one of those five names moved into `checked` above and is covered for real by the
    // `it.each(checked)` "defines .%s" case a few lines up; this test's job is only to catch a
    // *future* re-addition to the allowlist going stale, not to prove anything while it is empty.
    for (const name of KNOWN_UNSTYLED_CLASSES) {
      expect(used, `"${name}" is no longer referenced by ed-screen.tsx — remove it from the allowlist`).toContain(name);
      expect(definesClass(name), `"${name}" now has a CSS definition — remove it from the allowlist`).toBe(false);
    }
  });
});

describe("ED action buttons meet the 48px / 3rem tap-target floor", () => {
  // Explicitly named rather than pattern-matched, per the brief: these are the classes
  // ed-screen.tsx applies to <button> elements that take a clinical action (accept/decline a
  // referral, mark a patient arrived, submit the decline-reason form).
  const buttonClasses = ["acceptButton", "declineButton", "arrivedButton", "declineSubmit"];

  it("checked at least the known ED action-button classes", () => {
    expect(buttonClasses.length).toBeGreaterThanOrEqual(4);
    for (const name of buttonClasses) {
      expect(definesClass(name), `ed.module.css has no ".${name}" selector to check`).toBe(true);
    }
  });

  function minHeightDeclarations(name: string): string[] {
    // Match every rule block whose selector list includes this class (comma-joined siblings
    // included, e.g. ".acceptButton,\n.declineButton {"), then pull every min-height value out
    // of that block's body.
    const blocks = [...edCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selectorList]) =>
      selectorList
        .split(",")
        .map((s) => s.trim())
        .some((s) => new RegExp(`^\\.${escapeForRegExp(name)}(?![A-Za-z0-9_-])`).test(s)),
    );
    return blocks.flatMap(([, , body]) => [...body.matchAll(/min-height:\s*([^;]+);/g)].map((m) => m[1].trim()));
  }

  it.each(buttonClasses)("%s never sets min-height below 3rem (48px)", (name) => {
    const declarations = minHeightDeclarations(name);
    expect(declarations.length, `${name} declares no min-height at all`).toBeGreaterThan(0);

    for (const raw of declarations) {
      // The token form is the expected shape post-fix; it resolves to exactly 3rem
      // (`--spacing-tap` in src/app/globals.css) and is trusted without re-deriving px.
      if (raw === "var(--spacing-tap)" || raw === "var(--ward-tap)") continue;

      const remMatch = raw.match(/^([\d.]+)rem$/);
      const pxMatch = raw.match(/^([\d.]+)px$/);
      const rem = remMatch ? Number(remMatch[1]) : pxMatch ? Number(pxMatch[1]) / 16 : null;

      expect(rem, `${name} min-height "${raw}" is neither a rem/px literal nor the tap token`).not.toBeNull();
      expect(rem as number, `${name} min-height "${raw}" is below the 3rem tap floor`).toBeGreaterThanOrEqual(3);
    }
  });
});
