// F-27 (A9-26, 13 Nov 2026): the Executive rail's Bed alerts card builds its rows the way every
// other network desk does (H2, Josh, 3 Nov 2026): the three fullest health services, fullest first,
// with Metro as a whole on the foot line. It used to count the Metro total as a place beside the
// fullest service, so "2 at or over 85% full" left out a service at 85% the page beside it listed.
import { describe, expect, it } from "vitest";

import { executiveCapacity } from "@/components/ward-management/shell/ward-executive-chrome";

type Report = Parameters<typeof executiveCapacity>[0];

/** A public report with only the fields the card reads; beds in use out of 100 is the percentage. */
function report(
  services: [string, number][],
  scope: Report["network"]["scope"] = { kind: "statewide" } as Report["network"]["scope"],
): Report {
  return {
    network: { scope, beds: { ready: 7 } },
    services: services.map(([service, inUse]) => ({ service, beds: { total: 100, inUse } })),
  } as unknown as Report;
}

describe("F-27: the executive rail counts the services at or over the line, as the page does", () => {
  const statewide = report([
    ["North Metro", 86],
    ["South Metro", 85],
    ["East Metro", 87],
    ["WA Country", 70],
  ]);

  it("lists the three fullest services, fullest first, and puts Metro on the foot line", () => {
    const capacity = executiveCapacity(statewide);
    expect(capacity.rows.map((row) => [row.name, row.percent])).toEqual([
      ["East Metro", 87],
      ["North Metro", 86],
      ["South Metro", 85],
    ]);
    expect(capacity.rows.some((row) => row.key === "metro")).toBe(false);
    expect(capacity.metroFoot).toBe(86);
  });

  it("says 3 at or over 85% full where three services are, never counting Metro as a place", () => {
    expect(executiveCapacity(statewide).overLine).toEqual({ label: "3 at or over 85% full", over: 3 });
  });

  it("keeps a service desk on its own service with no separate Metro line", () => {
    const service = executiveCapacity(
      report([["East Metro", 87]], { kind: "service", service: "East Metro" } as Report["network"]["scope"]),
    );
    expect(service.rows.map((row) => row.key)).toEqual(["own"]);
    expect(service.metroFoot).toBeNull();
  });
});
