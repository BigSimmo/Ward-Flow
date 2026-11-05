import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, configure } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CensusTable,
  type CensusTableProps,
  type CensusScrollPosition,
} from "@/components/ward-management/search/patient-census-view";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import {
  rememberReturnRow,
  rowWithAttribute,
  useReturnedView,
  useReturnToPlace,
} from "@/components/ward-management/use-return-to-place";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/search",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
configure({ getElementError: () => new Error("Synthetic scroll regression query failed; record text suppressed.") });
beforeEach(() => {
  resetWardAccessStoreForTests();
  (document.activeElement as HTMLElement | null)?.blur?.();
});
afterEach(() => {
  cleanup();
  endWardFlowBrowserSession();
  vi.restoreAllMocks();
});
const seed = seedWardFlowState();
const rows = buildCensus({
  ...seed,
  now: NOW_ANCHOR,
  thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
  dayZero: new Date("2026-11-04T00:00:00+08:00"),
}).rows;
const defaults: CensusTableProps = {
  rows,
  totalPeople: rows.length,
  searching: false,
  needle: "",
  sort: "wait",
  onSort: () => {},
  highlight: null,
  onHighlight: () => {},
  highlightCounts: { t1: 0, long: 0, form: 0, edd: 0, aed: 0 },
  lifted: () => false,
  openGroups: { ask: true, wait: true, found: true, move: true, ward: true, off: true },
  onToggleGroup: () => {},
  showAllWard: true,
  onShowAllWard: () => {},
  selectedKey: null,
  flashKey: null,
  onSelect: () => {},
  tab: "now",
  onTab: () => {},
  liveCount: rows.length,
  historyCount: 0,
  history: null,
  onCopyList: () => {},
  copyNote: null,
  empty: null,
};
const region = () => screen.getByRole("region", { name: "Patient census rows" });
function scrollMemory(initial: CensusScrollPosition) {
  let value = initial;
  return {
    get current() {
      return value;
    },
    read: () => value,
    record: (position: CensusScrollPosition) => {
      value = position;
    },
  };
}
function Table({
  visible = true,
  identity = "default",
  held,
  open = true,
  tableRows = rows,
  tableTab = "now",
}: {
  visible?: boolean;
  identity?: string;
  held: ReturnType<typeof scrollMemory>;
  open?: boolean;
  tableRows?: typeof rows;
  tableTab?: CensusTableProps["tab"];
}) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {visible ? (
        <CensusTable
          {...defaults}
          rows={tableRows}
          tab={tableTab}
          openGroups={{ ...defaults.openGroups, ward: open }}
          readScrollPosition={held.read}
          recordScrollPosition={held.record}
          scrollIdentity={identity}
        />
      ) : null}
    </WardFlowProvider>
  );
}
describe("census inner scroll owner", () => {
  it.each(["empty", "history"] as const)("resets identity even through an absent %s scroller", (viewKind) => {
    const held = scrollMemory({ identity: "default", top: 213, left: 37 });
    const view = render(<Table held={held} />);
    view.rerender(
      <Table
        held={held}
        identity={viewKind}
        tableRows={viewKind === "empty" ? [] : rows}
        tableTab={viewKind === "history" ? "history" : "now"}
      />,
    );
    expect(screen.queryByRole("region", { name: "Patient census rows" })).toBeNull();
    expect(held.current).toEqual({ identity: viewKind, top: 0, left: 0 });
    view.rerender(<Table held={held} />);
    expect(region().scrollTop).toBe(0);
    expect(region().scrollLeft).toBe(0);
  });
  it("captures a final unsent scroll event on unmount and restores both axes after responsive remount", () => {
    const held = scrollMemory({ identity: "default", top: 0, left: 0 });
    const view = render(<Table held={held} />);
    region().scrollTop = 213;
    region().scrollLeft = 37;
    // Deliberately no fireEvent.scroll: resizing can unmount before the browser queues it.
    view.rerender(<Table held={held} visible={false} />);
    expect(held.current).toEqual({ identity: "default", top: 213, left: 37 });
    view.rerender(<Table held={held} />);
    expect(region().scrollTop).toBe(213);
    expect(region().scrollLeft).toBe(37);
  });
  it.each(["query-changed", "dob-changed", "sort-changed", "filter-changed"])("resets both axes for %s", (identity) => {
    const held = scrollMemory({ identity: "default", top: 123, left: 31 });
    const view = render(<Table held={held} />);
    expect(region().scrollTop).toBe(123);
    view.rerender(<Table held={held} identity={identity} />);
    expect(region().scrollTop).toBe(0);
    expect(region().scrollLeft).toBe(0);
  });
  // Responsive audit flake (5 Nov 2026): a table scrolled before hydration attaches onScroll was
  // put back to the top when hydration ran the restore with nothing held.
  it("keeps a scroll taken before hydration when nothing is held to restore", () => {
    const held = scrollMemory({ identity: "default", top: 0, left: 0 });
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Table held={held} />);
    document.body.appendChild(container);
    const served = container.querySelector<HTMLElement>('[aria-label="Patient census rows"]')!;
    served.scrollTop = 300;
    render(<Table held={held} />, { container, hydrate: true });
    expect(region()).toBe(served);
    expect(region().scrollTop).toBe(300);
    expect(held.current).toEqual({ identity: "default", top: 300, left: 0 });
  });
  it("keeps position while opening or closing groups under the same query/filter identity", () => {
    const held = scrollMemory({ identity: "default", top: 123, left: 31 });
    const view = render(<Table held={held} />);
    view.rerender(<Table held={held} open={false} />);
    expect(region().scrollTop).toBe(123);
    expect(region().scrollLeft).toBe(31);
  });
});
function navigate(path: string, history = false) {
  window.history.replaceState(null, "", path);
  if (history) window.dispatchEvent(new PopStateEvent("popstate"));
}
function Scope({ generation = 0, children }: { generation?: number; children: ReactNode }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Generation value={generation}>{children}</Generation>
    </WardFlowProvider>
  );
}
function Generation({ value, children }: { value: number; children: ReactNode }) {
  const flow = useWardFlow();
  return <WardFlowOverride value={{ ...flow, worldGeneration: value }}>{children}</WardFlowOverride>;
}
type Saved = { tab: string; scroll: { top: number; left: number } };
const find = (id: string) => rowWithAttribute("data-scroll-row", id, "li");
function CaptureList({ route, captured }: { route: string; captured: (value: Saved) => void }) {
  const returned = useReturnedView<Saved>(route);
  const offsets = useRef({ top: 0, left: 0 });
  useReturnToPlace(route, { tab: "open", scroll: { top: 0, left: 0 } }, find, () => {
    const value = { tab: "open", scroll: { ...offsets.current } };
    captured(value);
    return value;
  });
  return (
    <>
      <output data-testid="saved-scroll">{JSON.stringify(returned?.scroll ?? null)}</output>
      <li tabIndex={-1} data-scroll-row="chosen">
        <button
          onClick={() => {
            offsets.current = { top: 211, left: 39 };
            rememberReturnRow(route, "chosen");
          }}
        >
          Leave chosen row
        </button>
      </li>
    </>
  );
}
describe("return-place capture retains existing ownership gates", () => {
  it("captures at cleanup without a React rerender, restores coordinates and retains row focus", async () => {
    const captured = vi.fn();
    const route = "/scroll-return-capture";
    navigate(route);
    const view = render(
      <Scope>
        <CaptureList route={route} captured={captured} />
      </Scope>,
    );
    expect(captured).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave chosen row" }));
    expect(captured).not.toHaveBeenCalled();
    view.unmount();
    expect(captured).toHaveBeenCalledExactlyOnceWith({ tab: "open", scroll: { top: 211, left: 39 } });
    navigate("/elsewhere");
    navigate(route, true);
    render(
      <Scope>
        <CaptureList route={route} captured={captured} />
      </Scope>,
    );
    expect(screen.getByTestId("saved-scroll")).toHaveTextContent('{"top":211,"left":39}');
    await waitFor(() => expect(document.activeElement).toBe(find("chosen")));
  });
  it.each(["ordinary-entry", "different-world", "different-access", "session-ended"])(
    "does not replay old capture after %s",
    (change) => {
      const captured = vi.fn();
      const route = `/scroll-return-${change}`;
      navigate(route);
      const view = render(
        <Scope>
          <CaptureList route={route} captured={captured} />
        </Scope>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Leave chosen row" }));
      view.unmount();
      navigate("/elsewhere");
      if (change === "different-access") act(() => setWardAccess(STATEWIDE_COORDINATOR));
      if (change === "session-ended") act(() => endWardFlowBrowserSession());
      navigate(route, change !== "ordinary-entry");
      render(
        <Scope generation={change === "different-world" ? 1 : 0}>
          <CaptureList route={route} captured={captured} />
        </Scope>,
      );
      expect(screen.getByTestId("saved-scroll")).toHaveTextContent("null");
    },
  );
});
/** The actual page must not carry narrowed-list positions into its default return view. */
describe("unrestored query choices never replay row offsets into the default census", () => {
  it.each(["query", "dob", "patient-state"])(
    "drops captured offset for %s when returning to the default view",
    (choice) => {
      const mount = () =>
        render(
          <WardFlowProvider initialNow={NOW_ANCHOR}>
            <PatientSearchPage />
          </WardFlowProvider>,
        );
      navigate("/ward-flow/search");
      const view = mount();
      if (choice === "query")
        fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: "a" } });
      if (choice === "dob") fireEvent.click(screen.getByRole("button", { name: "DOB" }));
      if (choice === "patient-state") fireEvent.click(screen.getByRole("radio", { name: /^Inpatient/ }));
      // Query/group choice must still leave rows visible; use a supported seed match in the final test.
      region().scrollTop = 211;
      region().scrollLeft = 39;
      fireEvent.scroll(region());
      view.unmount();
      navigate("/ward-flow/capacity");
      navigate("/ward-flow/search", true);
      mount();
      expect(region().scrollTop).toBe(0);
      expect(region().scrollLeft).toBe(0);
    },
  );
});
