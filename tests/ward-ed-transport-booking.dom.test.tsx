import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

// Same reason as the sibling dom suites (ward-ed-screen.dom.test.tsx, ward-screen.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { LEGAL_STATUS_CHANGE_REASONS, OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { TRANSPORT_PROVIDERS, type Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE BOOKING CONTROL ON THE ED SCREEN, AND THE ONE THING IT MUST NEVER DO.
 *
 * `TR-D1` (owner, 2026-08-30) puts the booking on the sending team, because that team knows the
 * two facts a booking needs — who is collecting, and whether this person needs an escort.
 *
 * ⚠️ **THE ESCORT QUESTION OPENS BLANK, BY THE OWNER'S OWN RULING** (relayed 2026-08-30), taken
 * after the trade-off was put to him as a clinician. **A pre-filled clinical judgement is answered
 * by clicking past it**, and the record then asserts that a clinician decided when nobody did —
 * worse than the honest derivation it replaces, because it launders an automatic value through a
 * human's name. `tests/ward-book-transport.test.ts` pins the model half (the event REQUIRES an
 * answer); this file pins the half a convention in one component would otherwise be the only thing
 * holding: that the SCREEN offers no answer, from legal status or from anywhere else.
 *
 * ⚠️ **THE FIXTURE IS CHOSEN SO A PRE-FILL WOULD BE VISIBLE.** The first held bed in the seed
 * belongs to a patient the deleted derivation would have escorted (`legalStatus !== "Voluntary"`),
 * which the first test asserts before it asserts anything else. Against a Voluntary patient the
 * blank-radio checks below would pass whether or not somebody wired `legalStatus` back in.
 *
 * Everything here is driven through the real screen, the real provider and the real reducer.
 * Nothing dispatches directly: the panel is opened, the fields are set and the control is pressed
 * exactly as a clinician would, and the result is read back through `useWardFlow`.
 */
function heldBedMovement(): Movement {
  const movement = seedWardFlowState().movements.find(
    (candidate) => candidate.stage === "pulled" && candidate.transport === undefined,
  );
  expect(
    movement,
    "the fixture must hold an unbooked movement with a bed held, or nothing here is exercised",
  ).toBeDefined();
  return movement!;
}

/** A movement at the SAME department that is not at `pulled` — the stage guard's own case,
 *  discovered rather than named, so a fixture change cannot leave this suite asserting nothing. */
function notHeldMovementAtSameEd(edId: string): Movement {
  const movement = seedWardFlowState().movements.find(
    (candidate) =>
      candidate.originEdId === edId &&
      candidate.stage !== "pulled" &&
      candidate.stage !== "arrived" &&
      candidate.closure === undefined,
  );
  expect(
    movement,
    `the fixture must hold a non-held open movement at ${edId}, or the stage guard is untested`,
  ).toBeDefined();
  return movement!;
}

/** Reads the booked job and the reducer's refusals back out of live state. `rejections` is the
 *  half that matters most: a control that dispatched something the reducer refused would look
 *  identical on screen to one that did nothing, which is the silent-refusal defect this repo has
 *  hit before. */
function TransportProbe({ movementId }: { movementId: string }) {
  const { movements, rejections } = useWardFlow();
  const transport = movements.find((movement) => movement.id === movementId)?.transport;
  return (
    <p data-testid="transport-probe">
      {transport
        ? `${transport.provider}|escort=${transport.escortRequired}|cad=${transport.cadNumber}|status=${transport.transportLegalStatus}|estimatedAt=${transport.estimatedAt}`
        : "no-transport"}
      |rejections=
      {rejections.length}
    </p>
  );
}

function renderEdFor(movement: Movement) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={movement.originEdId} />
      <TransportProbe movementId={movement.id} />
    </WardFlowProvider>,
  );
}

const escortRadios = (movementId: string) => ({
  yes: screen.getByTestId(`ward-ed-transport-escort-yes-${movementId}`),
  no: screen.getByTestId(`ward-ed-transport-escort-no-${movementId}`),
});

