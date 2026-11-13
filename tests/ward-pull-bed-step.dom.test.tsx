import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { AcceptedPullRows, useAcceptedPull } from "@/components/ward-management/coordinator/accepted-pull-rows";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import {
  chooseFactsLine,
  pullFactSource,
  pullFactSourceText,
  pullFormChanges,
} from "@/components/ward-management/referrals/pull-bed-facts";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * Wave 4 Pull the bed (D-188 as settled 13 Nov 2026, ruling items 1 and 3). Synthetic seed data only.
 */
let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

function FormFirst() {
  const value = useWardFlow();
  const [[item]] = useState(() => acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements));
  return item ? <PullAcceptedReferral item={item} onDone={() => {}} /> : <p>Nothing to pull</p>;
}

/** Home's Act now, cut down: the pull rows, then one more act-now row. */
function ActNow() {
  const value = useWardFlow();
  const pull = useAcceptedPull();
  const toPull = acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements);
  return (
    <section aria-label="Act now" tabIndex={-1}>
      {toPull.length > 0 || pull.kept.length > 0 ? (
        <AcceptedPullRows
          toPull={toPull}
          now={value.now}
          phone={false}
          testId="rows"
          pulling={pull.pulling}
          setPulling={pull.setPulling}
          kept={pull.kept}
          onUndo={pull.undo}
        />
      ) : null}
      <ul>
        <li>
          <button type="button">Next act-now row</button>
        </li>
      </ul>
      {pull.sheet}
    </section>
  );
}

function renderWith(children: ReactNode) {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        {children}
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function answerOpenFacts() {
  const status = screen.getByTestId("ward-pull-accepted-legal-status");
  const observation = screen.getByTestId("ward-pull-accepted-observation");
  const legalForm = screen.getByTestId("ward-pull-accepted-legal-form") as HTMLSelectElement;
  if (!within(status).queryByRole("radio", { checked: true }))
    fireEvent.click(within(status).getByRole("radio", { name: "Voluntary" }));
  if (legalForm.value === "") fireEvent.change(legalForm, { target: { value: "none" } });
  if (!within(observation).queryByRole("radio", { checked: true }))
    fireEvent.click(within(observation).getByRole("radio", { name: "General" }));
}

describe("Pull the bed form words (D-188)", () => {
  it("names the source, says Not recorded, or names the desk that changed it", () => {
    expect(pullFactSourceText(pullFactSource(true, false, "From the referral", "coordinator"))).toBe(
      "From the referral",
    );
    expect(pullFactSourceText(pullFactSource(false, false, "From the referral", "coordinator"))).toBe("Not recorded");
    expect(pullFactSourceText(pullFactSource(true, true, "From the referral", "coordinator"))).toBe(
      "Changed by Bed coordinator",
    );
    expect(pullFactSourceText(pullFactSource(false, true, "From the referral", "ward"))).toBe(
      "Changed by Nurse in charge",
    );
    expect(pullFormChanges({ legalStatus: false, legalForm: true, observation: true })).toEqual([
      "legalForm",
      "observation",
    ]);
    expect(chooseFactsLine(["legalStatus", "legalForm", "observation"])).toBe(
      "Choose legal status, legal form and observation level",
    );
    expect(chooseFactsLine([])).toBeUndefined();
  });
});

describe("Pull the bed form (D-188)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("shows Not recorded with nothing chosen, and a choice names the desk that made it", () => {
    renderWith(<FormFirst />);
    const observation = screen.getByTestId("ward-pull-accepted-observation");
    // The seed's accepted community referral records no observation level.
    expect(within(observation).queryByRole("radio", { checked: true })).toBeNull();
    expect(observation).toHaveTextContent("Not recorded");
    fireEvent.click(within(observation).getByRole("radio", { name: "General" }));
    expect(observation).toHaveTextContent("Changed by Bed coordinator");
    expect(observation).not.toHaveTextContent("Not recorded");
    // The placement group and the person head replace the old "Anything already recorded" line.
    expect(screen.getByRole("region", { name: "Placement" })).toHaveTextContent("Bed");
    expect(screen.queryByText(/Anything already recorded/u)).toBeNull();
  });

  it("changes nothing on the referral it was filled from", async () => {
    renderWith(<FormFirst />);
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const before = JSON.stringify(current!.referrals.find((referral) => referral.id === first!.referral.id));
    // Review F-13: the person's own record is not changed either (D-188 point b).
    const patientOf = () =>
      JSON.stringify(current!.patients.find((patient) => patient.id === first!.referral.patientId));
    const patientBefore = patientOf();
    answerOpenFacts();
    fireEvent.click(
      within(screen.getByTestId("ward-pull-accepted-legal-status")).getByRole("radio", {
        name: "Involuntary inpatient",
      }),
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    const journey = current!.movements.find((movement) => movement.referralId === first!.referral.id)!;
    expect(journey.stage).toBe("pulled");
    expect(journey.legalStatus).toBe("Involuntary inpatient");
    // D-188 point a: the movement's stage change names the desk that pulled.
    expect(journey.stageChanges.at(-1)).toMatchObject({ to: "pulled", by: "coordinator" });
    expect(JSON.stringify(current!.referrals.find((referral) => referral.id === first!.referral.id))).toBe(before);
    expect(patientOf()).toBe(patientBefore);
  });
});

