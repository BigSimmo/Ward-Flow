import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
const routing = vi.hoisted(() => ({ push: vi.fn(), dispatch: vi.fn(), query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/ward/scgh-adult-open",
  useSearchParams: () => new URLSearchParams(routing.query),
  useRouter: () => ({ push: routing.push, replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlowSelect: () => {
      const context = actual.useWardFlow();
      return {
        ...context,
        admissions: context.admissions?.map((a) => ({ ...a, specialling: true, highAcuity: false })),
        dispatch: (event: Parameters<typeof context.dispatch>[0]) => {
          routing.dispatch(event);
          context.dispatch(event);
        },
      };
    },
  };
});
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { ToastProvider } from "@/components/wf/toast-provider";
import { NOW_ANCHOR as now } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
const UNIT = "scgh-adult-open";
function DirectReferral() {
  const { dispatch, referrals, eventLog } = useWardFlow();
  useEffect(() => {
    dispatch({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "unknown", reason: "not_known" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
  }, [dispatch]);
  const newest = referrals.at(-1)!;
  useEffect(() => {
    if (newest?.raisedAt === now && newest.destinations[0]?.state === "queued")
      dispatch({
        type: "ACCEPT_REFERRAL",
        role: "ward",
        actingUnitId: UNIT,
        unitId: UNIT,
        referralId: newest.id,
        destinationKind: "psychiatric_ward",
        now,
      });
  }, [dispatch, newest?.id, newest?.raisedAt, newest?.destinations]);
  return (
    <>
      <output data-testid="arm">{JSON.stringify(newest?.destinations[0])}</output>
      <output data-testid="hold-audit">
        {JSON.stringify(eventLog?.filter((event) => event.type === "HOLD_REFERRAL_BED"))}
      </output>
      <output data-testid="accept-count">{eventLog?.filter((event) => event.type === "ACCEPT_REFERRAL").length}</output>
    </>
  );
}
function renderWard(children?: ReactNode) {
  render(
    <WardFlowProvider initialNow={now}>
      <ToastProvider>
        {children}
        <WardScreen unitId={UNIT} />
      </ToastProvider>
    </WardFlowProvider>,
  );
}
describe("review caller regressions", () => {
  it("opens the full form for a specialled stay without inventing acuity, urgency, region or transport facts", () => {
    routing.query = "";
    routing.push.mockClear();
    routing.dispatch.mockClear();
    renderWard();
    fireEvent.click(screen.getByRole("tab", { name: /^Bed board/ }));
    const occupied = [...document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")].find(
      (item) => !/free|closed|pulled/.test(item.getAttribute("aria-label") ?? ""),
    );
    expect(occupied).toBeDefined();
    fireEvent.click(occupied!);
    fireEvent.click(screen.getAllByRole("button", { name: /^Raise referral$/ }).at(-1)!);
    expect(routing.dispatch.mock.calls.filter(([event]) => event.type === "RECEIVE_REFERRAL")).toEqual([]);
    expect(routing.push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/mockups\/ward-flow\/referrals\/new\?category=ward/),
    );
  });
  it("opens the operational board and holds an accepted any-ward arm without reaccepting it", () => {
    routing.query = "tab=board";
    routing.dispatch.mockClear();
    renderWard(<DirectReferral />);
    expect(screen.getByRole("tab", { name: /^Bed board/ })).toHaveAttribute("aria-selected", "true");
    const before = JSON.parse(screen.getByTestId("arm").textContent!);
    expect(before.state).toBe("accepted");
    expect(before.heldBedNumber).toBeUndefined();
    const chips = [...document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-pick-']")];
    const chip = chips.at(-1)!;
    fireEvent.click(chip);
    const free = [...document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")].find((item) =>
      /, free, fits$/.test(item.getAttribute("aria-label") ?? ""),
    );
    expect(free).toBeDefined();
    fireEvent.click(free!);
    const after = JSON.parse(screen.getByTestId("arm").textContent!);
    expect(after).toEqual({ ...before, heldBedNumber: Number(free!.dataset.testid!.replace("ward-board-bed-", "")) });
    expect(screen.getByTestId("accept-count")).toHaveTextContent("1");
    expect(JSON.parse(screen.getByTestId("hold-audit").textContent!)).toHaveLength(1);
  });
});
