import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/require-dynamic-load-retry.mjs";

/*
 * Audit 4 A4-08 (13 Nov 2026): the rule checked next/dynamic only. It now also checks React's own
 * `lazy` and a bare `import()` in a component file, with allowances for loads that already handle a
 * failed fetch.
 */
const linter = new Linter();

function lint(code: string, filename = "panel.jsx") {
  return linter
    .verify(
      code,
      {
        files: ["**/*.jsx", "**/*.js"],
        languageOptions: {
          parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
        },
        plugins: { local: { rules: { "require-dynamic-load-retry": rule } } },
        rules: { "local/require-dynamic-load-retry": "error" },
      },
      filename,
    )
    .map((message) => message.messageId);
}

describe("require-dynamic-load-retry: React lazy", () => {
  it("flags an unguarded lazy loader, named or through the React namespace", () => {
    expect(lint('import { lazy } from "react";\nconst A = lazy(() => import("./a"));')).toEqual(["wrapLazy"]);
    expect(lint('import React from "react";\nconst A = React.lazy(() => import("./a"));')).toEqual(["wrapLazy"]);
    expect(lint('import { lazy as later } from "react";\nconst A = later(load);', "panel.js")).toEqual(["wrapLazy"]);
  });

  it("allows a lazy loader wrapped in withLoadRetry or ending in .catch", () => {
    expect(lint('import { lazy } from "react";\nconst A = lazy(withLoadRetry(() => import("./a")));')).toEqual([]);
    expect(
      lint('import { lazy } from "react";\nconst A = lazy(() => import("./a").catch(() => ({ default: B })));'),
    ).toEqual([]);
  });

  it("ignores a lazy() that is not React's", () => {
    expect(lint('import { lazy } from "./x";\nconst A = lazy(() => 1);', "panel.js")).toEqual([]);
  });
});

describe("require-dynamic-load-retry: bare import() in a component file", () => {
  it("flags a load whose failure nothing handles", () => {
    expect(lint('const go = () => void import("./a").then((m) => m.run());\ngo();')).toEqual(["bareImport"]);
    expect(lint('const load = () => import("./a");\nconst B = () => <a onFocus={() => void load()} />;')).toEqual([
      "bareImport",
    ]);
    expect(lint('export const load = () => import("./a");')).toEqual(["bareImport"]);
  });

  it("allows loads that handle failure", () => {
    // Inside a handler, directly or through a named loader.
    expect(
      lint('const load = () => import("./a");\nconst A = dynamic(withLoadRetry(() => load().then((m) => m.A)));'),
    ).toEqual([]);
    expect(
      lint('preloadWhenIdle(() => import("./a"));\nconst B = loadEarly(() => import("./b").then((m) => m.B));'),
    ).toEqual([]);
    // A chain that handles rejection, through Promise.all.
    expect(lint('void import("./a").then(run, fail);\nvoid Promise.all([import("./b"), x]).catch(fail);')).toEqual([]);
    // Awaited inside try/catch.
    expect(lint('async function f() { try { (await import("./a")).run(); } catch { fail(); } }')).toEqual([]);
    // An export loader given to ListExportButton's `load`, which catches it.
    expect(
      lint(
        'function C() {\n  const exportList = async () => (await import("./e")).download();\n  return <B load={exportList} />;\n}',
      ),
    ).toEqual([]);
    // A hover preload that catches its own failure.
    expect(
      lint(
        'const load = () => import("./a");\nconst A = dynamic(withLoadRetry(load));\nconst B = () => <a onFocus={() => void load().catch(() => undefined)} />;',
      ),
    ).toEqual([]);
  });

  it("leaves logic files (.ts, .js) to their callers", () => {
    expect(lint('export const load = () => import("./a");', "logic.js")).toEqual([]);
  });
});
