import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import requireLucideIconAria from "./eslint-rules/require-lucide-icon-aria.mjs";
import requireButtonWiring from "./eslint-rules/require-button-wiring.mjs";
import requireZIndexLadder from "./eslint-rules/require-z-index-ladder.mjs";
import restrictSuppressHydrationWarning from "./eslint-rules/restrict-suppress-hydration-warning.mjs";
import noHardcodedHex from "./eslint-rules/no-hardcoded-hex.mjs";
import { MAX_LINES_BASELINE, MAX_LINES_DEFAULT } from "./eslint-rules/max-lines-baseline.mjs";

// Shared `local` plugin object. ESLint flat config requires every config block
// that references a plugin namespace to point at the *same* object, and the five
// local rules below are spread across four blocks with different `files`/`ignores`
// combinations, so they all point at this one.
//
// The mockup-ignore scopes are no longer what separates them: every rule that
// exempts mockups now uses the shared MOCKUP_IGNORES globs below. Until 2026-09-02
// require-lucide-icon-aria carried its own broader `**/*mockup*` substring, which
// is the exact over-match the MOCKUP_IGNORES comment warns about.
const localRulesPlugin = {
  rules: {
    "require-lucide-icon-aria": requireLucideIconAria,
    "require-button-wiring": requireButtonWiring,
    "require-z-index-ladder": requireZIndexLadder,
    "restrict-suppress-hydration-warning": restrictSuppressHydrationWarning,
    "no-hardcoded-hex": noHardcodedHex,
  },
};

