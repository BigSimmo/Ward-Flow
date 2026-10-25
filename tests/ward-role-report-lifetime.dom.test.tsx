import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WardPartialViewProvider, useWardPartialView } from "@/components/ward-management/ward-partial-view";
import {
  ExecutiveStatisticsProvider,
  useExecutiveStatistics,
  type ExecutiveReportingBinding,
  type ExecutiveReportingSnapshot,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const CONTEXT_A = "a".repeat(64);
const CONTEXT_B = "b".repeat(64);

function senderResponse(accessContext = CONTEXT_A, revision = 9) {
  return {
    revision,
    accessContext,
    view: {
      version: 1,
      referrals: [
        {
          id: "RF-SYNTHETIC-REVIEW",
          kind: "sender",
          state: "queued",
          withdrawn: false,
          decidedAt: null,
          canWithdraw: true,
          informationNeeds: ["legal_form_copy"],
        },
      ],
      movements: [],
    },
  };
}

function SenderProbe() {
  const bound = useWardPartialView();
  const needsForm = bound?.view.referrals.some(
    (referral) => referral.kind === "sender" && referral.informationNeeds.includes("legal_form_copy"),
  );
  return (
    <p role="status">
      {bound ? (needsForm ? "Legal form copy requested" : "No outstanding items") : "Progress unavailable"}
    </p>
  );
}

function senderDisplay(response: unknown, revision: number | null, accessContext: string | null) {
  return (
    <WardPartialViewProvider response={response} currentRevision={revision} currentAccessContext={accessContext}>
      <SenderProbe />
    </WardPartialViewProvider>
  );
}

describe("response-only sender display lifetime", () => {
  it("removes the prior desk's information on an equal-revision access change", () => {
    const oldResponse = senderResponse();
    const { rerender } = render(senderDisplay(oldResponse, 9, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Legal form copy requested");

    // A role or grant change can leave the world revision untouched.
    rerender(senderDisplay(oldResponse, 9, CONTEXT_B));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
    expect(screen.queryByText("Legal form copy requested")).not.toBeInTheDocument();

    rerender(senderDisplay(senderResponse(CONTEXT_B), 9, CONTEXT_B));
    expect(screen.getByRole("status")).toHaveTextContent("Legal form copy requested");
  });

  it("clears on sign-out and requires a response matching the next accepted revision", () => {
    const response = senderResponse();
    const { rerender } = render(senderDisplay(response, 9, CONTEXT_A));
    rerender(senderDisplay(response, null, null));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");

    rerender(senderDisplay(response, 10, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
    rerender(senderDisplay(senderResponse(CONTEXT_A, 10), 10, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Legal form copy requested");
  });

  it("does not retain a previously valid display when the next sibling is missing or malformed", () => {
    const response = senderResponse();
    const { rerender } = render(senderDisplay(response, 9, CONTEXT_A));
    const malformed = { ...response, view: { ...response.view, destinations: ["foreign-destination"] } };
    rerender(senderDisplay(malformed, 9, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
    rerender(senderDisplay(null, 9, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
  });
});

const reportingState = seedWardFlowState();
const reportingData = projectExecutiveReportingFoundation(
  reportingState,
  { role: "executive", scope: { kind: "statewide" } },
  {
    now: NOW_ANCHOR,
    dayZero: "2026-10-24T00:00:00.000Z",
    startedAt: "2026-10-24T00:00:00.000Z",
    places: wardPlaceLookup(reportingState.units),
  },
);
const reportingBinding: ExecutiveReportingBinding = {
  actorId: "synthetic-report-actor",
  accessContext: CONTEXT_A,
  epoch: 0,
  revision: 9,
};
const reportingSnapshot: ExecutiveReportingSnapshot = {
  binding: reportingBinding,
  receivedAt: 100,
  expiresAt: 200,
  data: reportingData,
};

function ExecutiveProbe() {
  const report = useExecutiveStatistics();
  return <p role="status">{report ? `Report available: ${report.weeks.length} weeks` : "Report unavailable"}</p>;
}

function reportDisplay(
  binding: ExecutiveReportingBinding | null,
  snapshot: ExecutiveReportingSnapshot | null = reportingSnapshot,
  now = 150,
) {
  return (
    <ExecutiveStatisticsProvider binding={binding} snapshot={snapshot} now={now}>
      <ExecutiveProbe />
    </ExecutiveStatisticsProvider>
  );
}

describe("response-only executive report lifetime", () => {
  it.each([
    { ...reportingBinding, actorId: "another-synthetic-actor" },
    { ...reportingBinding, accessContext: CONTEXT_B },
    { ...reportingBinding, epoch: 1 },
    { ...reportingBinding, revision: 10 },
  ])("removes a prior report immediately when a current identity component changes: %j", (binding) => {
    const { rerender } = render(reportDisplay(reportingBinding));
    expect(screen.getByRole("status")).toHaveTextContent("Report available: 9 weeks");
    rerender(reportDisplay(binding));
    expect(screen.getByRole("status")).toHaveTextContent("Report unavailable");
    rerender(reportDisplay(binding, { ...reportingSnapshot, binding }));
    expect(screen.getByRole("status")).toHaveTextContent("Report available: 9 weeks");
  });

  it("clears on sign-out or missing data instead of retaining a previous report", () => {
    const { rerender } = render(reportDisplay(reportingBinding));
    rerender(reportDisplay(null));
    expect(screen.getByRole("status")).toHaveTextContent("Report unavailable");
    rerender(reportDisplay(reportingBinding));
    expect(screen.getByRole("status")).toHaveTextContent("Report available: 9 weeks");
    rerender(reportDisplay(reportingBinding, null));
    expect(screen.getByRole("status")).toHaveTextContent("Report unavailable");
  });

  it.each([99, 200, Infinity, NaN])("removes the report outside its actual finite lifetime: %s", (now) => {
    const { rerender } = render(reportDisplay(reportingBinding));
    rerender(reportDisplay(reportingBinding, reportingSnapshot, now));
    expect(screen.getByRole("status")).toHaveTextContent("Report unavailable");
  });

  it("preserves a deliberately held report revision while current access and lifetime remain valid", () => {
    const { rerender } = render(reportDisplay(reportingBinding));
    rerender(reportDisplay({ ...reportingBinding }, reportingSnapshot, 199));
    expect(screen.getByRole("status")).toHaveTextContent("Report available: 9 weeks");
  });
});