/**
 * Owner's third ruling, 2026-09-17: the three facts logged from the phone call — the popup's whole
 * reason to exist. `"today"` is the draft's own opening selection, so no day radio needs clicking
 * for the ordinary case.
 */
function fillPhoneLoggedFields(movementId: string, cadNumber: string, status: "voluntary" | "involuntary") {
  fireEvent.change(screen.getByTestId(`ward-ed-transport-cad-number-${movementId}`), {
    target: { value: cadNumber },
  });
  fireEvent.click(screen.getByTestId(`ward-ed-transport-legal-status-${status}-${movementId}`));
  fireEvent.change(screen.getByTestId(`ward-ed-transport-estimated-time-${movementId}`), {
    target: { value: "14:30" },
  });
}

describe("booking transport from the sending emergency department", () => {
  it("⚠️ OPENS THE ESCORT QUESTION BLANK, for a patient the deleted derivation would have escorted", () => {
    const movement = heldBedMovement();
    // Stated first, because every assertion below is only meaningful against this patient: the
    // derivation being replaced (`escortRequired: movement.legalStatus !== "Voluntary"`) would
    // have pre-selected "Escort required" here.
    expect(
      movement.legalStatus,
      "this fixture no longer bites — pick a held bed whose patient the old derivation would have escorted",
    ).not.toBe("Voluntary");

    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));

    const escort = escortRadios(movement.id);
    expect(escort.yes).not.toBeChecked();
    expect(escort.no).not.toBeChecked();

    // Non-vacuity: there really are two answers on screen, so an empty fieldset could not pass the
    // two checks above by rendering nothing at all.
    const offered = screen.getByTestId(`ward-ed-transport-escort-${movement.id}`).querySelectorAll("input[type=radio]");
    expect(offered).toHaveLength(2);
  });

  it("offers every declared provider and none of them chosen", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));

    const picker = screen.getByTestId(`ward-ed-transport-provider-${movement.id}`) as HTMLSelectElement;
    expect(picker.value, "a provider nobody chose is the same unmade claim as a pre-filled escort answer").toBe("");

    // Derived from the exported array, in its declared order — a hand-written options list is how
    // a cohort was silently omitted from this screen once before.
    const offered = [...picker.options].slice(1).map((option) => option.value);
    expect(offered).toEqual([...TRANSPORT_PROVIDERS]);
    expect(offered.length, "non-vacuity: an emptied list could not pass the comparison above").toBeGreaterThan(2);
  });

  it("⚠️ REFUSES TO OFFER A BOOKING WHILE THE ESCORT QUESTION IS UNANSWERED, and says why", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[0] },
    });

    const confirm = screen.getByTestId(`ward-ed-book-transport-confirm-${movement.id}`);
    // `aria-disabled` and NOT the native attribute: the reason has to stay reachable by keyboard,
    // and the two together is the shape `require-button-wiring` fails.
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).not.toHaveAttribute("disabled");
    const reasonId = confirm.getAttribute("aria-describedby");
    expect(reasonId, "an unavailable control with no reachable reason is the defect, not the fix").toBeTruthy();
    expect(document.getElementById(reasonId!)?.textContent ?? "").toContain("escort");

    // Pressing it books nothing AND refuses nothing: a dispatch the reducer rejected would leave
    // the screen looking exactly like this one while a rejection piled up behind it.
    fireEvent.click(confirm);
    expect(screen.getByTestId("transport-probe")).toHaveTextContent("no-transport|rejections=0");
  });

  /**
   * THE POPUP, END TO END — owner's third ruling, 2026-09-17: opens, is filled with the three
   * phone-logged facts, submits, and the booked job (including those three facts) shows in state.
   */
  it("books the answer the clinician gave — including no escort for a detained patient, and logs the CAD number, status and time", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`);
    fireEvent.click(toggle);

    const dialog = screen.getByTestId(`ward-ed-book-transport-${movement.id}`);
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", `ward-ed-book-transport-title-${movement.id}`);
    expect(document.getElementById(`ward-ed-book-transport-title-${movement.id}`)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[1] },
    });
    fireEvent.click(escortRadios(movement.id).no);
    fillPhoneLoggedFields(movement.id, "CAD-9911", "involuntary");

    const confirm = screen.getByTestId(`ward-ed-book-transport-confirm-${movement.id}`);
    expect(confirm, "every question is answered, so the control must be available").not.toHaveAttribute(
      "aria-disabled",
    );
    fireEvent.click(confirm);

    // `escort=false` is an ANSWER, and it survives for a patient whose legal status would have
    // produced `true`. `rejections=0` proves the screen dispatched as a role the reducer permits —
    // a coordinator dispatch would have been refused at the role gate and shown here. The CAD
    // number and status are the two facts the popup exists to log; `estimatedAt` is a real number
    // (not `undefined`), proving the typed "14:30, today" resolved to a real instant.
    const probe = screen.getByTestId("transport-probe");
    expect(probe).toHaveTextContent(`${TRANSPORT_PROVIDERS[1]}|escort=false`);
    expect(probe).toHaveTextContent("cad=CAD-9911");
    expect(probe).toHaveTextContent("status=involuntary");
    expect(probe).toHaveTextContent("|rejections=0");
    expect(probe.textContent).not.toContain("estimatedAt=undefined");

    // And the popup itself is gone once booked, so there is no dialog left to trap focus in.
    expect(screen.queryByTestId(`ward-ed-book-transport-${movement.id}`)).toBeNull();
  });

  it("Escape closes the popup without booking, and reopening starts blank again", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-cad-number-${movement.id}`), {
      target: { value: "CAD-SHOULD-NOT-SAVE" },
    });

    fireEvent.keyDown(screen.getByTestId(`ward-ed-book-transport-${movement.id}`), { key: "Escape" });
    expect(screen.queryByTestId(`ward-ed-book-transport-${movement.id}`)).toBeNull();
    expect(screen.getByTestId("transport-probe")).toHaveTextContent("no-transport|rejections=0");

    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));
    expect((screen.getByTestId(`ward-ed-transport-cad-number-${movement.id}`) as HTMLInputElement).value).toBe("");
  });

  it("⚠️ WILL NOT OFFER A SECOND BOOKING once a job exists — it is cancel-then-rebook, not rebook", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`));
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[0] },
    });
    fireEvent.click(escortRadios(movement.id).yes);
    fillPhoneLoggedFields(movement.id, "CAD-1200", "voluntary");
    fireEvent.click(screen.getByTestId(`ward-ed-book-transport-confirm-${movement.id}`));
    expect(screen.getByTestId("transport-probe")).toHaveTextContent(`${TRANSPORT_PROVIDERS[0]}|escort=true`);

    // The movement stays at `pulled` after a booking, so this card is exactly where a second
    // booking would be attempted — and the control must now be unavailable rather than replacing
    // a job the provider may already have accepted.
    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`);
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toHaveAttribute("disabled");
    const reasonId = toggle.getAttribute("aria-describedby");
    expect(document.getElementById(reasonId!)?.textContent ?? "").toContain("cancelled");

    // And pressing it opens nothing, so there is no second panel to book from.
    fireEvent.click(toggle);
    expect(screen.queryByTestId(`ward-ed-book-transport-${movement.id}`)).toBeNull();
  });

  it("⚠️ CARRIES NOTHING OVER when the panel is reopened — a remembered answer is a derived one", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`);

    fireEvent.click(toggle);
    fireEvent.change(screen.getByTestId(`ward-ed-transport-provider-${movement.id}`), {
      target: { value: TRANSPORT_PROVIDERS[0] },
    });
    fireEvent.click(escortRadios(movement.id).yes);
    fireEvent.change(screen.getByTestId(`ward-ed-transport-cad-number-${movement.id}`), {
      target: { value: "CAD-CARRY-OVER" },
    });
    expect(
      escortRadios(movement.id).yes,
      "non-vacuity: the answer must actually take, or reopening proves nothing",
    ).toBeChecked();

    fireEvent.click(toggle); // closes
    fireEvent.click(toggle); // reopens

    const reopened = escortRadios(movement.id);
    expect(reopened.yes).not.toBeChecked();
    expect(reopened.no).not.toBeChecked();
    expect((screen.getByTestId(`ward-ed-transport-provider-${movement.id}`) as HTMLSelectElement).value).toBe("");
    expect((screen.getByTestId(`ward-ed-transport-cad-number-${movement.id}`) as HTMLInputElement).value).toBe("");
  });

  it("does not offer a booking outside stage pulled, and names the stage it is at", () => {
    const held = heldBedMovement();
    const other = notHeldMovementAtSameEd(held.originEdId);
    renderEdFor(other);

    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${other.id}`);
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(toggle).not.toHaveAttribute("disabled");
    const reasonId = toggle.getAttribute("aria-describedby");
    expect(document.getElementById(reasonId!)?.textContent ?? "").toContain("not bed pulled");
    expect(screen.queryByTestId(`ward-ed-book-transport-${other.id}`)).toBeNull();
  });
});

