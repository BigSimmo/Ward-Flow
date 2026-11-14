// Desks-R2-1 (master stress test, 14 Nov 2026), synthetic seed only. AK-A-03: the site bed manager
// confirms beds. The answer page's Confirm sent the command as the ward, which the signed-in server
// refuses for a bed manager ("not part of your role"); it now goes under the desk's own role.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const UNIT = unitById("rph-adult-secure")!;

function ConfirmedByProbe() {
  const { units, rejections } = useWardFlow();
  const unit = units.find((candidate) => candidate.id === UNIT.id);
  return (
    <>
      <output data-testid="confirmed-by">{unit?.allocatable.confirmedBy ?? "none"}</output>
      <output data-testid="rejections">{rejections.map((entry) => entry.reason).join(" / ")}</output>
    </>
  );
}

afterEach(() => {
  cleanup();
  setDeskRole("coordinator");
});

describe("the site bed manager confirms beds from the answer page as itself (AK-A-03)", () => {
  it("records the confirmation under the bed manager's role", () => {
    setDeskRole("bed_manager");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={UNIT.id} presentation="answer" />
        <ConfirmedByProbe />
      </WardFlowProvider>,
    );
    const capacityPanel = screen.getByRole("region", { name: "Confirm your beds" });
    fireEvent.click(within(capacityPanel).getByTestId("ward-capacity-submit"));
    expect(screen.getByTestId("rejections").textContent).toBe("");
    expect(screen.getByTestId("confirmed-by").textContent).toBe("bed_manager");
  });
});
