import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/WF-005",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-demo-storage-constants";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * F-66 (RC 5.4, approved by Josh 13 Nov 2026): after a reload the demo shows a typed CAD number as
 * "Typed text not kept on this device". The arrival form offered that placeholder as the CAD number
 * and would have saved it back as one. It is now treated as not known. Synthetic data only.
 */
afterEach(() => cleanup());

function Modal({ patch }: { patch: (movement: Movement) => Movement }) {
  const movement = useWardFlow().movements.find((row) => row.id === "WF-005")!;
  return <ArrivalTimeModal isOpen onClose={() => undefined} movement={patch(movement)} />;
}

function trackingBox(): HTMLInputElement {
  return screen.getByLabelText(/CAD or tracking number/) as HTMLInputElement;
}

describe("F-66: the not-kept placeholder is never a CAD number", () => {
  it("does not offer a booking's placeholder as the number", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Modal
          patch={(movement) => ({
            ...movement,
            arrivalDetails: undefined,
            transport: { ...movement.transport!, cancelledAt: undefined, cadNumber: TYPED_TEXT_NOT_KEPT },
          })}
        />
      </WardFlowProvider>,
    );
    expect(trackingBox().value).toBe("");
    // The travel mode may still come from the booking; only the number's own source line must not show.
    expect(trackingBox()).not.toHaveAttribute("aria-describedby");
  });

  it("does not offer a recorded placeholder either, but still offers a real booked number", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Modal
          patch={(movement) => ({
            ...movement,
            arrivalDetails: {
              ...movement.arrivalDetails,
              trackingNumber: TYPED_TEXT_NOT_KEPT,
            } as Movement["arrivalDetails"],
            transport: { ...movement.transport!, cancelledAt: undefined, cadNumber: "CAD-2026-0001" },
          })}
        />
      </WardFlowProvider>,
    );
    expect(trackingBox().value).toBe("CAD-2026-0001");
  });
});
