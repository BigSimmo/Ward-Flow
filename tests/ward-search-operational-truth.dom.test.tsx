import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/mockups/ward-flow/search",
}));
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { isOpen } from "@/components/ward-management/ward-derivations";
const seed = seedWardFlowState();
function search(movementId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
    </WardFlowProvider>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: movementId } });
  return [screen.getByTestId(`ward-patient-search-case-${movementId}`)];
}
describe("search operational facts on visible cards", () => {
  it("Joondalup movement should show its recorded North Metro service", () => {
    const movement = seed.movements.find((m) => m.originEdId === "jhc-ed" && isOpen(m))!;
    expect(movement).toBeDefined();
    const rows = search(movement.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("North Metro");
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "North Metro" } });
    expect(screen.getByTestId(`ward-patient-search-case-${movement.id}`)).toHaveTextContent("North Metro");
  });
  it("booked but not collected movement should not be labelled In Transit", () => {
    const movement = seed.movements.find(
      (m) =>
        isOpen(m) &&
        m.transport !== undefined &&
        m.transport.collectedAt === undefined &&
        m.transport.cancelledAt === undefined &&
        m.stage !== "moving",
    )!;
    expect(movement).toBeDefined();
    const rows = search(movement.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveTextContent("In-Transit");
    expect(screen.getByRole("region", { name: "Patient details" })).not.toHaveTextContent("Vehicle dispatched");
    fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "ed" } });
    expect(screen.getByTestId(`ward-patient-search-case-${movement.id}`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "transit" } });
    expect(screen.queryByTestId(`ward-patient-search-case-${movement.id}`)).not.toBeInTheDocument();
  });
});

it("a collected movement is visible in the transit filter and excluded from ED", () => {
  const movement = seed.movements.find(
    (m) => isOpen(m) && m.transport?.collectedAt !== undefined && m.transport.cancelledAt === undefined,
  )!;
  expect(movement).toBeDefined();
  search(movement.id);
  fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "transit" } });
  expect(screen.getByTestId(`ward-patient-search-case-${movement.id}`)).toHaveTextContent("In-Transit");
  expect(screen.getByRole("region", { name: "Patient details" })).toHaveTextContent("Collected");
  fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "ed" } });
  expect(screen.queryByTestId(`ward-patient-search-case-${movement.id}`)).not.toBeInTheDocument();
});

function AcceptanceHarness() {
  const { patients, movements, dispatch, now, admissions, rejections } = useWardFlow();
  const patient = patients.at(-1)!;
  const movement = movements.at(-1)!;
  return (
    <>
      <button
        onClick={() =>
          dispatch({
            type: "ADD_PATIENT",
            role: "coordinator",
            now,
            umrn: "SYN-HIST-SEARCH",
            givenName: "Synthetic",
            familyName: "Search",
            dateOfBirth: "1980-01-01",
          })
        }
      >
        probe add
      </button>
      <button
        onClick={() =>
          dispatch({
            type: "RAISE_REFERRAL",
            role: "ed",
            now,
            edId: "jhc-ed",
            patientId: patient.id,
            draft: {
              cohort: "Adult",
              security: "Open",
              sex: "Female",
              gender: "Female",
              specialling: false,
              highAcuity: false,
              legalStatus: "Voluntary",
              urgency: 2,
              legalFormCode: null,
            },
          })
        }
      >
        probe raise
      </button>
      <button
        onClick={() =>
          dispatch({
            type: "REFER_TO_UNITS",
            role: "coordinator",
            now,
            movementId: movement.id,
            unitIds: ["scgh-adult-open"],
          })
        }
      >
        probe refer
      </button>
      <button
        onClick={() =>
          dispatch({
            type: "ACCEPT_IN_PRINCIPLE",
            role: "ward",
            now,
            movementId: movement.id,
            unitId: "scgh-adult-open",
          })
        }
      >
        probe accept
      </button>
      <output
        data-testid="accept-probe"
        data-mid={movement.id}
        data-stage={movement.stage}
        data-held={admissions.some((a) => a.movementId === movement.id && a.state === "pulled")}
        data-rejections={rejections.length}
      />
    </>
  );
}
it("acceptance in principle does not falsely show a bed hold or current inpatient location", () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PatientSearchPage />
      <AcceptanceHarness />
    </WardFlowProvider>,
  );
  for (const name of ["probe add", "probe raise", "probe refer", "probe accept"])
    fireEvent.click(screen.getByRole("button", { name }));
  const probe = screen.getByTestId("accept-probe");
  expect(probe).toHaveAttribute("data-rejections", "0");
  expect(probe).toHaveAttribute("data-stage", "accepted_awaiting_bed");
  expect(probe).toHaveAttribute("data-held", "false");
  const mid = probe.getAttribute("data-mid")!;
  fireEvent.change(screen.getByRole("textbox", { name: "Search" }), { target: { value: mid } });
  const card = screen.getByTestId(`ward-patient-search-case-${mid}`);
  expect(card).not.toHaveTextContent("Bed hold active");
  expect(card).toHaveTextContent("Accepted, awaiting bed");
  fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "ed" } });
  expect(screen.getByTestId(`ward-patient-search-case-${mid}`)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Setting"), { target: { value: "inpatient" } });
  expect(screen.queryByTestId(`ward-patient-search-case-${mid}`)).not.toBeInTheDocument();
});
