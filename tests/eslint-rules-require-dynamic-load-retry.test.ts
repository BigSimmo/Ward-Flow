import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/require-dynamic-load-retry.mjs";

// Review finding 2 (12 Nov 2026): a next/dynamic loader without withLoadRetry caches a failed chunk
// fetch, so Try again re-throws until reload. Pins that every loader is wrapped.
const linter = new Linter();

function lint(code: string) {
  return linter.verify(code, {
    languageOptions: { parserOptions: { ecmaVersion: "latest", sourceType: "module" } },
    plugins: { local: { rules: { "require-dynamic-load-retry": rule } } },
    rules: { "local/require-dynamic-load-retry": "error" },
  });
}

describe("require-dynamic-load-retry", () => {
  it("flags a bare next/dynamic loader", () => {
    expect(lint('import dynamic from "next/dynamic";\nconst A = dynamic(() => import("./a"));')).toHaveLength(1);
  });

  it("flags a renamed next/dynamic import", () => {
    expect(lint('import lazy from "next/dynamic";\nconst A = lazy(load, { ssr: false });')).toHaveLength(1);
  });

  it("allows a loader wrapped in withLoadRetry", () => {
    expect(
      lint(
        'import dynamic from "next/dynamic";\nconst A = dynamic(withLoadRetry(() => import("./a")), { ssr: false });',
      ),
    ).toHaveLength(0);
  });

  it("ignores a dynamic() that is not next/dynamic", () => {
    expect(lint('import { dynamic } from "./x";\nconst A = dynamic(() => 1);')).toHaveLength(0);
  });
});
