import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deferred = vi.hoisted(() => ({ held: undefined as string | undefined }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useDeferredValue: <T,>(value: T) => {
      const current = actual.useDeferredValue(value);
      return deferred.held === undefined ? current : deferred.held;
    },
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/ward-flow" }));

import {
  WardGlobalSearch as Search,
  clearGlobalSearchRecents,
  type WardGlobalSearchProps,
} from "@/components/ward-management/ward-global-search";
import { WardGlobalSearch as HeaderSearch } from "@/components/ward-management/ward-global-search-lazy";
import { WardPartialViewProvider } from "@/components/ward-management/ward-partial-view";
import { WardShellPublicProvider } from "@/components/ward-management/shell/ward-shell-public-context";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";
import {
  breakGlass,
  giveCover,
  endCover,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";
import { patientListName } from "@/components/ward-management/ward-patients";
import { buildActionInbox, destinationUnit, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import { endWardFlowTabSession } from "@/components/ward-management/ward-browser-data";
import { installMatchMediaStub } from "./setup/jsdom.setup";

const units = allUnits();
const target = wardPatients[0];
const props: WardGlobalSearchProps = { movements: wardMovements, patients: wardPatients, units, onNavigate: vi.fn() };
const firstContext = "a".repeat(64);
const nextContext = "b".repeat(64);
const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [units[0].id] } };
const input = () => screen.getByTestId("ward-global-search-input");
const recent = () => screen.queryByRole("listbox", { name: "Recent" });

beforeEach(() => {
  installMatchMediaStub(false);
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(STATEWIDE_COORDINATOR);
  clearGlobalSearchRecents();
  deferred.held = undefined;
});
afterEach(() => {
  cleanup();
  clearGlobalSearchRecents();
  deferred.held = undefined;
  vi.clearAllMocks();
});

function rememberPerson() {
  fireEvent.change(input(), { target: { value: target.umrn } });
  fireEvent.click(screen.getByTestId(`ward-global-search-result-person-${target.id}`), { button: 0 });
  fireEvent.change(input(), { target: { value: "" } });
  expect(recent()).toHaveTextContent(patientListName(target));
}

function sharedSearch(context: string | null, overrides: Partial<WardGlobalSearchProps> = {}, shared = true) {
  return (
    <WardShellPublicProvider
      value={{ places: wardPlaceLookup(units), placeLabel: "Synthetic desk", now: overrides.now ?? NOW_ANCHOR }}
    >
      <WardPartialViewProvider response={undefined} currentRevision={9} currentAccessContext={context} shared={shared}>
        <HeaderSearch {...props} {...overrides} />
      </WardPartialViewProvider>
    </WardShellPublicProvider>
  );
}

describe("search recents follow the current access lifetime", () => {
  it("forgets the same account's wider desk when it narrows, even before new collections arrive", () => {
    render(sharedSearch(firstContext));
    rememberPerson();
    act(() => setWardAccess(ward, { fromServer: true }));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
    act(() => setWardAccess(STATEWIDE_COORDINATOR, { fromServer: true }));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
  });

  it("uses the genuine outer context for roles without a sender sibling at an equal revision", () => {
    const view = render(sharedSearch(firstContext));
    rememberPerson();
    view.rerender(sharedSearch(nextContext));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
    view.rerender(sharedSearch(firstContext));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
  });

  it("shows no recents while shared context is unavailable and cannot restore an earlier lifetime", () => {
    const view = render(sharedSearch(firstContext));
    rememberPerson();
    view.rerender(sharedSearch(null));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
    view.rerender(sharedSearch(firstContext));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
  });

  it("keeps current recents across a remount and clears them on sign-out", () => {
    const view = render(sharedSearch(firstContext));
    rememberPerson();
    view.unmount();
    render(sharedSearch(firstContext));
    fireEvent.focus(input());
    expect(recent()).toHaveTextContent(patientListName(target));
    act(() => endWardFlowTabSession());
    expect(recent()).not.toBeInTheDocument();
  });

  it("ends a local opening's search lifetime as its clock expires", () => {
    setWardAccess(ward);
    act(() =>
      breakGlass({
        patientId: target.id,
        now: 100,
        windowMinutes: 5,
        reason: "handover",
        placeLabel: "Synthetic desk",
      }),
    );
    const view = render(sharedSearch(null, { now: 101 }, false));
    rememberPerson();
    view.rerender(sharedSearch(null, { now: 106 }, false));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
  });

  it("forgets recents when local cover is removed", () => {
    setWardAccess(ward);
    const cover = giveCover({ recipient: ward, scope: { kind: "ward", unitIds: [units[1].id] }, now: 100, until: 110 });
    if (!cover) throw new Error("Synthetic cover was not created");
    render(sharedSearch(null, { now: 101 }, false));
    rememberPerson();
    act(() => endCover(cover.id));
    fireEvent.focus(input());
    expect(recent()).not.toBeInTheDocument();
  });

  it("drops a removed record immediately even while its access context stays the same", () => {
    const view = render(<Search {...props} accessLifetime="one-desk" />);
    rememberPerson();
    view.rerender(
      <Search
        {...props}
        accessLifetime="one-desk"
        patients={wardPatients.filter((person) => person.id !== target.id)}
      />,
    );
    expect(recent()).not.toBeInTheDocument();
  });

  it("rebuilds a retained record's displayed details from the current authorised collection", () => {
    const view = render(<Search {...props} accessLifetime="one-desk" />);
    rememberPerson();
    const updated = { ...target, familyName: "CurrentSynthetic", dateOfBirth: "1988-02-03" };
    view.rerender(
      <Search
        {...props}
        accessLifetime="one-desk"
        patients={wardPatients.map((person) => (person.id === target.id ? updated : person))}
      />,
    );
    expect(recent()).toHaveTextContent(patientListName(updated));
    expect(recent()).toHaveTextContent("03/02/1988");
    expect(recent()).not.toHaveTextContent(patientListName(target));
  });

  it("rebuilds a movement's destination rather than retaining earlier destination metadata", () => {
    const movement = wardMovements.find((candidate) => isOpen(candidate) && destinationUnit(candidate, units));
    if (!movement) throw new Error("Synthetic destination fixture is missing");
    const destination = destinationUnit(movement, units)!;
    const view = render(<Search {...props} accessLifetime="one-desk" />);
    fireEvent.change(input(), { target: { value: movement.id } });
    fireEvent.click(screen.getByTestId(`ward-global-search-result-movement-${movement.id}`));
    fireEvent.change(input(), { target: { value: "" } });
    expect(recent()).toHaveTextContent(destination.name);
    view.rerender(
      <Search {...props} accessLifetime="one-desk" units={units.filter((unit) => unit.id !== destination.id)} />,
    );
    expect(recent()).not.toHaveTextContent(destination.name);
    view.rerender(
      <Search
        {...props}
        accessLifetime="one-desk"
        movements={wardMovements.filter((candidate) => candidate.id !== movement.id)}
      />,
    );
    expect(recent()).not.toBeInTheDocument();
  });

  it("drops a referral removed from the current authorised referrals", () => {
    const state = seedWardFlowState();
    const referral = state.referrals.find((candidate) => candidate.destinations.some(isAwaitingAnswer));
    if (!referral) throw new Error("Synthetic referral fixture is missing");
    const current = {
      ...props,
      patients: state.patients,
      movements: state.movements,
      referrals: state.referrals,
      units: state.units,
    };
    const view = render(<Search {...current} accessLifetime="one-desk" />);
    fireEvent.change(input(), { target: { value: referral.id } });
    fireEvent.click(screen.getByTestId(`ward-global-search-result-referral-${referral.id}`));
    fireEvent.change(input(), { target: { value: "" } });
    expect(recent()).toBeInTheDocument();
    view.rerender(
      <Search
        {...current}
        accessLifetime="one-desk"
        referrals={state.referrals.filter((candidate) => candidate.id !== referral.id)}
      />,
    );
    expect(recent()).not.toBeInTheDocument();
  });

  it("drops a ward-stay answer once that admission leaves the current authorised census", () => {
    function ProvidedSearch({ removed = false }: { removed?: boolean }) {
      const flow = useWardFlow();
      return (
        <WardFlowOverride value={{ ...flow, admissions: removed ? [] : flow.admissions }}>
          <Search
            {...props}
            movements={flow.movements}
            patients={flow.patients}
            units={flow.units}
            referrals={flow.referrals}
            now={flow.now}
            accessLifetime="one-desk"
          />
        </WardFlowOverride>
      );
    }
    const content = (removed = false) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ProvidedSearch removed={removed} />
      </WardFlowProvider>
    );
    const view = render(content());
    fireEvent.change(input(), { target: { value: "discharges" } });
    const row = screen.getAllByTestId(/^ward-global-search-result-stay-/)[0];
    expect(row).toBeInTheDocument();
    fireEvent.click(row);
    fireEvent.change(input(), { target: { value: "" } });
    expect(recent()).toBeInTheDocument();
    view.rerender(content(true));
    expect(recent()).not.toBeInTheDocument();
  });

  it("keeps tasks only while the caller's current authorised task collection includes them", () => {
    const tasks = buildActionInbox(wardMovements.filter(isOpen), 0, units);
    const task = tasks[0];
    if (!task) throw new Error("Synthetic task fixture is empty");
    const view = render(<Search {...props} accessLifetime="one-desk" tasks={[task]} />);
    fireEvent.focus(input());
    fireEvent.click(screen.getByTestId(`ward-global-search-result-task-${task.id}`));
    fireEvent.focus(input());
    expect(recent()).toHaveTextContent(task.title);
    view.rerender(<Search {...props} accessLifetime="one-desk" tasks={[]} />);
    expect(recent()).not.toBeInTheDocument();
  });

  it("does not select or remember a retained row while the latest query is still pending", () => {
    const onNavigate = vi.fn();
    render(<Search {...props} accessLifetime="one-desk" onNavigate={onNavigate} />);
    rememberPerson();
    onNavigate.mockClear();
    deferred.held = "";
    fireEvent.change(input(), { target: { value: "another query" } });
    const row = within(recent()!).getByTestId(`ward-global-search-result-person-${target.id}`);
    fireEvent.click(row);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
