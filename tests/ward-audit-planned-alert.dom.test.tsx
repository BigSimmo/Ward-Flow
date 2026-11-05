import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AlertDetail } from "@/components/ward-management/alerts/alert-detail";
import { alertActionFor, resolveAlertSubject } from "@/components/ward-management/alerts/alerts-model";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/alerts", useRouter: () => ({ push: vi.fn() }) }));
afterEach(() =>
  act(() => {
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
  }),
);
it("gives the receiving ward an explicit coordinator handover instead of inaccessible Capacity", () => {
  const seed = seedWardFlowState();
  const item = buildActionInbox([], NOW_ANCHOR, seed.units, { plannedAdmissions: seed.plannedAdmissions }).find(
    (i) => i.plannedAdmission,
  )!;
  const booking = item.plannedAdmission!;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [booking.unitId] } });
  });
  const subject = resolveAlertSubject(undefined, undefined, seed, seed.units, { planned: booking });
  render(
    <AlertDetail
      item={item}
      subject={subject}
      movement={undefined}
      units={seed.units}
      now={NOW_ANCHOR}
      mine={false}
      acknowledgements={undefined}
      ownership={undefined}
      snoozeEntries={undefined}
      snoozedUntil={undefined}
      configuration={seed.configuration}
      handlers={{ onTake: vi.fn(), onAcknowledge: vi.fn(), onSnooze: vi.fn(), onReturn: vi.fn(), onRelease: vi.fn() }}
    />,
  );
  expect(screen.queryByRole("link", { name: /Open bookings/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Ask the coordinator to review this booking/)).toBeVisible();
  expect(alertActionFor(item, subject)).toMatchObject({ kind: "link", href: "/ward-flow/capacity" });
});
