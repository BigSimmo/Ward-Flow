import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** D-72 on screen: record seclusion with a typed time, see it in use, end it, and log an incident. */
function clock(minutesAgo: number) {
  const minute = (((NOW_ANCHOR - minutesAgo) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function renderScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <SeclusionScreen />
    </WardFlowProvider>,
  );
}

/** The table's rows, one per secure ward, in the order shown. */
function wardRows(): HTMLElement[] {
  return within(screen.getByTestId("seclusion-ward-table")).getAllByTestId(/^seclusion-ward-row-/u);
}

/** The first ward in the table with a patient on it, chosen so the start form has someone to name. */
function chooseWardWithPatients(): string {
  for (const row of wardRows()) {
    fireEvent.click(row);
    if (within(screen.getByTestId("seclusion-start-patient")).getAllByRole("option").length > 1)
      return row.getAttribute("data-testid")!.replace("seclusion-ward-row-", "");
  }
  throw new Error("no ward in the seed has a patient on it");
}

/** A hero figure by its label, e.g. "Seclusion rooms Out of service". */
function heroFigure(label: string): string {
  const labelled = screen.getAllByText((_, element) => element?.tagName === "SPAN" && element.textContent === label);
  // The stat holds the figure, then its label.
  return labelled[0]!.parentElement!.textContent ?? "";
}

const SCOPE_NOTE =
  "Operational view only. Times as typed; no order length, review or legal limit is worked out. The legal register stays in the health service's own system.";

describe("seclusion, restraint and incidents view", () => {
  it("says it is operational only, word for word, and computes no legal limit", () => {
    renderScreen();
    expect(screen.getByTestId("seclusion-scope-note").textContent).toBe(SCOPE_NOTE);
    expect(screen.getByTestId("seclusion-wards")).toHaveTextContent("No restraint recorded as in use");
    // D5 / D-70: no countdown or worked-out limit anywhere on the page.
    expect(screen.getByTestId("seclusion-screen").textContent).not.toMatch(/\b(left|remaining|overdue|due in)\b/iu);
  });

  it("lists secure wards (locked beds) plus any ward with something recorded, and nothing is chosen for the forms", () => {
    renderScreen();
    const listed = wardRows().map((row) => row.getAttribute("data-testid")!.replace("seclusion-ward-row-", ""));
    expect(listed).toContain("rph-adult-secure");
    // An open ward with nothing recorded is not a secure ward.
    expect(listed).not.toContain("rph-older-adult");
    chooseWardWithPatients();
    expect(screen.getByTestId("seclusion-start-patient")).toHaveValue("");
    expect(screen.getByTestId("seclusion-start-practice")).toHaveValue("");
    expect(screen.getByTestId("seclusion-start-time")).toHaveValue("");
    expect(screen.getByTestId("seclusion-incident-category")).toHaveValue("");
    expect(screen.getByTestId("seclusion-incident-time")).toHaveValue("");
  });

  it("records a start at a typed time, shows it in use and in the room status, then records the end", () => {
    renderScreen();
    const wardId = chooseWardWithPatients();
    const start = screen.getByTestId("seclusion-start");
    expect(start).toHaveAttribute("aria-disabled", "true");
    const patients = within(screen.getByTestId("seclusion-start-patient")).getAllByRole("option");
    fireEvent.change(screen.getByTestId("seclusion-start-patient"), {
      target: { value: patients[1]!.getAttribute("value") },
    });
    fireEvent.change(screen.getByTestId("seclusion-start-practice"), { target: { value: "seclusion" } });
    fireEvent.change(screen.getByTestId("seclusion-start-time"), { target: { value: "99:99" } });
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Type the time as HH:MM.")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("seclusion-start-time"), { target: { value: clock(20) } });
    expect(start).not.toHaveAttribute("aria-disabled");
    fireEvent.click(start);

    // The table row and the header update at once; the time shows as typed.
    const row = screen.getByTestId(`seclusion-ward-row-${wardId}`);
    expect(row).toHaveTextContent(`Seclusion, since ${clock(20)}`);
    expect(row).toHaveTextContent("In use");
    expect(heroFigure("Seclusion rooms In use")).toMatch(/^1/u);
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(`In use since ${clock(20)}`);
    expect(within(screen.getByTestId("seclusion-episode")).getByText(/^Seclusion · \S+, /u)).toBeInTheDocument();

    // Desk check (22 Oct): marking the room out of service while it is in use shows at once, and the
    // same button then reads as done.
    fireEvent.click(screen.getByTestId("seclusion-room-out-of-service"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark out of service" }));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(
      new RegExp(`^In use since ${clock(20)}\\. Last marked Out of service · recorded by`),
    );
    expect(screen.getByTestId("seclusion-room-out-of-service")).toHaveAttribute("aria-disabled", "true");

    const episode = screen.getByTestId("seclusion-episode");
    // Desk check (22 Oct): the opener and the save button no longer share the label "Record end".
    fireEvent.click(within(episode).getByRole("button", { name: "Record end" }));
    expect(within(episode).getByRole("button", { name: "Save end time" })).toHaveAttribute("aria-disabled", "true");
    // Desk check (22 Oct): an end a few minutes ahead of the clock is later than now, not before the start.
    const endTime = within(episode).getByTestId("seclusion-episode-end-time");
    fireEvent.change(endTime, { target: { value: clock(-8) } });
    expect(within(episode).getByText("The time cannot be later than now")).toBeInTheDocument();
    fireEvent.change(endTime, { target: { value: clock(25) } });
    expect(within(episode).getByText("The end time cannot be before the start time")).toBeInTheDocument();
    fireEvent.change(within(episode).getByTestId("seclusion-episode-end-time"), { target: { value: clock(5) } });
    fireEvent.click(within(episode).getByTestId("seclusion-episode-end"));
    expect(screen.queryByTestId("seclusion-episode")).not.toBeInTheDocument();
    expect(screen.getByTestId(`seclusion-ward-row-${wardId}`)).toHaveTextContent("Out of service");
    expect(heroFigure("Seclusion rooms In use")).toMatch(/^0/u);
  });

  it("records the room as out of service and an incident from the fixed list", () => {
    renderScreen();
    const first = wardRows()[0]!;
    const wardId = first.getAttribute("data-testid")!.replace("seclusion-ward-row-", "");
    // The room column and the Room last marked column both say "Not recorded" (never "Never").
    expect(within(first).getAllByRole("cell")[1]).toHaveTextContent("Not recorded");
    expect(within(first).getAllByRole("cell")[4]!.textContent).toBe("Not recorded");
    expect(screen.getByTestId("seclusion-ward-table")).not.toHaveTextContent("Never");
    const outBefore = Number.parseInt(heroFigure("Seclusion rooms Out of service"), 10);
    fireEvent.click(screen.getByTestId("seclusion-room-out-of-service"));
    // P090: it asks first, and nothing changes until it is confirmed.
    expect(screen.getByTestId(`seclusion-ward-row-${wardId}`)).toHaveTextContent("Not recorded");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark out of service" }));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(/^Out of service · recorded by/);
    // The table row and the header count follow the mark at once.
    const row = screen.getByTestId(`seclusion-ward-row-${wardId}`);
    expect(row).toHaveTextContent("Out of service");
    expect(within(row).getAllByRole("cell")[4]!.textContent).toMatch(/^.+, .+$/u);
    expect(within(row).getAllByRole("cell")[4]).not.toHaveTextContent("Not recorded");
    expect(Number.parseInt(heroFigure("Seclusion rooms Out of service"), 10)).toBe(outBefore + 1);
    fireEvent.change(screen.getByTestId("seclusion-incident-category"), { target: { value: "fall" } });
    fireEvent.change(screen.getByTestId("seclusion-incident-time"), { target: { value: clock(30) } });
    fireEvent.click(screen.getByTestId("seclusion-incident-record"));
    expect(within(screen.getByTestId("seclusion-incidents")).getByText("Fall")).toBeInTheDocument();
  });
});

describe("the site bed manager's seclusion view (D-80)", () => {
  afterEach(() => {
    cleanup();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      resetWardAccessStoreForTests();
    });
  });

  it("keeps the view and the room status but offers no seclusion, restraint or incident record", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } });
    });
    renderScreen();
    expect(screen.getByTestId("seclusion-scope-note").textContent).toBe(SCOPE_NOTE);
    // One secure ward at the site: the page is headed for the site and opens on that ward's record.
    expect(screen.getByText(/^Restrictive practice · /u)).toBeInTheDocument();
    expect(screen.queryByTestId("seclusion-ward-table")).not.toBeInTheDocument();
    expect(screen.getByText(/the one secure ward of \d+ at the site$/u)).toBeInTheDocument();
    expect(screen.getByTestId("seclusion-room-available")).toBeInTheDocument();
    expect(screen.queryByTestId("seclusion-start")).not.toBeInTheDocument();
    expect(screen.queryByTestId("seclusion-start-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("seclusion-incident-record")).not.toBeInTheDocument();
    expect(screen.queryByTestId("seclusion-incident-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("seclusion-episode-end-open")).not.toBeInTheDocument();
    expect(screen.getByTestId("seclusion-recorded-by-ward")).toHaveTextContent("None in use · recorded by the ward");

    // This desk may still mark the room, and it asks first.
    fireEvent.click(screen.getByTestId("seclusion-room-out-of-service"));
    const dialog = screen.getByRole("dialog", { name: "Mark seclusion room out of service?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark out of service" }));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(/^Out of service · recorded by/);
  });
});