describe("After a pull (ruling item 3)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("keeps the row with Undo pull until HH:MM, moves focus to the next row, and Undo releases the pull", async () => {
    renderWith(<ActNow />);
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const row = screen.getByTestId("rows").querySelector(`[data-referral-id="${first!.referral.id}"]`) as HTMLElement;
    fireEvent.click(
      within(row)
        .getAllByRole("button", { name: /^Pull the bed for / })
        .at(-1)!,
    );
    await screen.findByTestId(`ward-pull-accepted-${first!.referral.id}`);
    answerOpenFacts();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });

    const kept = await screen.findByTestId("pulled-row-undo");
    expect(kept).toHaveTextContent(/^Undo pull · until \d\d:\d\d$/u);
    const keptRow = kept.closest("li")!;
    expect(keptRow).toHaveAttribute("data-pulled-referral-id", first!.referral.id);
    expect(keptRow).toHaveTextContent(`Bed pulled at ${first!.unitName}`);
    // Focus goes to the next row's control, never the kept row or the top of the page.
    await waitFor(() => {
      const active = document.activeElement as HTMLElement;
      expect(active.closest("section")).toHaveAccessibleName("Act now");
      expect(active.closest("li")).not.toBe(keptRow);
      expect(active.tagName).toBe("BUTTON");
    });
    // The toast says one clock time and offers the same Undo (shared parts spec item 4).
    expect(screen.getByText(`Undo until ${kept.textContent!.slice(-5)}`)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(kept);
    });
    const journey = current!.movements.find((movement) => movement.referralId === first!.referral.id)!;
    expect(journey.stage).not.toBe("pulled");
    expect(journey.stageChanges.at(-1)).toMatchObject({ from: "pulled" });
    expect(screen.queryByTestId("pulled-row-undo")).toBeNull();
    expect(await screen.findByText(/^Bed pull undone for /u)).toBeInTheDocument();
  });
});

describe("Phone act-now row for an accepted referral (wave 4 H10)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  function PhoneRows() {
    const value = useWardFlow();
    const pull = useAcceptedPull();
    return (
      <>
        <AcceptedPullRows
          toPull={acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements)}
          now={value.now}
          phone
          testId="phone-rows"
          pulling={pull.pulling}
          setPulling={pull.setPulling}
          kept={pull.kept}
          onUndo={pull.undo}
        />
        {pull.sheet}
      </>
    );
  }

  it("shows the name as plain text and pulls from its own Pull the bed button", async () => {
    renderWith(<PhoneRows />);
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const row = screen
      .getByTestId("phone-rows")
      .querySelector(`[data-referral-id="${first!.referral.id}"]`) as HTMLElement;
    expect(row).toHaveTextContent("Accepted, bed not pulled");
    // The D-14 patient-link guard keeps this row from reading the referral's patient, so the name
    // stays plain text here; the row links nowhere.
    expect(within(row).queryByRole("link")).toBeNull();
    const pull = within(row).getByRole("button", { name: /^Pull the bed for / });
    expect(pull).toHaveTextContent("Pull the bed");
    expect(pull).toHaveAttribute("data-placement-action");
    fireEvent.click(pull);
    expect(await screen.findByTestId(`ward-pull-accepted-${first!.referral.id}`)).toBeInTheDocument();
  });
});

describe("Home keeps the pulled row (ruling item 3)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("shows the pulled row in Act now with Undo pull until HH:MM", async () => {
    renderWith(<CoordinatorScreen />);
    const toPull = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const first = toPull[0]!;
    const rows = screen.getByTestId("home-accepted-to-pull");
    const row = rows.querySelector(`[data-referral-id="${first.referral.id}"]`) as HTMLElement;
    fireEvent.click(
      within(row)
        .getAllByRole("button", { name: /^Pull the bed for / })
        .at(-1)!,
    );
    await screen.findByTestId(`ward-pull-accepted-${first.referral.id}`);
    answerOpenFacts();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    // The list stays even when this was the last row to pull.
    const kept = within(await screen.findByTestId("home-accepted-to-pull")).getByTestId("pulled-row-undo");
    expect(kept).toHaveTextContent(/^Undo pull · until \d\d:\d\d$/u);
    expect(kept.closest("li")).toHaveAttribute("data-pulled-referral-id", first.referral.id);
    expect(kept.closest("section")).toHaveAccessibleName("Act now");
  });
});
