import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { Sheet } from "@/components/wf";
import { RecordPreview } from "@/components/ward-management/search/record-preview";
import { ExceptionDrawer } from "@/components/ward-management/coordinator/exception-drawer";
import { HubScreen } from "@/components/ward-management/hub/hub-screen";
import { useEdEscapeKey } from "@/components/ward-management/ed/use-ed-screen-state";
import { useDischargeWorkspaceState } from "@/components/ward-management/discharges/use-discharge-workspace-state";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Production audit 24 Oct 2026, UISR-01, URE-04 and USC-04: a page-level Escape handler must leave
 * the key to the layer on top. One Escape that closes a sheet (or a field's own suggestion list, or
 * a native dialog) must not also close the preview, the register bar, the Hub query, the ED board
 * or the discharge drawer underneath.
 */

afterEach(() => cleanup());

const seed = seedWardFlowState();

/** A shared sheet open over the page, as a header drawer (Tasks, Activity, Referral) would be. */
function OverSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title="Header drawer">
      <p>Drawer body</p>
    </Sheet>
  );
}

function pressEscape() {
  fireEvent.keyDown(window, { key: "Escape" });
}

describe("UISR-01: Search record preview", () => {
  it("stays open when Escape closes a sheet on top", () => {
    const onClose = vi.fn();
    const sheetClose = vi.fn();
    render(
      <>
        <RecordPreview
          selection={{ kind: "person", patient: seed.patients[0]! }}
          referrals={[]}
          movements={[]}
          patients={seed.patients}
          units={allUnits()}
          now={NOW_ANCHOR}
          onClose={onClose}
        />
        <OverSheet onClose={sheetClose} />
      </>,
    );
    pressEscape();
    expect(sheetClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open when a field has already handled Escape (the typeahead closing its list)", () => {
    const onClose = vi.fn();
    render(
      <RecordPreview
        selection={{ kind: "person", patient: seed.patients[0]! }}
        referrals={[]}
        movements={[]}
        patients={seed.patients}
        units={allUnits()}
        now={NOW_ANCHOR}
        onClose={onClose}
      />,
    );
    const field = document.createElement("input");
    document.body.appendChild(field);
    field.addEventListener("keydown", (event) => event.preventDefault());
    fireEvent.keyDown(field, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    field.remove();
  });
});

describe("UISR-01: Home registers bar", () => {
  it("does not fold the open phone bar when Escape closes a sheet on top", () => {
    const onToggle = vi.fn();
    render(
      <>
        <ExceptionDrawer
          items={[]}
          rejections={[]}
          overrides={[]}
          declines={[]}
          units={allUnits()}
          now={NOW_ANCHOR}
          open
          onToggle={onToggle}
          onSelectMovement={() => {}}
        />
        <OverSheet onClose={() => {}} />
      </>,
    );
    pressEscape();
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("UISR-01: Search hub", () => {
  it("keeps the typed query when Escape closes a sheet on top", () => {
    function Harness() {
      const [sheetOpen, setSheetOpen] = useState(false);
      return (
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <HubScreen />
          <button type="button" onClick={() => setSheetOpen(true)}>
            Open drawer
          </button>
          {sheetOpen ? <OverSheet onClose={() => setSheetOpen(false)} /> : null}
        </WardFlowProvider>
      );
    }
    render(<Harness />);
    const search = screen.getByRole("searchbox", { name: /search/i }) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "Royal" } });
    fireEvent.click(screen.getByRole("button", { name: "Open drawer" }));
    pressEscape();
    expect(screen.queryByText("Drawer body")).toBeNull();
    expect(search.value).toBe("Royal");
  });
});

describe("URE-04: ED Escape", () => {
  function renderEdEscape(overrides: { selectedPatientId?: string | null; fullscreenBoard?: boolean } = {}) {
    const setSelectedPatientId = vi.fn();
    const setFullscreenBoard = vi.fn();
    renderHook(() =>
      useEdEscapeKey({
        arrivalPlanOpenFor: undefined,
        setArrivalPlanOpenFor: vi.fn(),
        transportOpenFor: undefined,
        closeTransportDialog: vi.fn(),
        selectedPatientId: overrides.selectedPatientId ?? null,
        setSelectedPatientId,
        fullscreenBoard: overrides.fullscreenBoard ?? false,
        setFullscreenBoard,
      }),
    );
    return { setSelectedPatientId, setFullscreenBoard };
  }

  it("still closes the larger board when nothing is on top", () => {
    const { setFullscreenBoard } = renderEdEscape({ fullscreenBoard: true });
    pressEscape();
    expect(setFullscreenBoard).toHaveBeenCalledWith(false);
  });

  it("leaves the record open when Escape closes the person sheet on top", () => {
    const { setSelectedPatientId } = renderEdEscape({ selectedPatientId: "m-1" });
    render(<OverSheet onClose={() => {}} />);
    pressEscape();
    expect(setSelectedPatientId).not.toHaveBeenCalled();
  });

  it("leaves the larger board when Escape closes the presentation editor (a native dialog)", () => {
    const { setFullscreenBoard } = renderEdEscape({ fullscreenBoard: true });
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.appendChild(dialog);
    pressEscape();
    expect(setFullscreenBoard).not.toHaveBeenCalled();
    dialog.remove();
  });
});

describe("USC-04: discharge drawer", () => {
  function DischargeHarness() {
    const s = useDischargeWorkspaceState({});
    const [sheetOpen, setSheetOpen] = useState(false);
    const record = s.records.find((entry) => entry.admissionState === "occupied");
    return (
      <>
        <button
          type="button"
          onClick={() => {
            s.setPopulation("records");
            s.openRecord(record!);
          }}
        >
          Open record
        </button>
        <button type="button" onClick={() => setSheetOpen(true)}>
          Open drawer
        </button>
        <output data-testid="selected">{s.selected === null ? "none" : "open"}</output>
        {sheetOpen ? <OverSheet onClose={() => setSheetOpen(false)} /> : null}
      </>
    );
  }

  it("stays open when Escape closes a sheet on top", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeHarness />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open record" }));
    expect(screen.getByTestId("selected").textContent).toBe("open");
    fireEvent.click(screen.getByRole("button", { name: "Open drawer" }));
    act(() => pressEscape());
    expect(screen.queryByText("Drawer body")).toBeNull();
    expect(screen.getByTestId("selected").textContent).toBe("open");
    // With nothing on top, Escape still closes the drawer.
    act(() => pressEscape());
    expect(screen.getByTestId("selected").textContent).toBe("none");
  });
});
