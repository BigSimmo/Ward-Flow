// tests/ward-handover-filters.dom.test.tsx
//
// Owner ruling 2026-09-09: the handover page's filter is driven through one <select>, and this
// file proves it end to end — real clicks through @testing-library/user-event (the same
// convention tests/care-plan-linked-routes.dom.test.tsx already uses for its own selects), against
// the REAL seeded fixture, never a hand-built stand-in for the page's own wiring.
//
// The three owner-ruled conditions each get their own describe block: the scope is always named,
// the excluded count is always stated, and a breach outside the filter is still named. A fourth
// covers the "None in this filter" vs "None anywhere" distinction — proved against real data,
// using a real ED (scgh-ed) whose own beds-pulled and placement-gone-wrong populations are empty
// while the network's are not (measured against the live fixture, not assumed).

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  HandoverPage,
  PulledBedsSection,
  PlacementGoneWrongSection,
} from "@/components/ward-management/handover/handover-page";
import { handoverSnapshot, isOpen, type HandoverSnapshot } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

// The REAL fixture's own numbers, computed the same way the page itself computes them — never a
// hardcoded guess. tests/ward-handover.test.ts pins the same population with its own floor
// ("greater than 30"); this file needs the exact figures so its assertions can be exact too.
const realSeed = seedWardFlowState();
const { movements: realMovements, units: realUnits } = realSeed;
const realOpenMovements = realMovements.filter(isOpen);
const realNetworkSnapshot = handoverSnapshot(realOpenMovements, realUnits, NOW_ANCHOR);
const scghEdMovements = realOpenMovements.filter((movement) => movement.originEdId === "scgh-ed");
const scghEdSnapshot = handoverSnapshot(scghEdMovements, realUnits, NOW_ANCHOR);

// Owner, 26 Sept 2026: the patient's name, never the WF journey number — resolved from the real
// seed's own link, never typed by hand.
const wf018Identity = resolveSubjectPatient(
  realMovements.find((movement) => movement.id === "WF-018")!,
  realSeed,
);
const wf030Identity = resolveSubjectPatient(
  realMovements.find((movement) => movement.id === "WF-030")!,
  realSeed,
);

function renderHandover() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
    </WardFlowProvider>,
  );
}

async function selectScope(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Filter the sheet" }),
    screen.getByRole("option", { name: label }),
  );
}

describe("HandoverPage — the filter control", () => {
  it("defaults to Whole network, with a select grouped by the four named dimensions and nothing else", () => {
    renderHandover();
    const select = screen.getByRole("combobox", { name: "Filter the sheet" });
    expect((select as HTMLSelectElement).value).toBe("network");

    const groups = within(select).getAllByRole("group");
    const groupLabels = groups.map((group) => group.getAttribute("label"));
    // Exactly the four dimensions the owner named — no fifth invented.
    expect(groupLabels).toEqual(["Service", "Ward", "Emergency department", "Community team"]);
  });

  it("is hidden from print — the control that CHANGES the scope has no place on the printed sheet", () => {
    renderHandover();
    const select = screen.getByRole("combobox", { name: "Filter the sheet" });
    const printHidden = select.closest("[data-print-hide]");
    expect(printHidden, "the <select> (or its wrapping label) must carry data-print-hide").not.toBeNull();
  });
});

describe("HandoverPage — condition 1: the scope is always named", () => {
  it("names 'Whole network' at mount, with the real fixture's own total both times in the count", () => {
    renderHandover();
    const summary = screen.getByTestId("ward-handover-scope-summary").textContent ?? "";
    expect(summary).toContain("Whole network");
    expect(summary).toContain(
      `${realNetworkSnapshot.longestWaits.length} of ${realNetworkSnapshot.longestWaits.length} open movements`,
    );
  });

  it("renames itself to the chosen ED the moment a reader picks one, with the narrowed count", async () => {
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Sir Charles Gairdner Hospital Emergency Department");

    const summary = screen.getByTestId("ward-handover-scope-summary").textContent ?? "";
    expect(summary).toContain("Sir Charles Gairdner Hospital Emergency Department");
    expect(summary).toContain(
      `${scghEdSnapshot.longestWaits.length} of ${realNetworkSnapshot.longestWaits.length} open movements`,
    );
    // MUTATION-SENSITIVE: this is exactly the assertion that would stay green if the header
    // silently kept showing "Whole network" while the population underneath it changed — the
    // failure mode condition 1 exists to prevent.
    expect(summary).not.toContain("Whole network");
  });
});

describe("HandoverPage — condition 2: the excluded count is always stated", () => {
  it("states zero excluded at the default whole-network scope — never silent, even when it is nothing", () => {
    renderHandover();
    const excluded = screen.getByTestId("ward-handover-scope-excluded").textContent ?? "";
    expect(excluded).toContain("0 open movements are outside this filter");
  });

  it("states the real excluded count once a filter narrows the population", async () => {
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Sir Charles Gairdner Hospital Emergency Department");

    const expectedExcluded = realNetworkSnapshot.longestWaits.length - scghEdSnapshot.longestWaits.length;
    expect(
      expectedExcluded,
      "this test's own precondition: the ED filter must actually exclude something",
    ).toBeGreaterThan(0);

    const excluded = screen.getByTestId("ward-handover-scope-excluded").textContent ?? "";
    expect(excluded).toContain(`${expectedExcluded} open movements are outside this filter`);
  });
});

