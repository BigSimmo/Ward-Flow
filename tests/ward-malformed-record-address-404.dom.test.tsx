// A1K-05 and H-0195 (Josh, 27 Oct 2026): a malformed person or movement address is a real 404,
// and the segment's not-found page keeps the tailored wording without quoting the address.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow/movements/x",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import MovementAddressNotFound from "@/app/ward-flow/movements/[movementId]/not-found";
import WardMovementPage from "@/app/ward-flow/movements/[movementId]/page";
import PatientAddressNotFound from "@/app/ward-flow/people/[patientId]/not-found";

const NOT_FOUND = /NEXT_HTTP_ERROR_FALLBACK;404/u;
const openMovement = (movementId: string) => WardMovementPage({ params: Promise.resolve({ movementId }) });

describe("malformed record addresses", () => {
  it("returns a real 404 for a malformed movement address", async () => {
    await expect(openMovement("nope")).rejects.toThrow(NOT_FOUND);
    await expect(openMovement("WF-%E0%A4%A")).rejects.toThrow(NOT_FOUND);
  });

  it("still links a patient id given as a movement on to the patient", async () => {
    const page = await openMovement("PT-004");
    expect(page.props).toMatchObject({ reason: "not-a-movement-id" });
  });

  it("keeps the tailored wording on both not-found pages", () => {
    const { unmount } = render(<MovementAddressNotFound />);
    expect(screen.getByRole("main")).toHaveTextContent("No movement matches this link");
    unmount();
    render(<PatientAddressNotFound />);
    expect(screen.getByRole("main")).toHaveTextContent("No patient matches this link");
  });
});
