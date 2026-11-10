// TE-04: the browser error receiver takes four allow-listed fields and nothing else.
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/client-error/route";
import { routeTemplate } from "@/lib/browser-error-report";
import {
  CLIENT_ERROR_LINES_PER_MINUTE,
  CLIENT_ERROR_ROLES,
  CLIENT_ROUTE_TEMPLATES,
  parseClientErrorReport,
  resetClientErrorLimit,
} from "@/lib/client-error-receiver";
import { logger } from "@/lib/logger";
import { WARD_ACCESS_ROLES } from "@/components/ward-management/ward-role-access";

const good = { type: "TypeError", route: "/ward-flow/people/[id]", release: "abc123", role: "ward" };

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return POST(
    new Request("https://synthetic.invalid/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(text.length), ...headers },
      body: text,
    }),
  );
}

function pageTemplates(): string[] {
  const root = join(process.cwd(), "src", "app");
  const found: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name === "page.tsx") {
        const route = relative(root, dir).split(sep).join("/");
        found.push(("/" + route).replace(/\[[^\]]+\]/g, "[id]"));
      }
    }
  };
  visit(root);
  return found.sort();
}

beforeEach(() => resetClientErrorLimit());
afterEach(() => vi.restoreAllMocks());

describe("client error receiver", () => {
  it("lists every page's route template, and the browser derives each one", () => {
    const pages = pageTemplates();
    expect([...CLIENT_ROUTE_TEMPLATES].sort(), "add or remove the page's line in client-error-receiver.ts").toEqual(
      pages,
    );
    for (const template of pages) expect(routeTemplate(template.replaceAll("[id]", "SYN-0042"))).toBe(template);
  });

  it("keeps its role list in step with the access table", () => {
    expect([...CLIENT_ERROR_ROLES].sort()).toEqual([...WARD_ACCESS_ROLES, "none"].sort());
  });

  it("logs an allowed report as one ward.client_error line with the four fields only", async () => {
    const error = vi.spyOn(logger, "error");
    const response = await post(good);
    expect(response.status).toBe(204);
    expect(error).toHaveBeenCalledWith("ward.client_error", {
      errorType: "TypeError",
      route: "/ward-flow/people/[id]",
      release: "abc123",
      role: "ward",
    });
  });

  it("refuses extra fields, a message, a stack, bad values and oversize bodies", async () => {
    const error = vi.spyOn(logger, "error");
    for (const body of [
      { ...good, message: "Test Patient Alpha" },
      { ...good, stack: "at x" },
      { ...good, type: "Test Patient Alpha" },
      { ...good, role: "Test Patient Alpha" },
      { ...good, release: "Test Patient Alpha" },
      { type: good.type, route: good.route, release: good.release },
      ["TypeError"],
      "not json",
    ])
      expect((await post(body)).status).toBe(400);
    expect((await post(good, { "content-type": "text/plain" })).status).toBe(400);
    expect((await post({ ...good, route: "/x".repeat(300) })).status).toBe(413);
    expect(error).not.toHaveBeenCalled();
  });

  it("logs a screen outside the list as other, never its address", async () => {
    const error = vi.spyOn(logger, "error");
    await post({ ...good, route: "/ward-flow/test-patient-alpha" });
    expect(error).toHaveBeenCalledWith("ward.client_error", expect.objectContaining({ route: "other" }));
    expect(JSON.stringify(error.mock.calls)).not.toContain("alpha");
  });

  it("logs each kind once a minute and caps the lines a minute", async () => {
    const error = vi.spyOn(logger, "error");
    await post(good);
    await post(good);
    expect(error).toHaveBeenCalledTimes(1);
    const statuses: number[] = [];
    for (let index = 0; index < CLIENT_ERROR_LINES_PER_MINUTE + 5; index++)
      statuses.push((await post({ ...good, release: `r${index}` })).status);
    expect(error).toHaveBeenCalledTimes(CLIENT_ERROR_LINES_PER_MINUTE);
    expect(statuses.at(-1)).toBe(429);
  });

  it("matches the proxy's CSRF guard for a cross-site POST", async () => {
    const { apiMutationCsrfVerdict, isCsrfGuardedApiRequest } = await import("@/lib/api-csrf");
    expect(isCsrfGuardedApiRequest("POST", "/api/client-error")).toBe(true);
    expect(apiMutationCsrfVerdict(new Headers({ "sec-fetch-site": "cross-site" }), "synthetic.invalid").allowed).toBe(
      false,
    );
  });
});
