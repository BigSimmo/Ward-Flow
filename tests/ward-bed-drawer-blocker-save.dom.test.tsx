import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/ward/rph-adult-secure" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { setDeskRole } from "@/components/ward-management/ward-role-gate";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { allUnits, NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { getBedStep, queryBedStep } from "./helpers/ward-bed-steps";

/*
 * Live test, 26 Oct 2026: a bed manager's "Save blocker" in the bed drawer closed the form and sent
 * nothing, because the drawer offered the blocker controls with no handler behind them. Josh (26 Oct):
 * bed managers record blockers from the bed drawer. The controls now show only where this desk can
 * save, and the form closes only once the save is accepted. Synthetic seed data only.
 */
const UNIT = allUnits()[0];
const bed = (blockReason?: string): BedItem =>
  ({
    bedNumber: 3,
    bedLabel: "Bed 03",
    status: "occupied",
    statusText: "Inpatient",
    patientAlias: "Synthetic Person B",
    admissionId: "adm-blocker",
    stayAdmissionId: "adm-blocker",
    blockReason,
  }) as BedItem;

function drawer(
  item: BedItem,
  onUpdateBlocker?: (id: string, blocker: string | null) => ReturnType<WardCommandDispatch>,
) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardBedDossierDrawer
        selectedBed={3}
        bedItem={item}
        unit={UNIT}
        onClose={() => {}}
        drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
        setDrawerLeavingDestination={() => {}}
        onRecordLeft={() => {}}
        onUpdateBlocker={onUpdateBlocker}
        bedDrawerRef={createRef<HTMLElement>()}
        onKeyDown={() => {}}
      />
    </WardFlowProvider>
  );
}

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function openEditor() {
  const tab = screen.queryByRole("tab", { name: "Plan to leave" });
  if (tab) fireEvent.click(tab);
  fireEvent.click(getBedStep(/^(Record|Update) blocker$/));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe.each([
  ["desktop", () => {}],
  ["phone", asPhone],
])("bed drawer blocker on %s", (_layout, setup) => {
  it("offers no blocker control where this desk has no handler", () => {
    setup();
    render(drawer(bed()));
    expect(queryBedStep(/^(Record|Update) blocker$/)).toBeNull();
    cleanup();
    render(drawer(bed("Awaiting clean")));
    const tab = screen.queryByRole("tab", { name: "Plan to leave" });
    if (tab) fireEvent.click(tab);
    expect(queryBedStep(/^(Record|Update) blocker$/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear blocker" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save blocker" })).toBeNull();
  });

  it("opens the blocker list blank, and Save blocker says why until a choice is made", () => {
    setup();
    const onUpdateBlocker = vi.fn(() => Promise.resolve<WardCommandOutcome>({ commandId: "c-0", status: "accepted" }));
    render(drawer(bed(), onUpdateBlocker));
    openEditor();
    expect(screen.getByRole("combobox", { name: "Discharge blocker" })).toHaveValue("");
    const save = screen.getByRole("button", { name: "Save blocker" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose what is holding them up first.")).toBeVisible();
    fireEvent.click(save);
    expect(onUpdateBlocker).not.toHaveBeenCalled();
  });

  it("sends the chosen blocker and closes only once the save is accepted", async () => {
    setup();
    let finish: (outcome: WardCommandOutcome) => void = () => {};
    const onUpdateBlocker = vi.fn(() => new Promise<WardCommandOutcome>((resolve) => (finish = resolve)));
    render(drawer(bed(), onUpdateBlocker));
    openEditor();
    fireEvent.change(screen.getByRole("combobox", { name: "Discharge blocker" }), {
      target: { value: "Awaiting accommodation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save blocker" }));
    expect(onUpdateBlocker).toHaveBeenCalledWith("adm-blocker", "Awaiting accommodation");
    // Not answered yet: still open, saying so.
    expect(screen.getByRole("button", { name: "Save blocker" })).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    await act(async () => finish({ commandId: "c-1", status: "accepted" }));
    expect(screen.queryByRole("button", { name: "Save blocker" })).toBeNull();
    expect(screen.queryByTestId("ward-blocker-error")).toBeNull();
  });

  it.each(["refused", "failed"] as const)("stays open and says why when the save is %s", async (status) => {
    setup();
    const onUpdateBlocker = vi.fn(() =>
      Promise.resolve<WardCommandOutcome>({ commandId: "c-2", status, message: "Review the shared board" }),
    );
    render(drawer(bed(), onUpdateBlocker));
    openEditor();
    fireEvent.change(screen.getByRole("combobox", { name: "Discharge blocker" }), {
      target: { value: "Awaiting clean" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save blocker" }));
    await act(async () => {});
    expect(onUpdateBlocker).toHaveBeenCalledWith("adm-blocker", "Awaiting clean");
    expect(screen.getByRole("button", { name: "Save blocker" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Discharge blocker" })).toHaveValue("Awaiting clean");
    expect(screen.getByTestId("ward-blocker-error")).not.toBeEmptyDOMElement();
  });
});

/** Holds each command until the test answers it, recording what was sent. */
function commands() {
  const pending: { finish: (outcome: WardCommandOutcome) => void; commit: () => ReturnType<WardCommandDispatch> }[] =
    [];
  const record = vi.fn<
    (event: WardFlowEvent, commit: () => ReturnType<WardCommandDispatch>) => ReturnType<WardCommandDispatch>
  >((_event, commit) => new Promise<WardCommandOutcome>((finish) => pending.push({ finish, commit })));
  return {
    record,
    async accept() {
      const next = pending.shift()!;
      const outcome = await next.commit();
      if (!outcome) throw new Error("The real provider did not return a command outcome");
      next.finish(outcome);
      return outcome;
    },
  };
}

function Override({ control, children }: { control: ReturnType<typeof commands>; children: ReactNode }) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => control.record(event, () => flow.dispatch(event));
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

const SCREEN_UNIT = "rph-adult-secure";

async function recordBlockerOnScreen(control: ReturnType<typeof commands>) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Override control={control}>
          <WardScreen unitId={SCREEN_UNIT} />
        </Override>
      </ToastProvider>
    </WardFlowProvider>,
  );
  const everyBed = document.getElementById("bed-capacity")!;
  const occupied = within(everyBed)
    .getAllByRole("button", { name: /^Bed \d{2},/ })
    .filter(
      (tile) => !/Free|Ready|Closed|Pulled|Held up|Due out|Past date/.test(tile.getAttribute("aria-label") ?? ""),
    );
  expect(occupied.length).toBeGreaterThan(0);
  fireEvent.click(occupied.at(-1)!);
  const drawerEl = await screen.findByTestId("bed-telemetry-drawer");
  fireEvent.click(within(drawerEl).getByRole("tab", { name: "Plan to leave" }));
  fireEvent.click(getBedStep("Record blocker", drawerEl));
  fireEvent.change(within(drawerEl).getByRole("combobox", { name: "Discharge blocker" }), {
    target: { value: "Awaiting clean" },
  });
  fireEvent.click(within(drawerEl).getByRole("button", { name: "Save blocker" }));
  expect(control.record).toHaveBeenCalledTimes(1);
  const sent = control.record.mock.calls[0]![0];
  expect(["RECORD_STAY_DISCHARGE_BLOCKER", "BLOCK_BED_RELEASE"]).toContain(sent.type);
  // Still open until the answer comes back.
  expect(within(drawerEl).getByRole("button", { name: "Save blocker" })).toBeInTheDocument();
  let outcome: WardCommandOutcome | void = undefined;
  await act(async () => {
    outcome = await control.accept();
  });
  expect((outcome as WardCommandOutcome | undefined)?.status).toBe("accepted");
  expect(within(drawerEl).queryByRole("button", { name: "Save blocker" })).toBeNull();
  expect(drawerEl).toHaveTextContent(/Today:\s*Awaiting clean/i);
  return sent;
}

describe("the ward screen's bed drawer wires the blocker for each desk that may record one", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    route.pathname = `/ward-flow/ward/${SCREEN_UNIT}`;
  });

  it("a signed-in site bed manager (role access on) records it as bed_manager", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: unitById(SCREEN_UNIT)!.siteCode } });
    });
    const sent = await recordBlockerOnScreen(commands());
    expect(sent.role).toBe("bed_manager");
  });

  it("a coordinator desk switch on the ward route records it as coordinator", async () => {
    setDeskRole("coordinator", route.pathname);
    const sent = await recordBlockerOnScreen(commands());
    expect(sent.role).toBe("coordinator");
  });

  it("the ward desk still records it as ward", async () => {
    const sent = await recordBlockerOnScreen(commands());
    expect(sent.role).toBe("ward");
  });
});
