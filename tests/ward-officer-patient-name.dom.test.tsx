import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { OfficerScreen, isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { movementById } from "@/components/ward-management/ward-movements";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh, 25 September 2026 (walkthrough question 5, "yes"): the transport officer sees the
 * patient's name on each job, resolved exactly as the Referral board resolves it, and "Not
 * recorded" when no single patient is linked. Never a record id.
 */
describe("transport officer job cards name the patient", () => {
  it("shows the resolved name for linked jobs and Not recorded for unlinked ones", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    const state = seedWardFlowState();
    const jobs = state.movements.filter((movement) => isOfficerJob(movement));
    expect(jobs.length).toBeGreaterThan(0);
    let linked = 0;
    let unlinked = 0;
    for (const movement of jobs) {
      const line = screen.queryByTestId(`ward-officer-patient-${movement.id}`);
      if (!line) continue;
      const info = resolveSubjectPatient(movement, state);
      if (info.patient) {
        linked++;
        expect(line).toHaveTextContent(info.displayName);
      } else {
        unlinked++;
        expect(line).toHaveTextContent("Not recorded");
      }
      expect(line.textContent).not.toMatch(/PT-|Unknown Patient/);
    }
    expect(linked, "at least one seeded job has a linked patient").toBeGreaterThan(0);
    // Every seeded record now names a real patient (Josh, 25 Sept 2026: demo data only as linked
    // patients), so no seeded job is unlinked. The "Not recorded" branch is checked below on a job
    // unlinked for that test only.
    expect(unlinked, "a seeded job names no patient, which the seed rule no longer allows").toBe(0);
  });

  it("says Not recorded on a job linked to no patient", () => {
    const state = seedWardFlowState();
    const job = state.movements.find(
      (movement) => isOfficerJob(movement) && movement.patientId !== undefined && !movement.referralId,
    );
    if (!job) throw new Error("no seeded officer job with a direct patient link and no referral");
    const live = movementById(job.id);
    if (!live) throw new Error(`${job.id} is missing from the seed`);
    // The seed copies the movement when the provider mounts, so the unlinking is in place first.
    const saved = live.patientId;
    live.patientId = undefined;
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <OfficerScreen />
        </WardFlowProvider>,
      );
      const line = screen.getByTestId(`ward-officer-patient-${job.id}`);
      expect(line).toHaveTextContent("Not recorded");
      expect(line.textContent).not.toMatch(/PT-|Unknown Patient/);
    } finally {
      live.patientId = saved;
    }
  });
});
