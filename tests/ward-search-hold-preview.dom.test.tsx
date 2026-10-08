import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
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
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { RecordPreview } from "@/components/ward-management/search/record-preview";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function WorkflowHarness() {
  const { dispatch, now, patients, movements, admissions, rejections } = useWardFlow();
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
            umrn: "SYN-PREVIEW-HOLD",
            givenName: "Synthetic",
            familyName: "Preview",
            dateOfBirth: "1980-01-01",
          })
        }
      >
        create
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
        raise
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
        refer
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
        accept
      </button>
      <button
        onClick={() =>
          dispatch({ type: "PULL_PATIENT", role: "ward", now, movementId: movement.id, unitId: "scgh-adult-open" })
        }
      >
        pull
      </button>
      <output
        data-testid="workflow"
        data-mid={movement.id}
        data-held={admissions.some((a) => a.movementId === movement.id && a.state === "pulled")}
        data-rejections={rejections.length}
      />
    </>
  );
}

describe("record preview shares current bed hold truth", () => {
  it("a real visible card selection stays accurate across acceptance and subsequent pull", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
        <WorkflowHarness />
      </WardFlowProvider>,
    );
    for (const name of ["create", "raise", "refer", "accept"])
      fireEvent.click(screen.getByRole("button", { name }));
    const probe = screen.getByTestId("workflow");
    expect(probe).toHaveAttribute("data-rejections", "0");
    expect(probe).toHaveAttribute("data-held", "false");
    const id = probe.getAttribute("data-mid")!;
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: id } });
    fireEvent.click(screen.getByTestId(`ward-patient-search-case-${id}`));
    // The imported legacy preview remains inert in this page's accepted design. Inspect its
    // DOM projection separately from the actual visible Patient details preview.
    const legacy = screen.getByTestId("ward-patient-search-preview");
    expect(legacy).toHaveTextContent("Accepted, awaiting bed");
    expect(legacy).not.toHaveTextContent("Bed hold active");
    expect(screen.getByRole("region", { name: "Patient details" })).toHaveTextContent("Accepted, awaiting bed");
    fireEvent.click(screen.getByRole("button", { name: "pull" }));
    expect(probe).toHaveAttribute("data-held", "true");
    expect(legacy).toHaveTextContent("Bed hold active");
    expect(screen.getByRole("region", { name: "Patient details" })).toHaveTextContent("Bed hold active");
  });

  it("the actual WF-318 authored seed hold appears in both visible details and selected preview", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "WF-318" } });
    fireEvent.click(screen.getByTestId("ward-patient-search-case-WF-318"));
    expect(screen.getByTestId("ward-patient-search-case-WF-318")).toHaveTextContent("Bed hold active");
    expect(screen.getByRole("region", { name: "Patient details" })).toHaveTextContent("Bed hold active");
    expect(screen.getByTestId("ward-patient-search-preview")).toHaveTextContent("Bed hold active");
  });

  it("the person preview reads the linked actual referral journey without inventing a held bed", () => {
    let state = seedWardFlowState();
    const send = (event: WardFlowEvent) => {
      state = wardFlowReducer(state, event);
      expect(state.rejections).toHaveLength(0);
    };
    send({
      type: "ADD_PATIENT",
      role: "coordinator",
      now: NOW_ANCHOR,
      umrn: "SYN-PERSON-PREVIEW",
      givenName: "Synthetic",
      familyName: "Preview",
      dateOfBirth: "1980-01-01",
    });
    const patient = state.patients.at(-1)!;
    send({
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      patientId: patient.id,
      ageBand: "Adult",
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Perth" },
      source: "community",
      urgency: 2,
      originSiteCode: "JHC",
      transportNeeded: false,
      history: "",
      destinations: [{ kind: "emergency_department", edId: "jhc-ed", purpose: "psychiatric_review" }],
    });
    const referralId = state.referrals.at(-1)!.id;
    send({
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      patientId: patient.id,
      referralId,
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
    });
    const movementId = state.movements.at(-1)!.id;
    send({ type: "REFER_TO_UNITS", role: "coordinator", now: NOW_ANCHOR, movementId, unitIds: ["scgh-adult-open"] });
    send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW_ANCHOR, movementId, unitId: "scgh-adult-open" });
    const { rerender } = render(
      <RecordPreview
        selection={{ kind: "person", patient }}
        patients={state.patients}
        movements={state.movements}
        referrals={state.referrals}
        units={state.units}
        admissions={state.admissions}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("ward-patient-search-preview")).toHaveTextContent("Accepted, awaiting bed");
    expect(screen.getByTestId("ward-patient-search-preview")).not.toHaveTextContent("Bed hold active");
    send({ type: "PULL_PATIENT", role: "ward", now: NOW_ANCHOR, movementId, unitId: "scgh-adult-open" });
    rerender(
      <RecordPreview
        selection={{ kind: "person", patient }}
        patients={state.patients}
        movements={state.movements}
        referrals={state.referrals}
        units={state.units}
        admissions={state.admissions}
        now={NOW_ANCHOR}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("ward-patient-search-preview")).toHaveTextContent("Bed hold active");
  });
});
