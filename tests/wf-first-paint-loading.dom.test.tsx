// Shared design parts item 12 (Josh, 13 Nov 2026; F-62): the first paint is dark when the theme is,
// and a page on its way shows grey rows shaped like its content and the synthetic-data mark, with
// no spinner.
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow" }));

import WardFlowLoading from "@/app/ward-flow/loading";
import { HeldDeskLoading } from "@/app/ward-flow/loading-status";
import { APP_THEME_COLORS, FIRST_PAINT_STYLE } from "@/lib/theme";

describe("dark first paint", () => {
  it("gives a dark theme the dark canvas before any stylesheet, at zero specificity", () => {
    expect(FIRST_PAINT_STYLE).toContain(
      `:where(html.dark,html[data-theme="dark"]){color-scheme:dark;background-color:${APP_THEME_COLORS.dark}}`,
    );
    expect(FIRST_PAINT_STYLE).toContain(`@media (prefers-color-scheme:dark){:where(html:not([data-theme="light"])`);
    expect(FIRST_PAINT_STYLE).toContain(`:where(html[data-theme="light"]){color-scheme:light}`);
    // Every rule is wrapped in :where(), so the real stylesheets win once they load.
    expect(
      FIRST_PAINT_STYLE.replace(/@media[^{]*\{/gu, "")
        .match(/(^|\})[^{}]+\{/gu)
        ?.every((rule) => rule.includes(":where(")),
    ).toBe(true);
  });

  it("is in the document head of the root layout", () => {
    const layout = readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/<head>[\s\S]*__html: FIRST_PAINT_STYLE[\s\S]*<\/head>\s*<body/u);
  });
});

describe("loading placeholder", () => {
  it("draws placeholder rows and the synthetic mark, with no spinner", () => {
    const { container } = render(<WardFlowLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading page");
    expect(container.querySelector("[data-loading-rows]")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("[data-wf-synthetic-mark]")).not.toBeNull();
    expect(container.querySelector("[class*='spin']")).toBeNull();
  });

  it("gives the held-desk first load (a fresh phone opening Home) the same rows and mark", () => {
    const { container } = render(<HeldDeskLoading />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll("[data-loading-rows] [class*='row']").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-wf-synthetic-mark]")).not.toBeNull();
    // The mark sits beside the status line, not inside it, so the status is announced alone.
    expect(screen.getByRole("status")).not.toHaveTextContent("Synthetic");
  });

  it("fills the rows with the track, pulses only when motion is welcome, and has no spinner rule", () => {
    const rows = readFileSync(
      path.join(process.cwd(), "src/components/ward-management/shell/ward-loading-rows.module.css"),
      "utf8",
    );
    expect(rows).toMatch(/\.bar \{[^}]*background: var\(--wf-track\)/u);
    expect(rows).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.bar \{\s*animation/u);
    const loading = readFileSync(path.join(process.cwd(), "src/app/ward-flow/loading.module.css"), "utf8");
    expect(loading).not.toMatch(/\.spin\b/u);
  });

  it("keeps the hidden 15 s line out of the layout until it shows, so the mark shares the status row", () => {
    // Item 12 (approved picture): hidden only by visibility, the line still took its space, wrapped
    // the status to two lines and pushed the mark and the rows down.
    const loading = readFileSync(path.join(process.cwd(), "src/app/ward-flow/loading.module.css"), "utf8");
    const slow = /\n\.slow \{([^}]*)\}/u.exec(loading)?.[1] ?? "";
    expect(slow).toMatch(/max-width: 0;\s*max-height: 0;\s*overflow: hidden;\s*visibility: hidden;/u);
    const shown = /@keyframes wardLoadingSlowShow \{\s*to \{([^}]*)\}/u.exec(loading)?.[1] ?? "";
    expect(shown).toMatch(/max-width: none;[\s\S]*max-height: none;[\s\S]*visibility: visible;/u);
  });
});
