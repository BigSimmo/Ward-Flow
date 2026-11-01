import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithToasts as render } from "./helpers/with-toasts";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as tests/ward-screen.dom.test.tsx: the ward screen renders next/link anchors and
// jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/**
 * Josh, 26 Sept 2026 (answer 1A): "Discharged" records the person the release row already names,
 * and never guesses. tests/ward-screen.dom.test.tsx proves nothing is recorded before a destination
 * is chosen. This file proves the rest: the departure written is the release's OWN admission and no
 * other occupant of the ward moves, and a refused departure says why and changes nothing.
 */

function legalStatusOf(admissionId: string): string | undefined {
  const admission = wardAdmissions.find((candidate) => candidate.id === admissionId);
  return wardPatients.find((patient) => patient.id === admission?.patientId)?.legalStatus;
}

/** The reducer's own test for involuntary status (`patientRecordIsInvoluntary`, ward-flow-reducer.ts). */
function isInvoluntary(status: string | undefined): boolean {
  if (status === undefined) return false;
  return status.trim().toLowerCase().startsWith("involuntary") || status === "Detained awaiting examination";
}

/** An unblocked "expected" release: the ward screen's "Expected to Free" list shows every one. */
function expectedRelease(predicate: (legalStatus: string | undefined) => boolean) {
  return bedReleases.find(
    (release) =>
      release.state === "expected" && release.blocker === null && predicate(legalStatusOf(release.admissionId)),
  );
}

const VOLUNTARY_RELEASE = expectedRelease((status) => status === "Voluntary");
const INVOLUNTARY_RELEASE = expectedRelease(isInvoluntary);

/** Reads the live state for one ward, so each test can see exactly who changed. */
function WardProbe({ unitId, admissionId }: { unitId: string; admissionId: string }) {
  const { admissions, rejections, resolvePatientIdentity } = useWardFlow();
  const named = admissions.find((admission) => admission.id === admissionId);
  const others = admissions.filter((admission) => admission.unitId === unitId && admission.id !== admissionId);
  return (
    <>
      <output data-testid="named-state">{`${named?.state}|${named?.leavingDestination ?? ""}`}</output>
      <output data-testid="named-name">{resolvePatientIdentity(named).formalName}</output>
      <output data-testid="others">{others.map((admission) => `${admission.id}:${admission.state}`).join(" ")}</output>
      <output data-testid="rejections">{rejections.length}</output>
      <output data-testid="last-rejection">{rejections.at(-1)?.reason ?? ""}</output>
    </>
  );
}

function renderWard(release: NonNullable<typeof VOLUNTARY_RELEASE>) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardProbe unitId={release.unitId} admissionId={release.admissionId} />
      <WardScreen unitId={release.unitId} />
    </WardFlowProvider>,
  );
}

function openAndPick(admissionId: string, destination: string) {
  const card = document.querySelector(`[data-admission-id="${admissionId}"]`);
  expect(card, "the occupied stay is on a bed card").not.toBeNull();
  fireEvent.click(card as HTMLElement);
  fireEvent.change(screen.getByLabelText(/Where are they going/i), { target: { value: destination } });
}

/** The Perth wall clock `minutes` before the provider's now, as a datetime-local field takes it. */
function perthLocalBefore(dayZero: Date, minutes: number): string {
  const at = new Date(dayZero.getTime() + (NOW_ANCHOR - minutes) * 60_000);
  const part = (type: string) =>
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Perth",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function openAndChoose(admissionId: string, destination: string) {
  openAndPick(admissionId, destination);
  fireEvent.click(screen.getByRole("button", { name: /Record that they have left/i }));
  fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
}

describe("the ward screen's leave list shows no internal id and nothing about the person", () => {
  it("labels each leave bed 'Bed not recorded', with no id and no name", () => {
    const leaveBed = leaveBeds[0];
    expect(leaveBed, "a seeded leave bed").toBeDefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardProbe unitId={leaveBed.unitId} admissionId={leaveBed.admissionId} />
        <WardScreen unitId={leaveBed.unitId} />
      </WardFlowProvider>,
    );
    const row = screen.getByTestId(`ward-leave-card-${leaveBed.id}`);
    expect(row).toHaveTextContent("Bed on leave");
    expect(row).not.toHaveTextContent(leaveBed.id);
    expect(row).not.toHaveTextContent(screen.getByTestId("named-name").textContent ?? "");
  });
});

