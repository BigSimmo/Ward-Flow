import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyNotesButton } from "@/components/ward-management/referrals/copy-notes-button";
import {
  movementTransferNotesText,
  referralAcceptanceNotesText,
} from "@/components/ward-management/referrals/referral-notes-text";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/ward-clipboard";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { edById, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Item 27 (10 Nov 2026): Copy to notes for an acceptance and a transfer. Plain recorded facts only:
 * no typed free text, no risk detail. Every marker below is synthetic text planted in a typed field.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TYPED = ["TYPED-REASON-xyz", "TYPED-HISTORY-xyz", "TYPED-BLOCKER-xyz", "TYPED-TRACKING-xyz", "TYPED-MODE-xyz"];
const RISK = ["Aggression", "Absconding", "Self-harm"];
const now = NOW_ANCHOR;

function acceptedSeedReferral(): Referral {
  const state = seedWardFlowState();
  const referral = state.referrals.find(
    (candidate) => acceptedAddressing(candidate)?.destination.kind === "psychiatric_ward",
  );
  if (!referral) throw new Error("the seed has no accepted ward referral");
  return {
    ...referral,
    intake: {
      ...referral.intake,
      reasonForReferral: TYPED[0],
      history: TYPED[1],
      riskFlags: RISK,
    } as Referral["intake"],
  };
}

function acceptedSeedMovement(): Movement {
  const movement = seedWardFlowState().movements.find((candidate) => candidate.acceptedUnitId && !candidate.closure);
  if (!movement) throw new Error("the seed has no accepted open movement");
  return {
    ...movement,
    blocker: TYPED[2],
    heldBedNumber: 4,
    arrivalDetails: {
      mode: "ambulance",
      modeOfArrival: TYPED[4],
      trackingNumber: TYPED[3],
      estimatedArrivalAt: now + 45,
      recordedAt: now,
      recordedBy: "coordinator",
    },
  } as Movement;
}

function expectNoTypedText(text: string) {
  for (const marker of [...TYPED, ...RISK]) expect(text).not.toContain(marker);
  expect(text).not.toMatch(/\bUM\d{6}\b/u);
}

describe("acceptance notes", () => {
  it("holds the recorded acceptance and nothing typed", () => {
    const state = seedWardFlowState();
    const referral = acceptedSeedReferral();
    const accepted = acceptedAddressing(referral)!;
    const ward = state.units.find(
      (unit) => unit.id === (accepted.acceptedUnitId ?? (accepted.destination as { unitId?: string }).unitId),
    );
    const text = referralAcceptanceNotesText(referral, { patientName: "Synthetic, Person", units: state.units, now })!;
    expect(text.split("\n")).toEqual([
      SYNTHETIC_COPY_LINE,
      "Ward Flow acceptance: Synthetic, Person.",
      `Referral ${referral.id} accepted by ${ward!.name}, ${formatInstantWithDay(accepted.decidedAt!, now)}.`,
      accepted.heldBedNumber === undefined ? "Bed: no bed held yet." : `Bed: bed ${accepted.heldBedNumber} held.`,
      `Urgency: Tier ${referral.urgency}.`,
    ]);
    expectNoTypedText(text);
  });

  it("has nothing to copy for a referral no ward accepted", () => {
    const state = seedWardFlowState();
    const queued = state.referrals.find((referral) => acceptedAddressing(referral) === undefined)!;
    expect(referralAcceptanceNotesText(queued, { patientName: "Synthetic, Person", units: state.units, now })).toBe(
      undefined,
    );
  });
});

describe("transfer notes", () => {
  it("holds the recorded transfer and nothing typed", () => {
    const state = seedWardFlowState();
    const movement = acceptedSeedMovement();
    const ward = state.units.find((unit) => unit.id === movement.acceptedUnitId)!;
    const text = movementTransferNotesText(movement, { patientName: "Synthetic, Person", units: state.units, now })!;
    const lines = text.split("\n");
    expect(lines[0]).toBe(SYNTHETIC_COPY_LINE);
    expect(lines[1]).toBe("Ward Flow transfer: Synthetic, Person.");
    expect(lines[2]).toBe(`From ${edById(movement.originEdId)!.name} to ${ward.name}.`);
    expect(lines).toContain("Bed: bed 4 held.");
    expect(lines).toContain(`Transport: Ambulance (St John), expected ${formatInstantWithDay(now + 45, now)}.`);
    expect(lines).toContain(`Legal status: ${movement.legalStatus}.`);
    expectNoTypedText(text);
  });

  it("has nothing to copy before a ward accepts", () => {
    const movement = { ...acceptedSeedMovement(), acceptedUnitId: undefined };
    expect(movementTransferNotesText(movement, { patientName: "X", units: [], now })).toBe(undefined);
  });
});

describe("Copy to notes button", () => {
  it("puts the template on the clipboard as built, with the synthetic line first", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const state = seedWardFlowState();
    const text = movementTransferNotesText(acceptedSeedMovement(), {
      patientName: "Synthetic, Person",
      units: state.units,
      now,
    })!;
    render(<CopyNotesButton text={() => text} testId="copy" />);
    fireEvent.click(screen.getByTestId("copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toBe(text);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});
