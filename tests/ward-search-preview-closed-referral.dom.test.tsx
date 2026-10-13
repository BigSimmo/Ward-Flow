import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { isOpen } from "@/components/ward-management/ward-derivations";
import { referralState } from "@/components/ward-management/ward-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { RecordPreview } from "@/components/ward-management/search/record-preview";

const seed = seedWardFlowState();
const declined = seed.referrals.find((r) => r.patientId !== undefined && referralState(r) === "declined");
const patient = seed.patients.find((p) => p.id === declined?.patientId);
const openMovement = seed.movements.find(isOpen);

afterEach(cleanup);

describe("a declined referral with nothing open reads as Past, like the search row", () => {
  it("has a declined, linked referral fixture to check", () => {
    expect(declined).toBeDefined();
    expect(patient).toBeDefined();
    expect(openMovement).toBeDefined();
  });

  it("shows the person as not on the board, without inventing an ED origin", () => {
    render(
      <RecordPreview
        selection={{ kind: "person", patient: patient! }}
        referrals={[declined!]}
        movements={[]}
        patients={[patient!]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Not on this board now")).toBeInTheDocument();
    expect(screen.getByText("Referral declined")).toBeInTheDocument();
    expect(screen.queryByText(`${declined!.originSiteCode} ED`)).not.toBeInTheDocument();
  });

  it("does not mark the person Past while another movement for them is open", () => {
    render(
      <RecordPreview
        selection={{ kind: "person", patient: patient! }}
        referrals={[declined!]}
        movements={[{ ...openMovement!, patientId: patient!.id }]}
        patients={[patient!]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText("Not on this board now")).not.toBeInTheDocument();
  });

  it("shows the declined state when the referral itself is selected", () => {
    render(
      <RecordPreview
        selection={{ kind: "referral", referral: declined! }}
        referrals={[declined!]}
        movements={[]}
        patients={[patient!]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("REFERRAL DECLINED · NO DESTINATION ACCEPTED")).toBeInTheDocument();
    expect(screen.queryByText("QUEUED REFERRAL · AWAITING ACCEPTANCE")).not.toBeInTheDocument();
  });

  it("does not mark the person Past while a newer referral for them is still queued", () => {
    const queuedSeed = seed.referrals.find((r) => referralState(r) === "queued");
    expect(queuedSeed).toBeDefined();
    const queued = { ...queuedSeed!, patientId: patient!.id };
    render(
      <RecordPreview
        selection={{ kind: "person", patient: patient! }}
        referrals={[declined!, queued]}
        movements={[]}
        patients={[patient!]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText("Not on this board now")).not.toBeInTheDocument();
  });

  it("does not mark the person Past while their accepted referral holds a ward bed", () => {
    const admission = seed.admissions.find((entry) => entry.referralId !== null && entry.state === "occupied");
    const accepted = seed.referrals.find((r) => r.id === admission?.referralId && referralState(r) === "accepted");
    expect(accepted).toBeDefined();
    render(
      <RecordPreview
        selection={{ kind: "person", patient: patient! }}
        referrals={[{ ...accepted!, patientId: patient!.id }]}
        movements={[]}
        admissions={[admission!]}
        patients={[patient!]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText("Not on this board now")).not.toBeInTheDocument();
  });

  it("marks the person Past when an accepted referral's movement closed without a bed", () => {
    const closed = {
      ...openMovement!,
      closure: { at: NOW_ANCHOR, outcome: "did_not_proceed", reason: "Synthetic: did not proceed" },
    } as typeof openMovement & {};
    const accepted = seed.referrals.find((r) => referralState(r) === "accepted");
    expect(isOpen(closed)).toBe(false);
    expect(accepted).toBeDefined();
    render(
      <RecordPreview
        selection={{ kind: "person", patient: patient! }}
        referrals={[{ ...accepted!, patientId: patient!.id }]}
        movements={[{ ...closed, referralId: accepted!.id, patientId: patient!.id }]}
        admissions={[]}
        patients={[patient!]}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Not on this board now")).toBeInTheDocument();
  });
});
