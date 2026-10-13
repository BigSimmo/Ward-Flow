import { expect, type Page, type Locator } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

export interface AccessibilityAuditOptions {
  /**
   * Specific container or locator to audit (defaults to full document).
   */
  include?: string | string[] | Locator;
  /**
   * Selectors or containers to exclude from the audit.
   */
  exclude?: string | string[] | Locator;
  /**
   * WCAG standard tags to test against. Defaults to WCAG 2.1 Level AA.
   */
  tags?: string[];
  /**
   * Rule IDs to disable for known acceptable design patterns.
   */
  disableRules?: string[];
}

/**
 * Executes a fast, automated WCAG 2.1 AA accessibility audit using @axe-core/playwright.
 * Designed to run directly inside user journey test steps with minimal overhead (<50ms).
 */
export async function auditAccessibility(page: Page, options: AccessibilityAuditOptions = {}): Promise<void> {
  const { include, exclude, tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"], disableRules = [] } = options;

  let builder = new AxeBuilder({ page }).withTags(tags);

  if (include) {
    if (typeof include === "string" || Array.isArray(include)) {
      builder = builder.include(include);
    } else {
      builder = builder.include(include as unknown as string);
    }
  }

  // Always exclude Next.js internal development overlays and dev-server badges if present
  const defaultExcludes = ["#next-logo", "[data-nextjs-portal]", "nextjs-portal"];
  builder = builder.exclude(
    exclude
      ? Array.isArray(exclude)
        ? [...exclude, ...defaultExcludes]
        : [exclude as unknown as string, ...defaultExcludes]
      : defaultExcludes,
  );

  if (disableRules.length > 0) {
    builder = builder.disableRules(disableRules);
  }

  const results = await builder.analyze();

  const seriousViolations = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");

  if (seriousViolations.length > 0) {
    const summary = seriousViolations
      .map(
        (v) =>
          `[${v.impact?.toUpperCase()}] ${v.id}: ${v.help} (${v.helpUrl})\n` +
          v.nodes
            .slice(0, 3)
            .map((n) => `  - Selector: ${n.target.join(" > ")}\n    HTML: ${n.html.slice(0, 120)}`)
            .join("\n"),
      )
      .join("\n\n");

    expect(
      seriousViolations,
      `Accessibility audit detected ${seriousViolations.length} critical/serious WCAG violations:\n\n${summary}`,
    ).toEqual([]);
  }
}