describe("the nurse in charge's seclusion view (D-80)", () => {
  afterEach(() => {
    cleanup();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      resetWardAccessStoreForTests();
    });
  });

  function asWard(unitId: string) {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
    });
    renderScreen();
  }

  it("opens straight on its own ward's record, records start and incident, and marks the room after asking", () => {
    asWard("rph-adult-secure");
    expect(screen.getByTestId("seclusion-scope-note").textContent).toBe(SCOPE_NOTE);
    expect(screen.queryByTestId("seclusion-ward-table")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("seclusion-ward-card")).toHaveLength(1);
    expect(screen.getByText("Seclusion in use")).toBeInTheDocument();
    expect(screen.getByText("Restraint in use")).toBeInTheDocument();
    expect(screen.getByText("Incidents, last day", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("None in use.")).toBeInTheDocument();
    // D-80: the ward that is present records.
    expect(screen.getByTestId("seclusion-start")).toBeInTheDocument();
    expect(screen.getByTestId("seclusion-incident-record")).toBeInTheDocument();
    expect(screen.queryByTestId("seclusion-recorded-by-ward")).not.toBeInTheDocument();
    // Nothing chosen for it.
    expect(screen.getByTestId("seclusion-start-patient")).toHaveValue("");
    expect(screen.getByTestId("seclusion-start-practice")).toHaveValue("");

    fireEvent.click(screen.getByTestId("seclusion-room-available"));
    const dialog = screen.getByRole("dialog", { name: "Mark seclusion room available?" });
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent("Not recorded");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark available" }));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(/^Available · recorded by/);

    const patients = within(screen.getByTestId("seclusion-start-patient")).getAllByRole("option");
    fireEvent.change(screen.getByTestId("seclusion-start-patient"), {
      target: { value: patients[1]!.getAttribute("value") },
    });
    fireEvent.change(screen.getByTestId("seclusion-start-practice"), { target: { value: "seclusion" } });
    fireEvent.change(screen.getByTestId("seclusion-start-time"), { target: { value: clock(15) } });
    fireEvent.click(screen.getByTestId("seclusion-start"));
    expect(screen.getByTestId("seclusion-room-status")).toHaveTextContent(`In use since ${clock(15)}`);
    expect(heroFigure("Seclusion in use")).toMatch(/^1/u);
  });

  it("keeps recording on its own ward even when that ward has no locked beds", () => {
    asWard("rph-older-adult");
    expect(screen.getAllByTestId("seclusion-ward-card")).toHaveLength(1);
    expect(screen.getByTestId("seclusion-start")).toBeInTheDocument();
    expect(screen.getByTestId("seclusion-incident-record")).toBeInTheDocument();
    expect(screen.getByTestId("seclusion-room-out-of-service")).toBeInTheDocument();
  });
});
