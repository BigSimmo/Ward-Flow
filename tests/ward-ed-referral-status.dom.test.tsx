import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { edReferralStatus, edStageLabel } from "@/components/ward-management/ed/ed-referral-status";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Change 2 of the bigger UX changes (D-77, Josh 21 Oct 2026): the ED sees where its referral stands.
 * The board's Referral column, each phone row's second line and the row sheet's "Where the referral
 * is" read one status, and a pulled bed reads "Bed held" to the ED.
 */

const seeded = seedWardFlowState().movements;
const movement = (stage: Movement["stage"], extra: Partial<Movement> = {}): Movement => ({
  ...seeded.find((candidate) => candidate.originEdId !== undefined)!,
  stage,
  closure: undefined,
  edOutcome: undefined,
  declines: [],
  acceptedUnitId: undefined,
  pullExpiresAt: undefined,
  transport: undefined,
  transportNeed: undefined,
  referredUnitIds: [],
  ...extra,
});
const options = {
  acceptedUnitName: undefined as string | undefined,
  fallback: "In department",
  referredTo: undefined as string | undefined,
  holdLabel: "4h",
  now: 1_000,
};

describe("edReferralStatus", () => {
  it("says a referral still being placed is sent, with the coordinator finding a ward", () => {
    const status = edReferralStatus(movement("placement_requested"), options);
    expect([status.title, status.line, status.phone]).toEqual([
      "Referral sent",
      "Coordinator finding a ward",
      "Coordinator finding a ward",
    ]);
    expect(status.steps?.map((step) => step.done)).toEqual([true, false, false, false]);
  });

  it("counts each declining ward once while the coordinator reviews", () => {
    const declines = [
      { unitId: "a", at: 1, reason: "no_bed" },
      { unitId: "a", at: 2, reason: "no_bed" },
      { unitId: "b", at: 3, reason: "no_bed" },
    ] as Movement["declines"];
    const status = edReferralStatus(movement("destination_review", { declines }), options);
    expect([status.title, status.line, status.tone]).toEqual(["Declined by 2 wards", "Coordinator reviewing", "warn"]);
  });

  it("keeps a referral wards are still answering as being placed, not with the coordinator", () => {
    const declines = [{ unitId: "a", at: 1, reason: "no_bed" }] as Movement["declines"];
    const status = edReferralStatus(movement("destination_review", { declines, referredUnitIds: ["b"] }), options);
    expect([status.title, status.line, status.tone]).toEqual(["Referral sent", "Coordinator finding a ward", "quiet"]);
  });

  it("ticks transport once it is booked, before handover", () => {
    const transport = seeded.find((candidate) => candidate.transport !== undefined)?.transport;
    expect(transport).toBeDefined();
    const status = edReferralStatus(movement("pulled", { pullExpiresAt: 1_027, transport }), {
      ...options,
      acceptedUnitName: "SJGM Adult Open",
    });
    expect(status.steps?.[3]).toEqual({ label: "Transport", detail: "Booked", done: true });
  });

  it("names the ward and the time left on a held bed", () => {
    const status = edReferralStatus(movement("pulled", { pullExpiresAt: 1_027 }), {
      ...options,
      acceptedUnitName: "SJGM Adult Open",
    });
    expect([status.title, status.line, status.phone, status.tone]).toEqual([
      "SJGM Adult Open",
      "Accepted, bed held 27m left",
      "SJGM Adult Open accepted, bed held",
      "good",
    ]);
    expect(status.steps).toEqual([
      { label: "Referral sent", detail: "Coordinator asked wards", done: true },
      { label: "SJGM Adult Open accepted", detail: "Accepted in principle", done: true },
      { label: "Bed held for this patient", detail: "27m left", done: true },
      { label: "Transport", detail: "Not booked yet", done: false },
    ]);
  });

  it("marks a lapsed hold as danger and says it expired", () => {
    const status = edReferralStatus(movement("pulled", { pullExpiresAt: 990 }), {
      ...options,
      acceptedUnitName: "SJGM Adult Open",
    });
    expect(status.line).toBe("Accepted, bed held, expired 10m ago");
    expect(status.phone).toBe("SJGM Adult Open accepted, bed held, expired 10m ago");
    expect(status.tone).toBe("danger");
  });

  it("keeps the row's own words once the record is decided or withdrawn", () => {
    const status = edReferralStatus(movement("placement_requested", { edOutcome: "for_discharge" }), {
      ...options,
      fallback: "For discharge",
    });
    expect(status).toEqual({ title: "For discharge", tone: "quiet", phone: "For discharge" });
  });

  it("calls a pulled bed Bed held for the ED only", () => {
    expect(edStageLabel("pulled")).toBe("Bed held");
    expect(edStageLabel("accepted_awaiting_bed")).toBe("Accepted, awaiting bed");
  });
});

const original = typeof window !== "undefined" ? window.matchMedia : undefined;
let phone = true;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === "(max-width: 48rem)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  phone = true;
  if (original) window.matchMedia = original;
});

function renderPeel() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId="peel-ed" />
    </WardFlowProvider>,
  );
}

describe("the ED board shows where each referral stands", () => {
  it("heads the board column Referral and puts the held bed in it", () => {
    phone = false;
    renderPeel();
    const table = screen.getByRole("table", { name: /Emergency department board/ });
    expect(within(table).getByRole("columnheader", { name: "Referral" })).toBeTruthy();
    expect(within(table).queryByRole("columnheader", { name: "Destination" })).toBeNull();
    expect(screen.getByTestId("ward-ed-referral-WF-016")).toHaveTextContent(/SJGM Adult Open.*Accepted, bed held/);
    expect(screen.getByTestId("ward-ed-referral-WF-020")).toHaveTextContent("Referral sent");
  });

  it("says it on the phone row and lists the steps in the row sheet", () => {
    renderPeel();
    const row = screen.getByTestId("ward-ed-patient-WF-016");
    expect(row).toHaveTextContent("SJGM Adult Open accepted, bed held");
    fireEvent.click(within(row).getByRole("button"));

    const sheet = screen.getByTestId("ward-ed-phone-sheet-WF-016");
    const steps = within(sheet).getByTestId("ward-ed-referral-steps-WF-016");
    expect(
      within(steps)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringMatching(/^Referral sent, done/),
      expect.stringMatching(/^SJGM Adult Open accepted, done/),
      expect.stringMatching(/^Bed held for this patient, done/),
      expect.stringMatching(/Transport, not yet/),
    ]);
    expect(within(sheet).getAllByText("Bed held").length).toBeGreaterThan(0);
    expect(sheet.textContent ?? "").not.toMatch(/Bed pulled/);
    expect(sheet).toHaveTextContent("Bed held — ready to mark the handover to transport.");
    expect(within(sheet).queryByText("Destination")).toBeNull();
  });
});
