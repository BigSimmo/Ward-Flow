import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The desk the form is opened on. Undefined is the coordinator's statewide desk.
const desk = vi.hoisted(() => ({ edId: undefined as string | undefined }));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () =>
    desk.edId
      ? { role: "ed", scope: { kind: "ed", edId: desk.edId } }
      : { role: "coordinator", scope: { kind: "statewide" } },
}));

import { discardReferralDraft, draftFingerprint } from "@/components/ward-management/referrals/referral-draft-store";
import {
  catchmentFromRecord,
  documentationFromBoard,
  initialReferrerContact,
  openEdJourneyFor,
  recordedHomeRegion,
} from "@/components/ward-management/referrals/referral-record-prefill";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { profileForChromeRole } from "@/components/ward-management/settings/settings-profile";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { allEmergencyDepartments, edById, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Workflow speed audit, 26 Oct 2026: the referral form fills what the record already holds.
 * WS-06 clearance (H-0971), WS-07 contact (H-0972), WS-08 open journey (H-0973), WS-11 region and
 * catchment (H-0976), and H-0364's smaller draft compare.
 */
afterEach(() => {
  cleanup();
  discardReferralDraft();
  desk.edId = undefined;
});

/** A seeded person with exactly one open ED journey. */
function personOnOneJourney() {
  const state = seedWardFlowState();
  for (const movement of state.movements) {
    if (movement.closure || movement.stage === "arrived" || !edById(movement.originEdId)) continue;
    const patient = resolveSubjectPatient(movement, state).patient;
    if (!patient) continue;
    const open = state.movements.filter(
      (other) =>
        !other.closure && other.stage !== "arrived" && resolveSubjectPatient(other, state).patient?.id === patient.id,
    );
    if (open.length === 1) return { state, movement, patient };
  }
  throw new Error("the seed has no person on exactly one open ED journey");
}

function renderWith(change: (movement: Movement) => Movement, patientId: string) {
  function World({ children }: { children: ReactNode }) {
    const value = useWardFlow();
    return <WardFlowOverride value={{ ...value, movements: value.movements.map(change) }}>{children}</WardFlowOverride>;
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <World>
        <WardReferralDrawer
          onClose={vi.fn()}
          initialCategory="ed"
          initialDestination="ward"
          initialPatientId={patientId}
        />
      </World>
    </WardFlowProvider>,
  );
}

describe("the record's facts, read without guessing", () => {
  it("carries clearance from the board: cleared is yes, not cleared is no, nothing is blank (H-0971)", () => {
    expect(documentationFromBoard({ medicalClearance: { cleared: true, at: 0 } }).medical).toBe("yes");
    expect(documentationFromBoard({ medicalClearance: { cleared: false, at: 0 } }).medical).toBe("no");
    expect(documentationFromBoard({}).medical).toBe("");
    expect(documentationFromBoard(undefined).medical).toBe("");
  });

  it("fills the referrer from the draft, then the last sent, then the desk profile (H-0972)", () => {
    const ed = profileForChromeRole("ed");
    expect(ed.status).toBe("available");
    const sent = { name: "Sent", email: "s@example.org", phone: "1", role: "r", location: "l" };
    const kept = { ...sent, name: "Kept" };
    expect(initialReferrerContact(kept, sent, ed).name).toBe("Kept");
    expect(initialReferrerContact(undefined, sent, ed).name).toBe("Sent");
    expect(initialReferrerContact(undefined, null, ed).name).toBe(ed.status === "available" ? ed.profile.name : "");
    expect(initialReferrerContact(undefined, null, profileForChromeRole("ward")).name).toBe("");
  });

  it("finds the person's open ED journey and their recorded home region (H-0973, H-0976)", () => {
    const { state, movement, patient } = personOnOneJourney();
    const found = openEdJourneyFor(patient.id, state);
    expect(found?.movementId).toBe(movement.id);
    expect(found?.siteCode).toBe(edById(movement.originEdId)?.siteCode);
    expect(openEdJourneyFor(undefined, state)).toBeUndefined();
    const withRegion = state.movements.map((m) =>
      m.id === movement.id ? { ...m, homeRegion: "Perth Metropolitan" as const } : m,
    );
    expect(recordedHomeRegion(patient.id, undefined, { ...state, movements: withRegion })).toBe("Perth Metropolitan");
    expect(recordedHomeRegion(patient.id, { homeRegion: "Wheatbelt" }, state)).toBe("Wheatbelt");
  });

  it("treats the catchment as confirmed only when the record names the same team and a region is known", () => {
    expect(catchmentFromRecord({ catchmentCommunityTeam: "Team A" }, "Team A", "Perth Metropolitan")).toBe(true);
    expect(catchmentFromRecord({ catchmentCommunityTeam: "Team A" }, "Team B", "Perth Metropolitan")).toBe(false);
    expect(catchmentFromRecord({ catchmentCommunityTeam: "Team A" }, "Team A", "")).toBe(false);
    expect(catchmentFromRecord({}, "Team A", "Perth Metropolitan")).toBe(false);
  });

  it("compares drafts without the chart contents, but still sees a different file (H-0364)", () => {
    const chart = { kind: "medication", name: "a.pdf", mimeType: "application/pdf", sizeBytes: 3 };
    const big = "A".repeat(100_000);
    const text = draftFingerprint({ documentation: { charts: [{ ...chart, base64: big }] } });
    expect(text.length).toBeLessThan(400);
    expect(text).not.toBe(draftFingerprint({ documentation: { charts: [{ ...chart, base64: `${big}B` }] } }));
    expect(draftFingerprint({ a: 1 })).toBe(JSON.stringify({ a: 1 }));
  });
});

describe("the referral slide-out", () => {
  it("shows clearance recorded on the ED board as answered (H-0971)", () => {
    const { movement, patient } = personOnOneJourney();
    renderWith(
      (m) => (m.id === movement.id ? { ...m, medicalClearance: { cleared: true, at: m.openedAt } } : m),
      patient.id,
    );
    expect(screen.getAllByText("Fit for admission & travel").length).toBeGreaterThan(0);
  });

  it("on another ED's desk, keeps that desk's origin and shows the open journey (H-0973)", () => {
    const { movement, patient } = personOnOneJourney();
    const journeyEd = edById(movement.originEdId)!;
    const otherEd = allEmergencyDepartments().find((ed) => ed.siteCode !== journeyEd.siteCode)!;
    desk.edId = otherEd.id;
    renderWith((m) => m, patient.id);
    const notice = screen.getByTestId("ward-referral-open-journey");
    expect(notice).toHaveTextContent(`Already on an open ED journey at ${journeyEd.name}`);
    expect(notice).toHaveTextContent("starts a second journey");
    expect(screen.getByTestId("ward-referral-summary-rail")).toHaveTextContent("Already openYes");
    fireEvent.click(screen.getByRole("button", { name: `Refer from ${journeyEd.name}` }));
    expect(screen.queryByTestId("ward-referral-open-journey")).not.toBeInTheDocument();
  });

  it("on the journey's own ED, raises no notice", () => {
    const { movement, patient } = personOnOneJourney();
    desk.edId = edById(movement.originEdId)!.id;
    renderWith((m) => m, patient.id);
    expect(screen.queryByTestId("ward-referral-open-journey")).not.toBeInTheDocument();
  });
});
