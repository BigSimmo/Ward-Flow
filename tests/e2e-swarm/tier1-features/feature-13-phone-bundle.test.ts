import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  validateBudgets,
  overBudget,
  scriptSources,
} from "../../../scripts/check-script-budget.mjs";

describe("Feature 13: Phone Bundle Diet & Script Budgets", () => {
  const budgetPath = join(process.cwd(), "script-budget.json");

  it("verifies script-budget.json exists and conforms to validateBudgets schema", () => {
    expect(existsSync(budgetPath)).toBe(true);
    const raw = readFileSync(budgetPath, "utf-8");
    const json = JSON.parse(raw);
    expect(json).toHaveProperty("budgets");
    expect(typeof json.budgets).toBe("object");

    // validateBudgets will throw if invalid
    expect(() => validateBudgets(json.budgets)).not.toThrow();
  });

  it("verifies each key route has a defined budget under 650 KB", () => {
    const raw = readFileSync(budgetPath, "utf-8");
    const { budgets } = JSON.parse(raw);

    const expectedRoutes = [
      "/ward-flow",
      "/ward-flow/referrals",
      "/ward-flow/ed",
      "/ward-flow/ward/rph-adult-secure",
      "/ward-flow/movements/WF-001",
    ];

    for (const route of expectedRoutes) {
      expect(budgets).toHaveProperty(route);
      expect(typeof budgets[route]).toBe("number");
      expect(budgets[route]).toBeGreaterThan(0);
      expect(budgets[route]).toBeLessThanOrEqual(650); // Hard maximum ceiling for mobile performance
    }
  });

  it("accurately detects routes exceeding mobile script budgets with overBudget()", () => {
    const budgets = {
      "/ward-flow": 500,
      "/ward-flow/ed": 450,
    };

    const compliantMeasurement = {
      "/ward-flow": 490,
      "/ward-flow/ed": 440,
    };
    const violationsCompliant = overBudget(compliantMeasurement, budgets);
    expect(violationsCompliant).toEqual([]);

    const overLimitMeasurement = {
      "/ward-flow": 520, // 20 KB over
      "/ward-flow/ed": 440,
    };
    const violationsOver = overBudget(overLimitMeasurement, budgets);
    expect(violationsOver.length).toBe(1);
    expect(violationsOver[0]).toMatchObject({
      route: "/ward-flow",
      kb: 520,
      limit: 500,
    });
  });

  it("extracts script sources correctly from HTML, ignoring nomodule polyfills", () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="/_next/static/chunks/main.js"></script>
          <script src="/_next/static/chunks/app.js"></script>
          <script nomodule src="/_next/static/chunks/polyfills.js"></script>
          <script src="https://external-cdn.invalid/tracker.js"></script>
        </head>
        <body><div>Ward Flow</div></body>
      </html>
    `;

    const sources = scriptSources(mockHtml);
    expect(sources).toContain("/_next/static/chunks/main.js");
    expect(sources).toContain("/_next/static/chunks/app.js");
    expect(sources).not.toContain("/_next/static/chunks/polyfills.js"); // excluded nomodule
    expect(sources.length).toBe(2);
  });

  it("confirms dynamic panel modules use { ssr: false } to maintain phone bundle budget", () => {
    // Check key lazy loaded panels in ward-management
    const wardLazyPath = join(
      process.cwd(),
      "src/components/ward-management/ward/ward-screen-lazy.tsx",
    );
    expect(existsSync(wardLazyPath)).toBe(true);
    const content = readFileSync(wardLazyPath, "utf-8");
    expect(content).toContain("ssr: false");
  });
});