describe("HandoverPage — condition 3: a breach outside the filter is still named", () => {
  it("says nothing urgent is outside the filter at the default whole-network scope", () => {
    renderHandover();
    expect(screen.getByTestId("ward-handover-urgent-outside-filter-empty")).toHaveTextContent(
      "Nothing urgent is outside this filter.",
    );
  });

  it("names WF-018's patient (the fixture's one flagged-urgent movement) once a filter excludes its own department, never the WF number", async () => {
    const user = userEvent.setup();
    renderHandover();
    // rph-ed is not WF-018's own department (scgh-ed), so filtering to it excludes WF-018.
    await selectScope(user, "Royal Perth Hospital Emergency Department");

    expect(screen.queryByTestId("ward-handover-urgent-outside-filter-empty")).not.toBeInTheDocument();
    const footer = screen.getByTestId("ward-handover-urgent-outside-filter").textContent ?? "";
    // Owner, 26 Sept 2026: the patient's name, never the WF number.
    expect(footer).toContain(wf018Identity.displayName);
    expect(footer).not.toContain("WF-018");
    expect(footer).toContain("flagged urgent");
  });

  // DRAWING-ONLY addition (contract-handover.md §2.7, §4.2): each outside-filter row now also
  // states the wait, the owner and the stage — WF-018's own real fields
  // (`openedAt: NOW_ANCHOR - 40`, `owner: "ED mental health team"`, `stage: "placement_requested"`
  // — ward-movements.ts), never a fallback, since `Movement.owner` is a non-optional `string` on
  // every real movement (ward-model.ts:903).
  it("states WF-018's own wait, owner and stage on its outside-filter row", async () => {
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Royal Perth Hospital Emergency Department");

    const row = screen.getByTestId("ward-handover-urgent-outside-WF-018").textContent ?? "";
    expect(row).toContain("40m waiting");
    expect(row).toContain("ED mental health team");
    expect(row).toContain("Placement requested");
  });

  // DRAWING-ONLY addition (contract-handover.md §2.7, §4.3): the footer sentence defining
  // "urgent" and stating the whole-network total, beside how many of them this filter excluded.
  //
  // 2026-09-17: WF-030 (a second flaggedUrgent movement, `ward-movements.ts`'s own top comment)
  // raises the whole-network narrow-urgent count (movementIsUrgent: flagged, or a breached legal
  // deadline — neither of WF-023's nor WF-025's typed dueAt has passed) from 1 to 2. Scoped to
  // Royal Perth Hospital ED, WF-030 (originEdId rph-ed) falls INSIDE the filter, so the "outside"
  // count stays 1 (WF-018 alone) even though the network total doubled.
  it("the outside-filter panel's own foot states what 'urgent' means and the whole-network total", async () => {
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Royal Perth Hospital Emergency Department");

    const foot = screen.getByTestId("ward-handover-urgent-outside-filter-foot").textContent ?? "";
    expect(foot).toContain("a movement flagged urgent, or a legal form's due time already passed");
    expect(foot).toContain("2 open movements are urgent");
    expect(foot).toContain("1 of them is outside this filter");
  });

  it("the empty-case note names the excluded count and states none of them is urgent, once a filter excludes only unflagged movements", async () => {
    renderHandover();
    // Default whole-network scope: nothing is excluded, so the richer "N open movements are
    // outside it..." branch cannot fire here — proved instead against the exact wording the
    // zero-excluded default already renders.
    const empty = screen.getByTestId("ward-handover-urgent-outside-filter-empty").textContent ?? "";
    expect(empty).toContain("Nothing is outside it at all: the sheet is the whole network.");
  });

  // 2026-09-17: WF-030 (a second flaggedUrgent movement, originEdId rph-ed — a different
  // department from WF-018's own scgh-ed) means no single ED, service, ward or team filter can
  // any longer make the outside-urgent set EMPTY: whichever one department's own filter is
  // chosen, the OTHER flagged movement's origin is a different department and stays outside.
  // The "empty" testid is genuinely unreachable via SCGH ED now (WF-030 keeps it non-empty), so
  // this test is re-pointed at what the exclusion check can still prove here: it re-evaluates
  // per movement rather than staying stale. WF-018 (whose own department this now is) drops out
  // of the footer while WF-030 (a different department, still genuinely outside) stays in it.
  it("stops naming WF-018 once the chosen filter includes its own department, even though WF-030 (a different department) is still genuinely outside", async () => {
    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Sir Charles Gairdner Hospital Emergency Department");

    // MUTATION-SENSITIVE: this is the assertion that would catch the exclusion check being
    // dropped from `urgentMovementsOutsideScope` (see tests/ward-handover-filters.test.ts's own
    // mutation proof for the same line) reflected at the rendered page. WF-018 legitimately still
    // appears elsewhere on the page now (it is INSIDE this filter, in the Longest waits table),
    // so the assertion is scoped to the footer alone rather than the whole page.
    expect(screen.queryByTestId("ward-handover-urgent-outside-filter-empty")).not.toBeInTheDocument();
    const footer = screen.getByTestId("ward-handover-urgent-outside-filter");
    // Owner, 26 Sept 2026: the patient's name, never the WF number. WF-018's patient drops out of
    // the footer once its own department is inside the filter; WF-030's patient (a different
    // department) stays outside.
    expect(within(footer).queryByText(/WF-018/)).not.toBeInTheDocument();
    expect(within(footer).queryByText(wf018Identity.displayName)).not.toBeInTheDocument();
    expect(footer.textContent ?? "").not.toContain("WF-030");
    expect(footer.textContent ?? "").toContain(wf030Identity.displayName);
  });
});

