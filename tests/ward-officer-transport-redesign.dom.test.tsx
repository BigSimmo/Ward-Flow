import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { installMatchMediaStub } from "./setup/jsdom.setup";
import "@testing-library/jest-dom/vitest";

import { OfficerScreen, isOfficerJob } from "@/components/ward-management/officer/officer-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The Transport desk redesign (Josh, 31 Oct 2026, "Yes to all"), built from the approved
 * `transport`, `as-officer-home` and `pop-officer-job` mock-ups. Synthetic seed data only.
 */
afterEach(() => {
  cleanup();
  installMatchMediaStub(false);
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function renderDesk(extra?: React.ReactNode) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {extra}
      <OfficerScreen />
    </WardFlowProvider>,
  );
}

function asOfficerDesk() {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "officer", scope: { kind: "jobs" } });
  });
}

const state = seedWardFlowState();
const jobs = state.movements.filter(isOfficerJob);

describe("Transport desk redesign", () => {
  it.each([false, true])("names people surname first (phone=%s)", (phone) => {
    installMatchMediaStub(phone);
    renderDesk();
    const job = jobs.find((movement) => resolveSubjectPatient(movement, state).patient)!;
    const info = resolveSubjectPatient(job, state);
    expect(screen.getByTestId(`ward-officer-patient-${job.id}`)).toHaveTextContent(info.formalName);
    // Names wrap in full: never cut to an ellipsis.
    expect(screen.getByTestId(`ward-officer-patient-${job.id}`).textContent).not.toContain("…");
  });

  it("puts the open-job count beside the title, not in it", () => {
    renderDesk();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Transport");
    expect(screen.getByText(`${jobs.length} jobs open`)).toBeInTheDocument();
    expect(screen.queryByText("Transport dispatch")).toBeNull();
  });

  it("reads routes from first, then the ward, with 'to' spoken", () => {
    renderDesk();
    const job = jobs[0]!;
    const row = screen.getByTestId(`ward-officer-job-${job.id}`);
    const route = row.querySelectorAll("td")[1]!;
    // "PEEL → Maali (Ward 4.2)": the arrow is hidden from screen readers, which hear "to".
    expect(route.textContent).toMatch(/^\S+ → +to \S/);
    expect(route.textContent).not.toMatch(/ from /);
  });

  it("says one thing in the Forms cell: 'N forms missing' or 'All forms'", () => {
    renderDesk();
    const list = screen.getByTestId("ward-officer-joblist");
    const text = list.textContent ?? "";
    expect(text).toMatch(/\d forms? missing|All forms/);
    expect(text).not.toMatch(/\d of 3(?! forms recorded)/);
  });

  it("names the legal status in the job panel header and keeps 'Legal status not recorded' visible", () => {
    renderDesk();
    const unrecorded = jobs.find((movement) => movement.transport?.transportLegalStatus === undefined);
    if (!unrecorded) throw new Error("the seed has no job with the transport's legal status unrecorded");
    fireEvent.click(screen.getByTestId(`ward-officer-select-${unrecorded.id}`));
    const panel = screen.getByTestId("ward-officer-detail");
    expect(within(panel).getAllByText(/Legal status not recorded/).length).toBeGreaterThan(0);
    expect(within(panel).getByTestId(`ward-officer-not-recorded-${unrecorded.id}`)).toHaveTextContent(
      /^Not recorded: the transport's legal status/,
    );
    // The forms count is said once, beside its heading.
    expect(within(panel).queryByText(/of 3 uploaded/)).toBeNull();
  });

  it.each([false, true])("shows cancelled transport at every width (phone=%s)", (phone) => {
    installMatchMediaStub(phone);
    function Withdraw() {
      const { dispatch, now } = useWardFlow();
      return (
        <button
          type="button"
          data-testid="withdraw-booked-referral"
          // WF-005 is seeded with transport accepted, so withdrawing it sends the officer a notice.
          onClick={() => dispatch({ type: "WITHDRAW_REFERRAL", role: "coordinator", now, movementId: "WF-005" })}
        >
          withdraw
        </button>
      );
    }
    renderDesk(<Withdraw />);
    expect(screen.queryByTestId("officer-cancellation-notices")).toBeNull();
    fireEvent.click(screen.getByTestId("withdraw-booked-referral"));
    const card = screen.getByTestId("officer-cancellation-notices");
    expect(within(card).getByRole("heading", { name: "Cancelled transport" })).toBeInTheDocument();
    expect(within(card).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("lists every job and the Providers row on the coordinator's view", () => {
    renderDesk();
    expect(screen.getByTestId("ward-officer-joblist").querySelectorAll("tr")).toHaveLength(jobs.length);
    expect(screen.queryByRole("button", { name: /^Show all \d+ jobs$/ })).toBeNull();
    expect(screen.getByText("Choose a patient to open their job")).toBeInTheDocument();
  });
});

describe("Transport desk, the transport officer's own view (as-officer-home)", () => {
  it("opens on the first 8 jobs, then Show all", () => {
    asOfficerDesk();
    renderDesk();
    expect(jobs.length).toBeGreaterThan(8);
    expect(screen.getByText("Jobs · Transport desk")).toBeInTheDocument();
    const list = screen.getByTestId("ward-officer-joblist");
    expect(list.querySelectorAll("tr")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: `Show all ${jobs.length} jobs` }));
    expect(screen.getByTestId("ward-officer-joblist").querySelectorAll("tr")).toHaveLength(jobs.length);
    expect(screen.queryByText("Choose a patient to open their job")).toBeNull();
  });

  it("shows every job while a highlight is on, so nothing lit is hidden", () => {
    asOfficerDesk();
    renderDesk();
    fireEvent.change(screen.getByRole("textbox", { name: "Highlight transport jobs" }), { target: { value: "WF" } });
    expect(screen.getByTestId("ward-officer-joblist").querySelectorAll("tr")).toHaveLength(jobs.length);
  });

  it("moves Copy handover under the list on a phone", () => {
    installMatchMediaStub(true);
    asOfficerDesk();
    renderDesk();
    const copies = screen.getAllByRole("button", { name: "Copy handover" });
    expect(copies).toHaveLength(1);
    expect(copies[0]!.closest("header, [data-wf-hero]")).toBeNull();
  });
});
