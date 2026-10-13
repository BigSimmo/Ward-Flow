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
});