describe("HandoverPage — 'None in this filter' vs 'None anywhere'", () => {
  it("'Beds pulled' and 'Placement gone wrong' read 'None in this filter' under scgh-ed, naming the real network-wide counts", async () => {
    // Measured against the live fixture (see this file's own header comment): scgh-ed's own
    // pulled-beds and placement-gone-wrong populations are both empty while the network's are
    // not — the exact condition that must read differently from a genuinely quiet network.
    expect(scghEdSnapshot.pulledBeds.length, "this test's own precondition").toBe(0);
    expect(scghEdSnapshot.placementGoneWrong.length, "this test's own precondition").toBe(0);
    expect(realNetworkSnapshot.pulledBeds.length, "this test's own precondition").toBeGreaterThan(0);
    expect(realNetworkSnapshot.placementGoneWrong.length, "this test's own precondition").toBeGreaterThan(0);

    const user = userEvent.setup();
    renderHandover();
    await selectScope(user, "Sir Charles Gairdner Hospital Emergency Department");

    const pulledEmpty = screen.getByTestId("ward-handover-pulled-beds-empty").textContent ?? "";
    expect(pulledEmpty).toContain("None in this filter");
    expect(pulledEmpty).toContain(String(realNetworkSnapshot.pulledBeds.length));
    expect(pulledEmpty).not.toBe("None — no bed is currently pulled.");

    const goneWrongEmpty = screen.getByTestId("ward-handover-placement-gone-wrong-empty").textContent ?? "";
    expect(goneWrongEmpty).toContain("None in this filter");
    expect(goneWrongEmpty).toContain(String(realNetworkSnapshot.placementGoneWrong.length));
  });

  // Every section is non-empty at network scope against today's real fixture (see
  // tests/ward-handover.dom.test.tsx's own "shows the real fixture's non-empty sections" test),
  // so the "None anywhere" case at the default scope cannot be exercised through the live page —
  // exactly the same reason that file drives its own empty-note proof against a constructed
  // snapshot rather than the real one. Same discipline here: the section components are rendered
  // directly, with `wholeNetworkCount` OMITTED (its default), which is what the page itself
  // passes whenever a category's whole-network count is genuinely zero.
  const emptySnapshot: HandoverSnapshot = {
    takenAt: NOW_ANCHOR,
    longestWaits: [],
    pulledBeds: [],
    inTransit: [],
    placementGoneWrong: [],
  };

  it("reads the ORIGINAL, unchanged 'None — ...' wording when the whole network is genuinely quiet (wholeNetworkCount omitted)", () => {
    render(<PulledBedsSection snapshot={emptySnapshot} />);
    expect(screen.getByTestId("ward-handover-pulled-beds-empty")).toHaveTextContent(
      "None — no bed is currently pulled.",
    );
  });

  it("switches to 'None in this filter' the instant wholeNetworkCount is nonzero, on the identical empty snapshot", () => {
    render(<PulledBedsSection snapshot={emptySnapshot} wholeNetworkCount={3} />);
    const text = screen.getByTestId("ward-handover-pulled-beds-empty").textContent ?? "";
    expect(text).toContain("None in this filter");
    expect(text).toContain("3");
    // The two must read differently — this is the whole point of the ruling's own words.
    expect(text).not.toBe("None — no bed is currently pulled.");
  });

  it("placement gone wrong: same two readings, driven independently of pulled beds", () => {
    const anywhere = render(<PlacementGoneWrongSection snapshot={emptySnapshot} />);
    expect(screen.getByTestId("ward-handover-placement-gone-wrong-empty")).toHaveTextContent(
      "None — nothing has escalated and nothing has been declined by every unit it was referred to.",
    );
    anywhere.unmount();

    render(<PlacementGoneWrongSection snapshot={emptySnapshot} wholeNetworkCount={1} />);
    const filtered = screen.getByTestId("ward-handover-placement-gone-wrong-empty").textContent ?? "";
    expect(filtered).toContain("None in this filter");
    expect(filtered).toContain("1");
  });
});
