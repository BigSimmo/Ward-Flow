import { fireEvent, render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { installMatchMediaStub } from "./setup/jsdom.setup";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { teamHref } from "@/components/ward-management/shell/ward-facade";
import { confirmHelpNavigation } from "@/components/ward-management/help/ward-help-navigation";
type GuardWindow = typeof window & { __wardFlowConfirmNavigation?: (proceed?: () => void) => boolean };
afterEach(() => {
  cleanup();
  installMatchMediaStub(false);
  delete (window as GuardWindow).__wardFlowConfirmNavigation;
});
it("keeps the phone preview on refresh, then closes on record removal", () => {
  installMatchMediaStub(true);
  const state = seedWardFlowState();
  const patient = state.patients[0]!;
  const props = { patients: [patient], movements: [], units: state.units, now: 100 };
  const view = render(<WardGlobalSearch {...props} />);
  fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: patient.umrn } });
  fireEvent.click(screen.getByTestId(`ward-global-search-result-person-${patient.id}`));
  expect(screen.getByRole("dialog", { name: /.+/ })).toBeInTheDocument();
  view.rerender(<WardGlobalSearch {...props} now={101} patients={[{ ...patient }]} />);
  expect(screen.getByRole("dialog", { name: /.+/ })).toBeInTheDocument();
  view.rerender(<WardGlobalSearch {...props} patients={[]} now={102} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(<WardGlobalSearch {...props} patients={[patient]} now={103} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("applies team permission before the forty-result cap and supports exact Enter", () => {
  const state = seedWardFlowState();
  const team = COMMUNITY_TEAM_PAGES.find((team) => team.name.includes("Wheatbelt"))!;
  expect(team).toBeDefined();
  const href = teamHref(team.id);
  const onNavigate = vi.fn();
  render(
    <WardGlobalSearch
      patients={[]}
      movements={[]}
      units={state.units}
      canOpenHref={(candidate) => candidate === href}
      onNavigate={onNavigate}
    />,
  );
  const field = screen.getByTestId("ward-global-search-input");
  fireEvent.change(field, { target: { value: "teams" } });
  expect(screen.getByTestId(`ward-global-search-result-team-${team.id}`)).toHaveAttribute("href", href);
  fireEvent.change(field, { target: { value: team.name } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(onNavigate).toHaveBeenCalledWith(href);
});
it("Help navigation stays without approval, and resumes exactly once after Leave", () => {
  const proceed = vi.fn();
  let leave: (() => void) | undefined;
  (window as GuardWindow).__wardFlowConfirmNavigation = (resume) => {
    leave = resume;
    return false;
  };
  confirmHelpNavigation(proceed);
  expect(proceed).not.toHaveBeenCalled();
  expect(leave).toBeTypeOf("function");
  leave!();
  expect(proceed).toHaveBeenCalledTimes(1);
});
it("Help navigation proceeds immediately when no guard blocks it", () => {
  const proceed = vi.fn();
  confirmHelpNavigation(proceed);
  expect(proceed).toHaveBeenCalledTimes(1);
});

it("counts answer candidates before the presentation cap and marks truncation", () => {
  const seed = seedWardFlowState();
  const patients = Array.from({ length: 41 }, (_, index) => ({
    ...seed.patients[0]!,
    id: `PT-CAP-${index}` as const,
    umrn: `ZZ${String(index).padStart(6, "0")}`,
  }));
  const movements = patients.map((patient, index) => ({
    ...seed.movements[0]!,
    id: `WF-CAP-${index}` as const,
    patientId: patient.id,
    referralId: undefined,
    closure: undefined,
    stage: "placement_requested" as const,
    openedAt: 0,
  }));
  function Host() {
    const flow = useWardFlow();
    return (
      <WardFlowOverride value={{ ...flow, patients, movements, referrals: [], admissions: [], now: 10000 }}>
        <WardGlobalSearch patients={patients} movements={movements} units={flow.units} now={10000} />
      </WardFlowOverride>
    );
  }
  render(
    <WardFlowProvider initialNow={10000}>
      <Host />
    </WardFlowProvider>,
  );
  fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: "over 24 hours" } });
  expect(screen.getByTestId("ward-global-search-show-all-answers")).toHaveTextContent("Show first 40");
  expect(screen.getByTestId("ward-global-search-kind-answers")).toHaveTextContent("40+");
});

function ParallelPatientSearch({
  count = 2,
  reverse = false,
  mixed = false,
}: {
  count?: number;
  reverse?: boolean;
  mixed?: boolean;
}) {
  const flow = useWardFlow();
  const patient = { ...flow.patients[0]!, givenName: "Synthetic", familyName: "Risk" };
  const movement = {
    ...flow.movements[0]!,
    patientId: patient.id,
    referralId: undefined,
    closure: undefined,
    stage: "placement_requested" as const,
    openedAt: 0,
  };
  const movements = [
    { ...movement, id: "WF-COUNT-A" as const },
    {
      ...movement,
      id: "WF-COUNT-B" as const,
      ...(mixed ? { stage: "accepted_awaiting_bed" as const, acceptedUnitId: flow.units[0]!.id } : {}),
    },
  ].slice(0, count);
  if (reverse) movements.reverse();
  return (
    <WardFlowOverride value={{ ...flow, patients: [patient], movements, referrals: [], admissions: [], now: 10000 }}>
      <PatientSearchPage />
    </WardFlowOverride>
  );
}
it("Patients hero counts one person while retaining two valid request rows", () => {
  const view = render(
    <WardFlowProvider initialNow={10000}>
      <ParallelPatientSearch />
    </WardFlowProvider>,
  );
  expect(screen.getByTestId("ward-patient-search-cockpit")).toHaveTextContent("1 person");
  expect(screen.getAllByTestId("ward-patient-search-case-WF-COUNT-A").length).toBeGreaterThan(0);
  expect(screen.getAllByTestId("ward-patient-search-case-WF-COUNT-B").length).toBeGreaterThan(0);
  for (const [count, reverse] of [
    [2, true],
    [1, false],
    [0, false],
  ] as const) {
    view.rerender(
      <WardFlowProvider initialNow={10000}>
        <ParallelPatientSearch count={count} reverse={reverse} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-patient-search-cockpit")).toHaveTextContent("1 person");
  }
});
it("Patients exact recorded identity survives a refusal-word surname", () => {
  render(
    <WardFlowProvider initialNow={10000}>
      <ParallelPatientSearch />
    </WardFlowProvider>,
  );
  fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: "Synthetic Risk" } });
  expect(screen.queryByTestId("ward-patient-search-refusal")).toBeNull();
  expect(screen.getAllByTestId("ward-patient-search-case-WF-COUNT-A").length).toBeGreaterThan(0);
  fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: "risk score" } });
  expect(screen.getByTestId("ward-patient-search-refusal")).toBeInTheDocument();
});

it("partitions one person across state filters while retaining both request links", () => {
  render(
    <WardFlowProvider initialNow={10000}>
      <ParallelPatientSearch mixed />
    </WardFlowProvider>,
  );
  const states = within(screen.getByRole("radiogroup", { name: "Where people are now" }));
  expect(states.getByRole("radio", { name: /^Everyone/ })).toHaveTextContent("1");
  expect(states.getByRole("radio", { name: /^In ED/ })).toHaveTextContent("0");
  const placement = states.getByRole("radio", { name: /^In placement/ });
  expect(placement).toHaveTextContent("1");
  fireEvent.click(placement);
  expect(screen.getAllByTestId("ward-patient-search-case-WF-COUNT-A").length).toBeGreaterThan(0);
  expect(screen.getAllByTestId("ward-patient-search-case-WF-COUNT-B").length).toBeGreaterThan(0);
  fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: "WF-COUNT-A" } });
  expect(states.getByRole("radio", { name: /^In placement/ })).toHaveTextContent("1");
  expect(screen.getAllByTestId("ward-patient-search-case-WF-COUNT-A").length).toBeGreaterThan(0);
});
