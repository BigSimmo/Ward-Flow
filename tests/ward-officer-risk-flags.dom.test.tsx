import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { installMatchMediaStub } from "./setup/jsdom.setup";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { OfficerScreen, isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { RISK_FLAG_LABELS } from "@/components/ward-management/referrals/ward-referral-drawer-model";

/**
 * D-80 PR 5 (item 7): the transport officer sees the referral's collection risk flags on the job,
 * in the referral drawer's words, and nothing at all when the referrer recorded none. The seed
 * carries no flags, so one synthetic job gains them for this test only.
 */
afterEach(() => {
  installMatchMediaStub(false);
});

function officerJobs() {
  const jobs = seedWardFlowState().movements.filter((movement) => isOfficerJob(movement) && movement.transport);
  if (jobs.length < 2) throw new Error("the seed needs two officer jobs with a booking");
  return jobs;
}

describe("transport officer job panel shows collection risk flags", () => {
  it.each([false, true])("lists the recorded flags by name (phone=%s)", (phone) => {
    installMatchMediaStub(phone);
    const [job] = officerJobs();
    const live = movementById(job.id);
    if (!live) throw new Error(`${job.id} is missing from the seed`);
    // The seed copies the movement when the provider mounts, so the flags are in place first.
    const saved = live.collectionRiskFlags;
    live.collectionRiskFlags = ["aggression", "suicide", "vulnerable"];
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <OfficerScreen />
        </WardFlowProvider>,
      );
      expect(screen.queryByTestId(`ward-officer-risk-flags-${job.id}`)).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId(`ward-officer-select-${job.id}`));
      const panel = screen.getByTestId("ward-officer-detail");
      const flags = within(panel).getByTestId(`ward-officer-risk-flags-${job.id}`);
      expect(flags).toBeVisible();
      expect(within(flags).getByText("Risk flags")).toBeInTheDocument();
      // The officer's copy of the words (kept apart for phone page size) must read exactly as the
      // referral drawer's own labels, so the two lists cannot drift (audit 24-2, TH-07).
      const words = [RISK_FLAG_LABELS.aggression, RISK_FLAG_LABELS.suicide, RISK_FLAG_LABELS.vulnerable].join(", ");
      expect(words).toBe("Aggression, Suicide or self-harm, Vulnerable adult");
      expect(flags.querySelector("dd")?.textContent).toBe(words);
    } finally {
      live.collectionRiskFlags = saved;
    }
  });

  it("shows no risk flags row on a job with none recorded", () => {
    const [, job] = officerJobs();
    expect(job.collectionRiskFlags).toBeUndefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OfficerScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-officer-select-${job.id}`));
    const panel = screen.getByTestId("ward-officer-detail");
    expect(within(panel).queryByTestId(`ward-officer-risk-flags-${job.id}`)).not.toBeInTheDocument();
    expect(within(panel).queryByText("Risk flags")).not.toBeInTheDocument();
  });
});
