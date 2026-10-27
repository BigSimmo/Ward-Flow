import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MovementDrawer } from "@/components/ward-management/movements/movement-drawer";
import { ED_ACCESS_TARGET_MINUTES, type LegalStatus, type Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => null }));

function renderDrawer(movement: Movement, phone: boolean) {
  installMatchMediaStub(phone);
  render(
    <MovementDrawer
      movement={movement}
      now={NOW_ANCHOR}
      units={[]}
      referrals={[]}
      patients={[]}
      edAccessTargetMinutes={ED_ACCESS_TARGET_MINUTES}
      legalUrgentMinutes={60}
      dispatch={() => {}}
      onClose={() => {}}
    />,
  );
}

const statuses: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

describe.each([false, true])("movement legal absence (phone=%s)", (phone) => {
  it.each(statuses)("keeps %s and explicitly states the missing form", (legalStatus) => {
    const movement = { ...wardMovements[0], legalStatus, legalForm: undefined };
    renderDrawer(movement, phone);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(`${legalStatus} · No legal form recorded`);
    expect(dialog.querySelector(".lucide-shield-check")).toBeNull();
  });

  it("keeps a recorded form's title and typed expiry", () => {
    const movement: Movement = {
      ...wardMovements[0],
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "3B", kind: "detention", dueAt: NOW_ANCHOR - 30 },
    };
    renderDrawer(movement, phone);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(legalFormName(movement.legalForm!));
    expect(dialog).toHaveTextContent("recorded expiry passed 30m ago");
    expect(dialog).not.toHaveTextContent("No legal form recorded");
  });
});