describe("a bed held for an absence without leave never reads as approved leave (D-38)", () => {
  it("labels the held bed absent since the recorded time, with no expected return", () => {
    const occupied = wardAdmissions.find(
      (admission) =>
        admission.state === "occupied" &&
        admission.patientId &&
        !leaveBeds.some((leaveBed) => leaveBed.admissionId === admission.id),
    );
    expect(occupied, "an occupied stay with no leave bed").toBeDefined();
    function AbsenceProbe() {
      const { dispatch, leaveBeds: live } = useWardFlow();
      const held = live.find((leaveBed) => leaveBed.admissionId === occupied!.id);
      return (
        <>
          <output data-testid="held-bed">{held?.id ?? ""}</output>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "RECORD_ABSENT_WITHOUT_LEAVE",
                role: "ward",
                now: NOW_ANCHOR,
                admissionId: occupied!.id,
                actingUnitId: occupied!.unitId,
              })
            }
          >
            Mark synthetic absence
          </button>
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AbsenceProbe />
        <WardScreen unitId={occupied!.unitId} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark synthetic absence" }));
    const heldId = screen.getByTestId("held-bed").textContent;
    expect(heldId, "the absence holds a bed").toBeTruthy();
    const row = screen.getByTestId(`ward-leave-card-${heldId}`);
    expect(row).toHaveTextContent("Absent without leave");
    expect(row).toHaveTextContent("Absent since");
    expect(row).not.toHaveTextContent("Bed on leave");
    expect(row).not.toHaveTextContent("Expected return");
    const bed = document.querySelector(`[data-admission-id="${occupied!.id}"]`);
    expect(bed, "the held bed is on the bed grid").not.toBeNull();
    expect(bed).toHaveAttribute("data-state", "leave");
    expect(bed).toHaveAccessibleName(/Absent without leave/u);
    expect(bed).not.toHaveAccessibleName(/On leave/u);
  });
});

