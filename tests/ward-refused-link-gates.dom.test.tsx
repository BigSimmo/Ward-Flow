// INV-CM (demo-screen sweep, 14 Nov 2026): a control never leads to "Not part of your role". A Home
// alert's own step ("Open forms") opens the patient when the desk cannot open the Legal forms page
// (the site bed manager), and is left out when the desk can open neither.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { QueueEntry } from "@/components/ward-management/alerts/alerts-queue";

const desk: { canOpen: (href: string) => boolean } = { canOpen: () => true };

vi.mock("@/components/ward-management/shell/ward-access", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access")>()),
  useCanOpenHref: () => desk.canOpen,
}));

const { MyListCard } = await import("@/components/ward-management/coordinator/my-list-card");
const { WardFlowProvider } = await import("@/components/ward-management/ward-flow-provider");
const { NOW_ANCHOR } = await import("@/components/ward-management/ward-sites");

const FORMS = "/bedchart/legal-forms";
const PATIENT = "/bedchart/patients/synthetic-person";

const entry = {
  item: { id: "synthetic-legal-alert", title: "Form time passed", detail: "", tone: "danger" },
  movement: undefined,
  subject: { displayName: "Synthetic, Person", umrn: "ZZ000001", from: "Synthetic ED", patientHref: PATIENT },
  group: "act",
  owner: "Bed coordinator",
  mine: true,
  raised: undefined,
  seen: undefined,
  ownedSince: undefined,
  snooze: undefined,
  action: { kind: "link", label: "Open forms", href: FORMS },
  highlighted: false,
} as unknown as QueueEntry;

function renderCard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MyListCard
        act={[entry]}
        referrals={[]}
        units={[]}
        now={NOW_ANCHOR}
        phone={false}
        handlers={{ selectedId: undefined, onSelect: () => {}, onRelease: () => {}, onReturn: () => {} }}
        selectedReferralId={undefined}
        onSelectReferral={() => {}}
        decideHref={() => "/bedchart/referrals"}
      />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  desk.canOpen = () => true;
});

describe("a Home alert step the desk cannot open (INV-CM)", () => {
  it("offers Open forms where the desk may open Legal forms", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Open forms for Synthetic, Person" })).toHaveAttribute("href", FORMS);
  });

  it("opens the patient instead when Legal forms is not part of the desk's role", () => {
    desk.canOpen = (href) => href !== FORMS;
    renderCard();
    expect(screen.queryByRole("link", { name: /^Open forms for / })).toBeNull();
    expect(screen.getByRole("link", { name: "Patient page for Synthetic, Person" })).toHaveAttribute("href", PATIENT);
  });

  it("offers no step when the desk can open neither page", () => {
    desk.canOpen = () => false;
    renderCard();
    expect(screen.queryByRole("link", { name: /^Open (forms|patient) for / })).toBeNull();
  });
});
