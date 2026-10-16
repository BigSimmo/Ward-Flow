import { describe, expect, it } from "vitest";
import { findExplanatoryDisabledButtonViolations } from "../scripts/ward-flow/check-explanatory-buttons.mjs";
import { GET as getHealth } from "../src/app/api/health/route";
import { GET as getLocalProjectId } from "../src/app/api/local-project-id/route";
import { eventLogEntryFor } from "../src/components/ward-management/ward-event-log";
import { readmissionDetailText } from "../src/components/ward-management/ward-readmission-flag";
import { buildBuzzKey } from "../src/components/ward-management/ward/ward-notification-center";

describe("18-skill audit remediation invariants", () => {
  it("formats readmission detail dates in Australia/Perth timezone across UTC day boundaries", () => {
    // 2026-09-01T18:00:00Z is 2026-09-02T02:00:00+08:00 in Perth (2 Sept, not 1 Sept)
    const detail = readmissionDetailText(
      {
        admissionId: "adm-prior-1",
        unitId: "unit-4a",
        unitName: "Ward 4A",
        dischargedAt: 0,
        daysBefore: 12,
      },
      new Date("2026-09-01T18:00:00Z"),
    );
    expect(detail).toContain("2 Sept");
    expect(detail).toContain("from Ward 4A · 12d before");
  });

  it("detects both <button disabled aria-describedby> and <Button disabled disabledReason> violations", () => {
    const lowercaseViolation = findExplanatoryDisabledButtonViolations(
      `<button type="button" disabled aria-describedby="reason-id">Save</button>`,
      "src/example.tsx",
    );
    expect(lowercaseViolation).toHaveLength(1);

    const uppercaseViolation = findExplanatoryDisabledButtonViolations(
      `<Button disabled disabledReason="UMRN not recorded">Save</Button>`,
      "src/example.tsx",
    );
    expect(uppercaseViolation).toHaveLength(1);
  });

  it("emits explicit nosniff and no-store headers from health and local-project-id routes", () => {
    const healthRes = getHealth();
    expect(healthRes.headers.get("Cache-Control")).toBe("no-store");
    expect(healthRes.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const projectRes = getLocalProjectId(
      new Request("http://localhost:3000/api/local-project-id", { headers: { host: "localhost:3000" } }),
    );
    expect(projectRes.headers.get("Cache-Control")).toBe("no-store");
    expect(projectRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("tracks monotonic EventLogEntry sequences and disambiguates duplicate buzzes", () => {
    const entry = eventLogEntryFor({ type: "RESET_SCENARIO", role: "demo", now: 600 }, true);
    expect(entry).toEqual({
      sequence: 0,
      type: "RESET_SCENARIO",
      role: "demo",
      now: 600,
      accepted: true,
    });

    const counts = new Map<string, number>();
    const buzz = { unitId: "ward-alpha", at: 540, byRole: "coordinator", message: "Refresh now", urgent: true };
    expect(buildBuzzKey(buzz, counts)).toBe("ward-alpha:540:coordinator:Refresh now:true");
    expect(buildBuzzKey(buzz, counts)).toBe("ward-alpha:540:coordinator:Refresh now:true#1");
  });
});
