import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClass } from "@/components/wf";
import { ReferralMatchView } from "@/components/ward-management/referrals/referral-match";
import { WardArrivalsCorridor } from "@/components/ward-management/ward/ward-arrivals-corridor";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENDER_PLACEMENT_REASONS, OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { MatchRow } from "@/components/ward-management/referrals/referral-match-rows";
import { REFERRAL_DECLINE_REASONS } from "@/components/ward-management/ward-model";

function expectPlacement(button: HTMLElement, variant: "pri" | "sec") {
  expect(button).toHaveAttribute("data-placement-action");
  for (const name of buttonClass({ variant, size: "md" }).split(" ")) expect(button).toHaveClass(name);
}

function referralFixture() {
  const state = seedWardFlowState();
  const base = state.referrals.find((r) => r.destinations.some((d) => d.destination.kind === "psychiatric_ward"))!;
  return {
    ...base,
    ageBand: "Adult" as const,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward" as const,
          sex: "Female" as const,
          gender: "Female" as const,
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued" as const,
      },
    ],
  };
}

function renderReferral(phone = false, units = allUnits()) {
  const dispatch = vi.fn();
  render(
    <ReferralMatchView
      referral={referralFixture()}
      units={units}
      now={NOW_ANCHOR}
      dispatch={dispatch}
      rejections={[]}
      {...(phone ? { phone: <span>Phone extras</span> } : {})}
    />,
  );
  return dispatch;
}

function renderPull(available: boolean) {
  const state = seedWardFlowState();
  const base = state.movements.find((m) => m.stage === "accepted_awaiting_bed" && m.acceptedUnitId)!;
  const originalUnit = state.units.find((u) => u.id === base.acceptedUnitId)!;
  const unit = { ...originalUnit, allocatable: { ...originalUnit.allocatable, value: available ? 1 : 0 } };
  const onPullPatient = vi.fn();
  const dispatch = vi.fn();
  render(
    <WardArrivalsCorridor
      unit={unit}
      accepted={[base]}
      now={NOW_ANCHOR}
      resolvePatientIdentity={() => ({
        displayName: "Synthetic patient",
        formalName: "Synthetic patient",
        initials: "SP",
        umrn: "UM000001",
      })}
      releaseOpenFor={undefined}
      toggleRelease={vi.fn()}
      releaseReason={undefined}
      setReleaseReason={vi.fn()}
      submitRelease={vi.fn()}
      lastActionRejection={undefined}
      dispatch={dispatch}
      setCheckToken={vi.fn()}
      priorRejectionCountRef={{ current: 0 }}
      rejections={[]}
      overrideReasonForm={() => null}
      onPullPatient={onPullPatient}
    />,
  );
  return { onPullPatient, dispatch, movement: base, unit };
}

