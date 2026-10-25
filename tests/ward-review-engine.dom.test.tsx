import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
const routing = vi.hoisted(() => ({
  push: vi.fn(),
  dispatch: vi.fn(),
  query: "",
  lifecycle: null as "pulled" | "occupied" | "departed" | "waitlisted" | null,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/scgh-adult-open",
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
        admissions: [
          ...(context.admissions ?? []),
          ...(routing.lifecycle && context.referrals.at(-1)
            ? [
                {
                  ...context.admissions[0]!,
                  id: "AD-LIFECYCLE-CONSUMED",
                  unitId: UNIT,
                  referralId: context.referrals.at(-1)!.id,
                  movementId: null,
                  state: routing.lifecycle,
                },
              ]
            : []),
        ].map((a) => ({
          ...a,
          observation: { level: "within_sight" as const, intervalMinutes: null, reviewAt: null },
          highAcuity: false,
        })),
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
afterEach(() => {
  routing.lifecycle = null;
});
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
      <output data-testid="referral-id">{newest?.id}</output>
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
      (item) => !/ready|closed|pulled/.test(item.getAttribute("aria-label") ?? ""),
    );
    expect(occupied).toBeDefined();
    fireEvent.click(occupied!);
    fireEvent.click(screen.getAllByRole("button", { name: /^Raise referral$/ }).at(-1)!);
    expect(routing.dispatch.mock.calls.filter(([event]) => event.type === "RECEIVE_REFERRAL")).toEqual([]);
    expect(routing.push).toHaveBeenCalledWith(expect.stringMatching(/^\/ward-flow\/referrals\/new\?category=ward/));
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
      /, ready, fits$/.test(item.getAttribute("aria-label") ?? ""),
    );
    expect(free).toBeDefined();
    fireEvent.click(free!);
    const after = JSON.parse(screen.getByTestId("arm").textContent!);
    expect(after).toEqual({ ...before, heldBedNumber: Number(free!.dataset.testid!.replace("ward-board-bed-", "")) });
    expect(screen.getByTestId("accept-count")).toHaveTextContent("1");
    expect(JSON.parse(screen.getByTestId("hold-audit").textContent!)).toHaveLength(1);
  });
});

describe("accepted referral picker lifecycle", () => {
  it.each(["pulled", "occupied", "departed"] as const)(
    "keeps a consumed %s direct referral out of the picker",
    (lifecycle) => {
      routing.query = "tab=board";
      routing.lifecycle = lifecycle;
      renderWard(<DirectReferral />);
      const referralId = screen.getByTestId("referral-id").textContent!;
      expect(JSON.parse(screen.getByTestId("arm").textContent!).state).toBe("accepted");
      expect(screen.queryByTestId("ward-board-pick-" + referralId)).not.toBeInTheDocument();
      routing.lifecycle = null;
    },
  );
  it("retains the existing waitlisted-stay eligibility", () => {
    routing.query = "tab=board";
    routing.lifecycle = "waitlisted";
    renderWard(<DirectReferral />);
    const referralId = screen.getByTestId("referral-id").textContent!;
    expect(screen.getByTestId("ward-board-pick-" + referralId)).toBeInTheDocument();
    routing.lifecycle = null;
  });
});