describe("the ward screen's Discharged step names its patient and never guesses (Josh, 1A)", () => {
  it("finds a voluntary and an involuntary release in the seed, so neither test below can pass vacuously", () => {
    expect(VOLUNTARY_RELEASE, "an unblocked expected release for a voluntary patient").toBeDefined();
    expect(INVOLUNTARY_RELEASE, "an unblocked expected release for an involuntary patient").toBeDefined();
  });

  it("asks about the named person, then records that person leaving and nobody else on the ward", () => {
    const release = VOLUNTARY_RELEASE!;
    renderWard(release);
    const name = screen.getByTestId("named-name").textContent ?? "";
    const othersBefore = screen.getByTestId("others").textContent;
    expect(screen.getByTestId("named-state")).toHaveTextContent(/^occupied\|$/u);

    const card = document.querySelector(`[data-admission-id="${release.admissionId}"]`);
    expect(card, "the release's own stay is on a bed card").not.toBeNull();
    expect(card).toHaveAccessibleName(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(card?.textContent ?? "").not.toContain(release.id);

    fireEvent.click(card as HTMLElement);
    expect(screen.getByLabelText(/Where are they going/i)).toBeInTheDocument();

    openAndChoose(release.admissionId, "transferred-to-another-psychiatric-ward");

    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
    expect(screen.getByTestId("named-state")).toHaveTextContent("departed|transferred-to-another-psychiatric-ward");
    expect(screen.getByTestId("others").textContent, "no other occupant of the ward moved").toBe(othersBefore);
    expect(
      screen.getByText(`Recorded: ${name} has left the ward (transferred to another psychiatric ward).`),
    ).toBeInTheDocument();
    expect(document.querySelector(`[data-admission-id="${release.admissionId}"]`)).toBeNull();
  });

  it("asks for the paper before an involuntary patient leaves for the community, and changes nothing (WT-02)", () => {
    const release = INVOLUNTARY_RELEASE!;
    renderWard(release);
    const name = screen.getByTestId("named-name").textContent ?? "";
    const othersBefore = screen.getByTestId("others").textContent;

    openAndPick(release.admissionId, "discharged-to-the-community");

    // Walk-through WT-02 (26 Oct 2026): the engine's refusal used to be the only answer, under a
    // green tick. The drawer now says what is needed, by name, before anything is sent.
    expect(screen.getByTestId("ward-drawer-leave-paper")).toHaveTextContent(
      `${name} is recorded as involuntary. Record the revocation, Form 5A or Form 5B from the paper`,
    );
    expect(screen.getByRole("button", { name: /Record that they have left/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Record departure" })).toBeNull();
    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
    expect(screen.getByTestId("named-state")).toHaveTextContent(/^occupied\|$/u);
    expect(screen.getByTestId("others").textContent).toBe(othersBefore);
    expect(
      document.querySelector(`[data-admission-id="${release.admissionId}"]`),
      "the stay is still on the ward",
    ).not.toBeNull();
  });

  it("records a revocation from the bed drawer, then lets the ward record that they have left (WT-02)", () => {
    const release = INVOLUNTARY_RELEASE!;
    function DayZero() {
      return (
        <span hidden data-testid="day-zero">
          {useWardFlow().dayZero.toISOString()}
        </span>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DayZero />
        <WardProbe unitId={release.unitId} admissionId={release.admissionId} />
        <WardScreen unitId={release.unitId} />
      </WardFlowProvider>,
    );
    const dayZero = new Date(screen.getByTestId("day-zero").textContent!);
    openAndPick(release.admissionId, "discharged-to-the-community");
    const gate = screen.getByTestId("ward-drawer-leave-paper");
    fireEvent.click(within(gate).getByRole("button", { name: "Record the paper" }));
    const form = screen.getByTestId("ward-drawer-leave-paper");
    fireEvent.click(within(form).getByLabelText("Revocation of the order"));
    fireEvent.change(within(form).getByLabelText("Date and time written on it"), {
      target: { value: perthLocalBefore(dayZero, 5) },
    });
    fireEvent.click(within(form).getByLabelText(/I have checked the paper/u));
    fireEvent.click(within(form).getByRole("button", { name: "Record the paper" }));

    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
    expect(screen.queryByTestId("ward-drawer-leave-paper")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Record that they have left/i }));
    fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
    expect(screen.getByTestId("named-state")).toHaveTextContent("departed|discharged-to-the-community");
  });

  it("offers only the revocation when an involuntary patient is leaving against advice (WT-02)", () => {
    const release = INVOLUNTARY_RELEASE!;
    function DayZero() {
      return (
        <span hidden data-testid="day-zero">
          {useWardFlow().dayZero.toISOString()}
        </span>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DayZero />
        <WardProbe unitId={release.unitId} admissionId={release.admissionId} />
        <WardScreen unitId={release.unitId} />
      </WardFlowProvider>,
    );
    const dayZero = new Date(screen.getByTestId("day-zero").textContent!);
    openAndPick(release.admissionId, "left-against-advice");
    fireEvent.click(
      within(screen.getByTestId("ward-drawer-leave-paper")).getByRole("button", { name: "Record the paper" }),
    );
    const form = screen.getByTestId("ward-drawer-leave-paper");
    expect(
      within(form)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["revocation"]);
    fireEvent.click(within(form).getByLabelText("Revocation of the order"));
    fireEvent.change(within(form).getByLabelText("Date and time written on it"), {
      target: { value: perthLocalBefore(dayZero, 5) },
    });
    fireEvent.click(within(form).getByLabelText(/I have checked the paper/u));
    fireEvent.click(within(form).getByRole("button", { name: "Record the paper" }));

    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: /Record that they have left/i }));
    fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
    expect(screen.getByTestId("rejections")).toHaveTextContent("0");
    expect(screen.getByTestId("named-state")).toHaveTextContent("departed|left-against-advice");
  });
});