describe("canonical placement actions", () => {
  it("accepts only the candidate explicitly chosen by the coordinator", () => {
    const dispatch = renderReferral();
    // D-77: desktop uses the phone's one list. A ward is picked, then the one Accept names it.
    const fit = document.querySelector<HTMLButtonElement>(
      'button[data-testid^="ward-referral-match-phone-cand-"][data-kind="yes"]',
    )!;
    fireEvent.click(fit);
    const accept = screen.getByRole("button", { name: /^Accept at / });
    expectPlacement(accept, "pri");
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(accept);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: "ACCEPT_REFERRAL", destinationKind: "psychiatric_ward" });
  });

  it("keeps decline discoverable and dispatches only after a clinical reason is selected", () => {
    const dispatch = renderReferral();
    // D-77: Decline opens the reasons as radio rows, on desktop as on the phone.
    fireEvent.click(screen.getByTestId("ward-referral-match-decline-open"));
    const decline = screen.getByTestId("ward-referral-match-decline");
    expectPlacement(decline, "sec");
    expect(decline).toHaveAttribute("aria-disabled", "true");
    expect(decline).not.toBeDisabled();
    expect(decline).toHaveAccessibleDescription(/choose the reason/i);
    fireEvent.click(decline);
    expect(dispatch).not.toHaveBeenCalled();
    const reason = REFERRAL_DECLINE_REASONS[0]!;
    fireEvent.click(screen.getByTestId(`ward-referral-match-phone-decline-${reason}`));
    fireEvent.click(screen.getByTestId("ward-referral-match-decline"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: "DECLINE_REFERRAL", reason });
  });

  it("explains a missing phone candidate without dispatching acceptance", () => {
    const dispatch = renderReferral(true, []);
    const accept = screen.getByTestId("ward-referral-match-phone-accept");
    expectPlacement(accept, "pri");
    expect(accept).toHaveAccessibleDescription("No unit to accept at in this network.");
    fireEvent.click(accept);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // Audit 1, Josh 20 Oct (CS-03, WP-05): the phone sheet starts with no ward picked.
  it("starts the phone sheet with no ward picked and Accept waiting for a choice", () => {
    const dispatch = renderReferral(true);
    const accept = screen.getByTestId("ward-referral-match-phone-accept");
    expect(accept).toHaveTextContent("Choose a ward first");
    expect(accept).toHaveAccessibleDescription("Choose a ward first.");
    expect(screen.queryByText(/^Accept at /u)).toBeNull();
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    expect(radios.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
    fireEvent.click(accept);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.click(radios[0]!);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("ward-referral-match-phone-accept")).toHaveTextContent(/^Accept at /u);
  });

  it("keeps a blocked Pull focusable and explains actual bed availability", () => {
    const { onPullPatient, dispatch, unit } = renderPull(false);
    const pull = screen.getByRole("button", { name: "Pull the bed" });
    expectPlacement(pull, "pri");
    expect(pull).not.toBeDisabled();
    expect(pull).toHaveAttribute("aria-disabled", "true");
    expect(pull).toHaveAccessibleDescription(`No allocatable bed remains at ${unit.name}.`);
    fireEvent.click(pull);
    expect(onPullPatient).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("preserves the existing explicit Pull callback", () => {
    const { onPullPatient, movement, unit } = renderPull(true);
    const pull = screen.getByRole("button", { name: "Pull the bed" });
    expectPlacement(pull, "pri");
    expect(onPullPatient).not.toHaveBeenCalled();
    fireEvent.click(pull);
    expect(onPullPatient).toHaveBeenCalledExactlyOnceWith(movement.id, unit.id);
  });

  it("blocks a loading placement submit while retaining its accessible busy state", () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button type="submit" data-placement-action variant="pri" size="md" loading>
          Accept referral
        </Button>
      </form>,
    );
    const accept = screen.getByRole("button", { name: "Accept referral" });
    expect(accept).toHaveAttribute("aria-busy", "true");
    fireEvent.click(accept);
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("candidate placement documentation", () => {
  it("requires both a reason and ward confirmation for a placement-review submit", () => {
    const unit = allUnits().find((u) => u.id === "rph-adult-secure")!;
    const onAccept = vi.fn();
    render(
      <ul>
        <MatchRow
          candidate={{ unit, verdict: { eligible: true, gates: [] } }}
          bandText="Synthetic travel band"
          onAccept={onAccept}
          needsGenderPlacement
        />
      </ul>,
    );
    const form = screen.getByTestId(`ward-referral-match-gender-placement-form-${unit.id}`);
    let submit = screen.getByRole("button", { name: `Record reason and accept at ${unit.name}` });
    expectPlacement(submit, "pri");
    expect(submit).toHaveAccessibleDescription("Choose a placement reason before accepting.");
    fireEvent.click(submit);
    fireEvent.submit(form);
    expect(onAccept).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(`ward-referral-match-gender-placement-reason-${unit.id}`), {
      target: { value: GENDER_PLACEMENT_REASONS[0] },
    });
    submit = screen.getByRole("button", { name: `Record reason and accept at ${unit.name}` });
    expect(submit).toHaveAccessibleDescription(
      "Confirm you have checked this placement with the ward before accepting.",
    );
    fireEvent.click(submit);
    fireEvent.submit(form);
    expect(onAccept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(`ward-referral-match-gender-placement-checked-${unit.id}`));
    submit = screen.getByRole("button", { name: `Record reason and accept at ${unit.name}` });
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submit);
    expect(onAccept).toHaveBeenCalledExactlyOnceWith(unit.id, undefined, GENDER_PLACEMENT_REASONS[0], true);
  });

  it("records the chosen override reason and cannot accept before a reason is supplied", () => {
    const unit = allUnits().find((u) => u.id === "rph-adult-secure")!;
    const onAccept = vi.fn();
    render(
      <ul>
        <MatchRow
          candidate={{
            unit,
            verdict: { eligible: false, gates: [{ gate: "cohort", pass: false, detail: "Synthetic mismatch" }] },
          }}
          bandText="Synthetic travel band"
          onAccept={onAccept}
          needsGenderPlacement={false}
        />
      </ul>,
    );
    let accept = screen.getByTestId(`ward-referral-match-override-accept-${unit.id}`);
    expectPlacement(accept, "pri");
    expect(accept).toHaveAttribute("aria-disabled", "true");
    expect(accept).toHaveAccessibleDescription(/reason/i);
    fireEvent.click(accept);
    expect(onAccept).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId(`ward-referral-match-override-reason-${unit.id}`), {
      target: { value: OVERRIDE_REASONS[0] },
    });
    accept = screen.getByTestId(`ward-referral-match-override-accept-${unit.id}`);
    fireEvent.click(accept);
    expect(onAccept).toHaveBeenCalledExactlyOnceWith(unit.id, OVERRIDE_REASONS[0]);
  });
});

describe("stopped transport: release pulled bed asks first (Audit 1, CS-07)", () => {
  it("names the person and UMRN, and records nothing on Cancel", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.acceptedUnitId)!;
    const unit = state.units.find((u) => u.id === movement.acceptedUnitId)!;
    const dispatch = vi.fn();
    render(
      <WardArrivalsCorridor
        unit={unit}
        accepted={[]}
        heldAfterStop={[movement]}
        now={NOW_ANCHOR}
        resolvePatientIdentity={() => ({
          displayName: "Synthetic patient",
          formalName: "PATIENT, Synthetic",
          initials: "SP",
          umrn: "UM000001",
        })}
        releaseOpenFor={undefined}
        toggleRelease={vi.fn()}
        releaseReason={undefined}
        setReleaseReason={vi.fn()}
        submitRelease={vi.fn()}
        lastActionRejection={undefined}
        dispatch={dispatch}
        setCheckToken={vi.fn()}
        priorRejectionCountRef={{ current: 0 }}
        rejections={[]}
        overrideReasonForm={() => null}
      />,
    );
    fireEvent.click(screen.getByTestId(`ward-release-stopped-bed-${movement.id}`));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-release-stopped-identity")).toHaveTextContent(
      "Check: PATIENT, Synthetic · UM000001",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`ward-release-stopped-bed-${movement.id}`));
    fireEvent.click(screen.getByRole("button", { name: "Release pulled bed" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: "RELEASE_HELD_BED", movementId: movement.id });
  });
});