// Design-scratch mockups (404 in production) are exempt from the local rules.
// Match the repo's documented mockup surface precisely — the `/mockups/*`
// routes, the `*-mockups/` component directories, and the `*-mockup(s).tsx`
// singletons — instead of a broad `*mockup*` substring, which would also exempt
// arbitrary production files whose name merely contains "mockup".
const MOCKUP_IGNORES = ["**/*-mockups/**", "**/*-mockups.tsx", "**/*-mockup.tsx"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ESLint 10 removed context.getFilename(), which eslint-plugin-react (a dependency of
  // eslint-config-next, last released 7.37.5, peer range stops at ESLint 9) calls only to
  // auto-detect the React version, so every react/* rule crashed. Naming the version skips
  // that detection. Keep it in step with the "react" major in package.json, and drop this
  // once eslint-plugin-react ships ESLint 10 support.
  { settings: { react: { version: "19" } } },
  // Accessibility: eslint-config-next only enables a narrow jsx-a11y subset
  // (alt-text, aria-props, role validity). Add `label-has-associated-control`
  // so a <label> that isn't wired to a control is caught in CI — a real markup
  // smell the default config misses.
  //
  // The sibling rule `control-has-associated-label` (which flags an unlabeled
  // <input>/<select>) is deliberately NOT enabled: it false-positives on this
  // codebase's pervasive `<label><span>text</span><input/></label>` pattern
  // (~13 correctly-labeled controls) and `depth` tuning does not clear them.
  // Precise unlabeled-control detection belongs in a runtime axe-core check.
  {
    files: ["**/*.{jsx,tsx}"],
    rules: {
      // The kit's typed date boxes render a real <input> first, so a wrapping <label> labels it.
      "jsx-a11y/label-has-associated-control": ["error", { controlComponents: ["DateField", "DateTimeField"] }],
    },
  },
  // The rest of the jsx-a11y recommended set. `aria-role` ignores components because `role` is also
  // the Ward Flow role prop (`role="coordinator"`). Options follow the plugin's recommended config,
  // widened only for patterns this site uses on purpose:
  // - a scrollable region, tab panel or feed takes tabIndex={0} so keyboard users can scroll it
  //   (axe's scrollable-region-focusable asks for exactly that);
  // - list and table roles are written out where CSS display would strip them in Safari;
  // - a tab list or radio group handles arrow keys on the group while its children take focus.
  // A case that still needs a judgement carries an eslint-disable-next-line with its reason.
  {
    files: ["src/**/*.{jsx,tsx}"],
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-activedescendant-has-tabindex": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/autocomplete-valid": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/interactive-supports-focus": [
        "error",
        { tabbable: ["button", "checkbox", "link", "searchbox", "spinbutton", "switch", "textbox"] },
      ],
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/no-interactive-element-to-noninteractive-role": [
        "error",
        { tr: ["none", "presentation"], canvas: ["img"], td: ["cell"] },
      ],
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        {
          handlers: ["onClick", "onError", "onLoad", "onMouseDown", "onMouseUp", "onKeyPress", "onKeyDown", "onKeyUp"],
          alert: ["onKeyUp", "onKeyDown", "onKeyPress"],
          body: ["onError", "onLoad"],
          dialog: ["onKeyUp", "onKeyDown", "onKeyPress"],
          iframe: ["onError", "onLoad"],
          img: ["onError", "onLoad"],
        },
      ],
      "jsx-a11y/no-noninteractive-element-to-interactive-role": [
        "error",
        {
          ul: ["listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"],
          ol: ["listbox", "menu", "menubar", "radiogroup", "tablist", "tree", "treegrid"],
          li: ["menuitem", "menuitemradio", "menuitemcheckbox", "option", "row", "tab", "treeitem"],
          table: ["grid"],
          td: ["gridcell"],
          fieldset: ["radiogroup", "presentation"],
        },
      ],
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { tags: [], roles: ["tabpanel", "region", "feed"], allowExpressionValues: true },
      ],
      "jsx-a11y/no-redundant-roles": [
        "error",
        {
          nav: ["navigation"],
          ul: ["list"],
          ol: ["list"],
          li: ["listitem"],
          thead: ["rowgroup"],
          tbody: ["rowgroup"],
        },
      ],
      "jsx-a11y/no-static-element-interactions": [
        "error",
        {
          allowExpressionValues: true,
          handlers: ["onClick", "onMouseDown", "onMouseUp", "onKeyPress", "onKeyDown", "onKeyUp"],
        },
      ],
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/iframe-has-title": "error",
      "jsx-a11y/img-redundant-alt": "error",
      "jsx-a11y/media-has-caption": "error",
      "jsx-a11y/mouse-events-have-key-events": "error",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/no-distracting-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/scope": "error",
      "jsx-a11y/tabindex-no-positive": "error",
    },
  },
  // File size ratchet. New source files stay under MAX_LINES_DEFAULT lines, and the files that
  // were already larger cannot grow much past their baseline (eslint-rules/max-lines-baseline.mjs).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["error", { max: MAX_LINES_DEFAULT }],
    },
  },
  ...Object.entries(MAX_LINES_BASELINE).map(([file, max]) => ({
    files: [file],
    rules: {
      "max-lines": ["error", { max }],
    },
  })),
  // A lucide-react icon rendered as JSX must be decorative (aria-hidden) or
  // carry an accessible name. Enforces the codebase's own convention so a glyph
  // can't silently reach the a11y tree. Mockups are design-scratch and exempt.
  {
    files: ["**/*.{jsx,tsx}"],
    ignores: MOCKUP_IGNORES,
    plugins: { local: localRulesPlugin },
    rules: {
      "local/require-lucide-icon-aria": "error",
    },
  },
  // A styled, labelled `<button type="button">` with no handler is a dead control
  // (the "Language and region" globe class, fixed 2026-07-21). Require an explicit
  // non-submit button to carry an onClick handler or an explicit disabled state.
  // Scoped to production source (`src/**`): this is a product-UX concern, so test
  // fixtures that render a bare <button> to exercise a slot are out of scope. The
  // full mockup-ignore set exempts the `*-mockups/` design-scratch previews.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: MOCKUP_IGNORES,
    plugins: { local: localRulesPlugin },
    rules: {
      "local/require-button-wiring": "error",
      "local/no-hardcoded-hex": "error",
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: { local: localRulesPlugin },
    rules: {
      "local/restrict-suppress-hydration-warning": "error",
    },
  },
  // Z-index ladder enforcement
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: MOCKUP_IGNORES,
    plugins: { local: localRulesPlugin },
    rules: {
      "local/require-z-index-ladder": "error",
    },
  },
  // Josh, 31 October 2026: the kit's styled confirm ("Leave this page?") replaces the browser's own
  // pop-up. The browser's confirm, alert and prompt boxes cannot be styled, read as a system error
  // and block the page; use the kit's dialogs (design/v9/design-system-v9.md). Only the styled
  // confirm's own no-host fallback may call window.confirm: the kit's confirm-dialog.tsx and its two
  // callers, which fall back to the browser's box only when no styled host is mounted. The redesign
  // mock-up copies in src/components/ward-redesign (preview only, blocked in production, retired as
  // each page is built) are also exempt. Never add a live-app file to this list.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      ...MOCKUP_IGNORES,
      "src/components/ward-redesign/**",
      "src/components/wf/confirm-dialog.tsx",
      "src/components/ward-management/use-dirty-state-guard.ts",
      "src/components/ward-management/ward-tasks-drawer.tsx",
    ],
    rules: {
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].flatMap((object) =>
          ["confirm", "alert", "prompt"].map((property) => ({
            object,
            property,
            message:
              "Use the kit's styled dialog (ConfirmDialog or Dialog), never the browser's own box (Josh, 31 Oct 2026).",
          })),
        ),
      ],
      "no-restricted-globals": [
        "error",
        ...["confirm", "alert", "prompt"].map((name) => ({
          name,
          message:
            "Use the kit's styled dialog (ConfirmDialog or Dialog), never the browser's own box (Josh, 31 Oct 2026).",
        })),
      ],
    },
  },
  // Import boundary: production source must not import design-scratch mockup
  // modules. Every legitimate mockup import lives under `src/app/mockups/**` (all
  // 404 in production) or inside the `*-mockups` component sources themselves;
  // everything else is fenced off so a mockup can't leak into a shipped route.
  // Verified 2026-07-20: zero violations outside the exempt directories.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/mockups/**", "**/*-mockups/**", "**/*-mockups.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/*-mockups", "**/*-mockups/*", "**/*mockup*"],
              message:
                "Production code must not import mockup modules (design-scratch, 404 in production). Mockup routes live under src/app/mockups/**.",
            },
          ],
        },
      ],
    },
  },
  // next/og image routes render <img> through Satori (rasterised server-side,
  // not DOM); next/image cannot run there. Turn the rule off for these files via
  // config rather than a per-file disable directive — the Next plugin reports
  // this rule inconsistently across environments (it fires with a local .next
  // present but not on a fresh CI checkout), so a disable directive flips
  // between "used" and "unused" and trips `--max-warnings 0`.
  {
    files: ["src/lib/brand-image.tsx", "src/app/opengraph-image.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The backend's generated engine bundle (backend/ward-flow/build-engine.mjs); its source is linted in src/.
    "backend/ward-flow/dist/**",
    "out/**",
    "build/**",
    "coverage/**",
    "output/**",
    ".codex-screenshots/**",
    ".qa-smoke/**",
    ".tmp-playwright-*/**",
    ".claude/**",
    "playwright-report/**",
    "test-results/**",
    "node_modules.broken-*/**",
    ".node_modules.stale-*/**",
    ".npm-cache*/**",
    ".tmp-visual/**",
    "sample-documents/**",
    "scratch/**",
    // Archived design artefacts moved out of docs/. The kit's shell browser scripts are copied
    // into the third edition drawings, so editing them to satisfy lint would make the drawings
    // drift. The prototypes are byte-pinned. The kit's .mjs check scripts stay linted.
    "design/third-edition-mockups/third-edition-kit/shell/*.js",
    "design/prototypes/**",
    // Recursive `**/` variants cover nested worktrees; the bare globs above already
    // ignore the repo-root dirs, so only the recursive forms are kept here.
    "**/.claude/**",
    "**/.tmp-visual/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