/**
 * WLQ-5 (owner ruling, 2026-09-15): a WARNING, never a block, beside the booking control when
 * transport is about to be booked for an involuntary patient with no Form 4A recorded.
 *
 * Three patients, three outcomes, and the booking control stays enabled in all three — the
 * warning is informational only, and this suite is what would catch it quietly turning into a
 * block. Everything is driven through the real screen, the real provider and the real reducer,
 * the same discipline the rest of this file holds to.
 */
describe("the no-4A-recorded notice beside the booking control", () => {
  const NOTICE_4A = legalFormName({ code: "4A", kind: "transport" });

  it("appears for an involuntary patient with a held bed and no Form 4A recorded", () => {
    const movement = heldBedMovement();
    // Non-vacuity for the sentence below: the fixture's held bed is involuntary and its legal
    // form is a 4C, never a 4A — the exact shape this notice exists to name.
    expect(movement.legalStatus).not.toBe("Voluntary");
    expect(movement.legalForm?.code).not.toBe("4A");

    renderEdFor(movement);

    const notice = screen.getByTestId(`ward-ed-transport-legal-form-notice-${movement.id}`);
    expect(notice.textContent).toContain(`No ${NOTICE_4A} is recorded for this patient.`);
    // Never a duration, never a claim about the Act — the two phrases this file's own screen
    // banner and `ED_ACCESS_TARGET_MINUTES`'s comment both forbid.
    expect(notice.textContent).not.toMatch(/hour|minute|day|deadline|due|overdue|breach|must be/i);

    // And the control itself must stay fully available — a warning, not a block.
    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`);
    expect(toggle).not.toHaveAttribute("aria-disabled");
  });

  it("is absent for a voluntary patient, and the booking control stays enabled", () => {
    const movement = heldBedMovement();
    renderEdFor(movement);
    expect(screen.getByTestId(`ward-ed-transport-legal-form-notice-${movement.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`ward-change-legal-status-toggle-${movement.id}`));
    const form = within(screen.getByTestId(`ward-change-legal-status-${movement.id}`));
    fireEvent.change(form.getByLabelText(`Legal status for ${seedPatientName(movement.id)}`), {
      target: { value: "Voluntary" },
    });
    fireEvent.change(form.getByLabelText("Reason"), {
      target: { value: LEGAL_STATUS_CHANGE_REASONS[0] },
    });
    fireEvent.click(form.getByRole("button", { name: "Record legal status change" }));

    expect(screen.queryByTestId(`ward-ed-transport-legal-form-notice-${movement.id}`)).toBeNull();
    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movement.id}`);
    expect(toggle).not.toHaveAttribute("aria-disabled");
  });

  /**
   * The fixture holds no `pulled`-stage movement carrying a 4A — every seeded 4A is already
   * `moving` with transport booked (the exact state this notice must never speak about). So this
   * test raises a fresh journey with a 4A chosen on intake and drives it to `pulled` through the
   * real reducer, `overrideReason` skipping the two placement events' eligibility judgement (the
   * same escape hatch a coordinator has at 3am) so the physical facts — a real unit with an
   * allocatable bed — are what this test actually depends on, not a fabricated eligibility path.
   */
  function Setup4ABooking({ edId }: { edId: string }) {
    const { dispatch, movements } = useWardFlow();
    const created = movements.find((candidate) => candidate.originEdId === edId && candidate.legalForm?.code === "4A");
    return (
      <div>
        <button
          type="button"
          data-testid="setup-raise-4a"
          onClick={() =>
            dispatch({
              type: "RAISE_REFERRAL",
              role: "ed",
              now: NOW_ANCHOR,
              edId,
              draft: {
                cohort: "Adult",
                security: "Secure",
                sex: "Female",
                gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
                specialling: false,
                highAcuity: false,
                legalStatus: "Involuntary inpatient",
                urgency: 2,
                legalFormCode: "4A",
              },
            })
          }
        >
          raise
        </button>
        {created ? (
          <>
            <button
              type="button"
              data-testid="setup-refer-4a"
              onClick={() =>
                dispatch({
                  type: "REFER_TO_UNITS",
                  role: "coordinator",
                  now: NOW_ANCHOR,
                  movementId: created.id,
                  unitIds: ["rph-adult-secure"],
                  overrideReason: OVERRIDE_REASONS[0],
                })
              }
            >
              refer
            </button>
            <button
              type="button"
              data-testid="setup-accept-4a"
              onClick={() =>
                dispatch({
                  type: "ACCEPT_IN_PRINCIPLE",
                  role: "ward",
                  now: NOW_ANCHOR,
                  movementId: created.id,
                  unitId: "rph-adult-secure",
                  overrideReason: OVERRIDE_REASONS[0],
                })
              }
            >
              accept
            </button>
            <button
              type="button"
              data-testid="setup-pull-4a"
              onClick={() =>
                dispatch({
                  type: "PULL_PATIENT",
                  role: "ward",
                  now: NOW_ANCHOR,
                  movementId: created.id,
                  unitId: "rph-adult-secure",
                })
              }
            >
              pull
            </button>
            <p data-testid="setup-4a-movement-id">{created.id}</p>
          </>
        ) : null}
      </div>
    );
  }

  it("is absent for a patient who already has a Form 4A recorded, and the booking control stays enabled", () => {
    const edId = allEmergencyDepartments()[0].id;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdScreen edId={edId} />
        <Setup4ABooking edId={edId} />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByTestId("setup-raise-4a"));
    const movementId = screen.getByTestId("setup-4a-movement-id").textContent;
    expect(
      movementId,
      "the referral must have been raised and carry the 4A, or nothing below is exercised",
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("setup-refer-4a"));
    fireEvent.click(screen.getByTestId("setup-accept-4a"));
    fireEvent.click(screen.getByTestId("setup-pull-4a"));

    const toggle = screen.getByTestId(`ward-ed-book-transport-toggle-${movementId}`);
    expect(
      toggle,
      "the setup chain must have reached stage pulled, or the control below proves nothing",
    ).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByTestId(`ward-ed-transport-legal-form-notice-${movementId}`)).toBeNull();
  });
});

// Owner, 26 Sept 2026: labels name the patient, resolved from the seed register, not the WF number.
function seedPatientName(movementId: string): string {
  const seed = seedWardFlowState();
  return resolveSubjectPatient(seed.movements.find((movement) => movement.id === movementId), seed).displayName;
}
