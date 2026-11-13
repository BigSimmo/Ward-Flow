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
import { originPlace } from "@/components/ward-management/origin-place";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import {
  chooseFactsLine,
  pullFactSource,
  pullFactSourceText,
  pullFormChanges,
} from "@/components/ward-management/pull-bed-facts";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { buttonClass, ToastProvider } from "@/components/wf";

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
    // After-pull mock-up (F-57): when another accepted row follows, focus is on its name, the row's
    // open control, whose name says the visible text (CB-3).
    const next = keptRow.nextElementSibling as HTMLElement | null;
    if (next?.hasAttribute("data-referral-id")) {
      const active = document.activeElement as HTMLElement;
      expect(active.closest("li")).toBe(next);
      expect(active).not.toHaveTextContent("Pull the bed");
      expect(active.getAttribute("aria-label")).toContain(active.textContent!);
    }
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

describe("Undo pull from the kept row (review FA-2, FA-10, FR-1)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("names the button by its words, closes the pull's toast and keeps focus in the list", async () => {
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
    // FA-10: the spoken name starts with the words on the button.
    expect(kept.getAttribute("aria-label")!.startsWith(kept.textContent!)).toBe(true);
    const pulledToast = screen.getByText(`Bed pulled at ${first!.unitName} for`, { exact: false });
    kept.focus();
    await act(async () => {
      fireEvent.click(kept);
    });
    expect(await screen.findByText(/^Bed pull undone for /u)).toBeInTheDocument();
    // FR-1: the pull's own toast, with its Undo, is gone once the row's Undo has run.
    await waitFor(() => expect(pulledToast).not.toBeInTheDocument());
    // FA-2: focus stays in Act now (the row's Pull the bed again, or the list), never the page body.
    await waitFor(() => {
      const active = document.activeElement as HTMLElement;
      expect(active).not.toBe(document.body);
      expect(active.closest("section")).toHaveAccessibleName("Act now");
    });
  });
});

describe("Undo pull keeps the person on the list (review P4-1)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("brings the row and the count back after Undo, and Pull the bed pulls on the same movement", async () => {
    renderWith(<ActNow />);
    const before = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const [first] = before;
    const referralId = first!.referral.id;
    const rowFor = () =>
      screen
        .getByTestId("rows")
        .querySelector<HTMLElement>(`li[data-referral-id="${referralId}"]:not([data-pulled-referral-id])`);
    fireEvent.click(
      within(rowFor()!)
        .getAllByRole("button", { name: /^Pull the bed for / })
        .at(-1)!,
    );
    await screen.findByTestId(`ward-pull-accepted-${referralId}`);
    answerOpenFacts();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    expect(acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements)).toHaveLength(
      before.length - 1,
    );
    await act(async () => {
      fireEvent.click(await screen.findByTestId("pulled-row-undo"));
    });
    await screen.findByText(/^Bed pull undone for /u);

    // The count and the row are back, naming the movement the Undo left open without a bed.
    const after = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    expect(after).toHaveLength(before.length);
    const journey = current!.movements.find((movement) => movement.referralId === referralId && !movement.closure);
    expect(journey?.stage).toBe("accepted_awaiting_bed");
    expect(after.find((item) => item.referral.id === referralId)?.movementId).toBe(journey!.id);
    await waitFor(() => expect(rowFor()).not.toBeNull());

    // Pull the bed again: the form shows the recorded facts and pulls on that same movement.
    fireEvent.click(
      within(rowFor()!)
        .getAllByRole("button", { name: /^Pull the bed for / })
        .at(-1)!,
    );
    await screen.findByTestId("ward-pull-accepted-recorded");
    const confirm = screen.getByTestId("ward-pull-accepted-confirm");
    expect(confirm).not.toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      fireEvent.click(confirm);
    });
    const open = current!.movements.filter((movement) => movement.referralId === referralId && !movement.closure);
    expect(open.map((movement) => movement.id)).toEqual([journey!.id]);
    expect(open[0]!.stage).toBe("pulled");
    expect(acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements)).toHaveLength(
      before.length - 1,
    );
  });
});

describe("Desk act-now row for an accepted referral (FS-3, FS-6, FS-7)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("puts the tag on the name line, names the place in words and fills Pull the bed", () => {
    renderWith(<ActNow />);
    const toPull = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const first = toPull[0]!;
    const row = screen.getByTestId("rows").querySelector(`[data-referral-id="${first.referral.id}"]`) as HTMLElement;
    const who = row.querySelector("button")!.parentElement!;
    expect(who).toHaveTextContent("Accepted, bed not pulled");
    const pull = within(row)
      .getAllByRole("button", { name: /^Pull the bed for / })
      .at(-1)!;
    for (const name of buttonClass({ variant: "pri", size: "sm" }).split(" ")) expect(pull).toHaveClass(name);
    // Site names in full, never a code to decode (Home notes item 6).
    const code = first.referral.originSiteCode;
    if (code) expect(row).toHaveTextContent(`from ${originPlace(first.referral)}`);
    expect(row.textContent).not.toMatch(/from [A-Z]{2,6}\b/u);
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
