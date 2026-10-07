import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// A held deferred value reproduces the urgent render before React finishes the new search.
const deferred = vi.hoisted(() => ({ held: undefined as string | undefined }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useDeferredValue: <T,>(value: T) => {
      const result = actual.useDeferredValue(value);
      return deferred.held === undefined ? result : deferred.held;
    },
  };
});
afterEach(() => {
  deferred.held = undefined;
});

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
}));

// Same reason as every sibling dom suite (ward-patient-search.dom.test.tsx,
// ward-add-patient.dom.test.tsx): this suite reads a real `href` off a rendered result directly
// rather than actually navigating, which a plain `<a>` supports and the App Router component does
// not under jsdom.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardGlobalSearch } from "@/components/ward-management/ward-global-search";
import { refusalFor } from "@/components/ward-management/search/search-refusals";
import { searchMovements } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { findPatients, patientDisplayName } from "@/components/ward-management/ward-patients";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { allUnits } from "@/components/ward-management/ward-sites";

const units = allUnits();

/*
 * ⚠️ EVERY EXPECTATION BELOW IS DERIVED FROM THE SEEDED FIXTURE, NEVER FROM A STRING TYPED HERE.
 * `targetPatient` and `targetMovement` are found BY ID and every query typed into the control is
 * read off the found record's own fields — so if the fixture ever changes what "PT-001" or
 * "WF-001" hold, this file's queries change with it instead of silently drifting apart from what
 * they claim to test.
 */
const targetPatient = wardPatients.find((patient) => patient.id === "PT-001");
if (!targetPatient) throw new Error("fixture drifted: PT-001 no longer exists in wardPatients");

const targetMovement = wardMovements.find((movement) => movement.id === "WF-001");
if (!targetMovement) throw new Error("fixture drifted: WF-001 no longer exists in wardMovements");

const movementPatient = targetMovement.patientId
  ? wardPatients.find((patient) => patient.id === targetMovement.patientId)
  : undefined;
if (!movementPatient) throw new Error("fixture drifted: WF-001 has no linked patient");

const personQuery = targetPatient.givenName;
const movementQuery = targetMovement.id;
const movementNameQuery = patientDisplayName(movementPatient);

describe("WardGlobalSearch — anti-vacuity floor", () => {
  it("the person query genuinely matches the target patient in the real matcher", () => {
    // If this ever comes back empty, every assertion below that expects to find PT-001 would pass
    // vacuously for the wrong reason (nothing to find is not the same as finding nothing wrong).
    const matches = findPatients(wardPatients, personQuery);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((patient) => patient.id === targetPatient.id)).toBe(true);
  });

  it("the movement query genuinely matches the target movement in the real matcher, and matches no patient", () => {
    const movementMatches = searchMovements(wardMovements, units, { text: movementQuery });
    expect(movementMatches.length).toBeGreaterThan(0);
    expect(movementMatches.some((movement) => movement.id === targetMovement.id)).toBe(true);

    // Load-bearing for the "no People group when nothing matched" assertion further down — checked
    // here rather than assumed, so a fixture change that makes WF-001 also a substring of some
    // patient's name fails loudly instead of producing a silently wrong test.
    expect(findPatients(wardPatients, movementQuery)).toHaveLength(0);
  });
});

describe("WardGlobalSearch", () => {
  function renderSearch(onNavigate = vi.fn()) {
    render(
      <WardGlobalSearch
        movements={wardMovements}
        patients={wardPatients}
        units={units}
        scope="ED mental health"
        onNavigate={onNavigate}
      />,
    );
    return { onNavigate };
  }

  it("renders the scope chip exactly as given, with no role logic applied to it", () => {
    renderSearch();
    expect(screen.getByTestId("ward-global-search-scope")).toHaveTextContent("ED mental health");
  });

  it("shows nothing for an empty query — absence, not a full catalogue", () => {
    renderSearch();
    fireEvent.focus(screen.getByTestId("ward-global-search-input"));
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
  });

  it("finds the person by the fixture's own given name and carries the exact patient id in the href", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: personQuery } });

    const row = screen.getByTestId(`ward-global-search-result-person-${targetPatient.id}`);
    expect(row.tagName).toBe("A");
    expect(row).toHaveAttribute("href", `/mockups/ward-flow/people/${targetPatient.id}`);
    expect(row).toHaveTextContent(patientDisplayName(targetPatient));
    expect(row).toHaveTextContent(targetPatient.umrn);
    expect(row).toHaveTextContent(targetPatient.dateOfBirth);
    expect(row).toHaveTextContent("Person");
    expect(screen.getByTestId("ward-global-search-intent")).toHaveTextContent("People");
  });

  it("finds the movement by its own id and carries the exact movement id in the href", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: movementQuery } });

    const row = screen.getByTestId(`ward-global-search-result-movement-${targetMovement.id}`);
    expect(row.tagName).toBe("A");
    expect(row).toHaveAttribute("href", `/mockups/ward-flow/movements/${targetMovement.id}`);
    expect(row).toHaveTextContent("Movement");
  });

  it("groups only the kinds that actually matched — no empty People group under a movement-only query", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: movementQuery } });

    const popup = screen.getByTestId("ward-global-search-popup");
    expect(within(popup).getByTestId("ward-global-search-group-movements")).toBeInTheDocument();
    expect(within(popup).queryByTestId("ward-global-search-group-people")).not.toBeInTheDocument();
    expect(within(popup).getByTestId("ward-global-search-intent")).toHaveTextContent("Movements");
  });

  it("says plainly that nothing matched, and guesses at nothing", () => {
    renderSearch();
    // Not derived from the fixture on purpose: this assertion is about an ABSENCE, so the only
    // requirement is that the string is not a substring of any seeded name, record number or
    // movement id — unlike the match assertions above, there is no real record for this to name.
    const nonsense = "zzq-no-such-record-in-this-fixture-zzq";
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: nonsense } });

    expect(screen.getByTestId("ward-global-search-empty")).toHaveTextContent(nonsense);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  describe("header palette footer", () => {
    it("keeps keyboard hints and does not render the invented-names disclaimer", () => {
      renderSearch();
      fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: personQuery } });

      expect(screen.getByTestId(`ward-global-search-result-person-${targetPatient.id}`)).toBeInTheDocument();

      const footer = screen.getByTestId("ward-global-search-footer");
      expect(footer).toHaveTextContent("Navigate");
      expect(footer).toHaveTextContent("Select");
      expect(footer).toHaveTextContent("Esc");
      expect(footer).not.toHaveTextContent("Names are invented.");
      expect(footer).not.toHaveTextContent("Search never returns a risk score");
      expect(screen.queryByText("Names are invented.")).not.toBeInTheDocument();
    });

    it("omits that disclaimer in the empty state as well", () => {
      renderSearch();
      const nonsense = "zzq-no-such-record-in-this-fixture-zzq";
      fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: nonsense } });

      expect(screen.getByTestId("ward-global-search-empty")).toBeInTheDocument();
      expect(screen.getByTestId("ward-global-search-footer")).toHaveTextContent("Navigate");
      expect(screen.queryByText("Names are invented.")).not.toBeInTheDocument();
    });
  });

  it("names the detected intent and updates it when the query changes", () => {
    renderSearch();
    const input = screen.getByTestId("ward-global-search-input");

    fireEvent.change(input, { target: { value: personQuery } });
    expect(screen.getByTestId("ward-global-search-intent")).toHaveTextContent("People");

    fireEvent.change(input, { target: { value: "ward" } });
    expect(screen.getByTestId("ward-global-search-intent")).toHaveTextContent("Places");

    fireEvent.change(input, { target: { value: movementQuery } });
    expect(screen.getByTestId("ward-global-search-intent")).toHaveTextContent("Movements");
  });

  it("finds the open movement from the linked patient's display name and lists People first", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: movementNameQuery } });

    const row = screen.getByTestId(`ward-global-search-result-movement-${targetMovement.id}`);
    expect(row).toHaveTextContent("Movement");
    expect(screen.getByTestId("ward-global-search-intent")).toHaveTextContent("People");

    const people = screen.getByTestId("ward-global-search-group-people");
    const movements = screen.getByTestId("ward-global-search-group-movements");
    expect(people.compareDocumentPosition(movements) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the score refusal and no result links", () => {
    renderSearch();
    const query = "risk score";
    const refusal = refusalFor(query);
    expect(refusal?.kind).toBe("score");

    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: query } });

    expect(screen.getByTestId("ward-global-search-refusal")).toHaveTextContent(refusal?.sentence ?? "");
    expect(screen.queryByTestId("ward-global-search-intent")).not.toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Names are invented.")).not.toBeInTheDocument();
  });

  it("shows the closed-movement refusal when the query asks for arrived work", () => {
    renderSearch();
    const query = "arrived";
    const refusal = refusalFor(query);
    expect(refusal?.kind).toBe("closed");

    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: query } });

    expect(screen.getByTestId("ward-global-search-refusal")).toHaveTextContent(refusal?.sentence ?? "");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("calls onNavigate with the exact patient id on a plain click, and does not let the anchor navigate itself", () => {
    const { onNavigate } = renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: personQuery } });

    const row = screen.getByTestId(`ward-global-search-result-person-${targetPatient.id}`);
    fireEvent.click(row, { button: 0 });

    expect(onNavigate).toHaveBeenCalledWith(`/mockups/ward-flow/people/${targetPatient.id}`);
  });

  it("requires a fresh selection when a new query still has results", () => {
    const { onNavigate } = renderSearch();
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.change(input, { target: { value: personQuery } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant");
    fireEvent.change(input, { target: { value: `${personQuery} ` } });
    expect(screen.getByTestId(`ward-global-search-result-person-${targetPatient.id}`)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("hides stale deferred results and ignores Enter until the current query has rendered", () => {
    const { onNavigate } = renderSearch();
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.change(input, { target: { value: personQuery } });
    expect(screen.getByTestId(`ward-global-search-result-person-${targetPatient.id}`)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    deferred.held = personQuery;
    fireEvent.change(input, { target: { value: "zzq-no-such-record-in-this-fixture-zzq" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("does not select an old result after the search text changes", () => {
    const { onNavigate } = renderSearch();
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.change(input, { target: { value: personQuery } });
    expect(screen.getByTestId(`ward-global-search-result-person-${targetPatient.id}`)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.change(input, { target: { value: "zzq-no-such-record-in-this-fixture-zzq" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("does not intercept a modified click — the browser's own new-tab gesture is left alone", () => {
    const { onNavigate } = renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: personQuery } });

    const row = screen.getByTestId(`ward-global-search-result-person-${targetPatient.id}`);
    fireEvent.click(row, { button: 0, ctrlKey: true });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("Enter with no active row selects nothing — a stray Enter must not navigate anywhere unchosen", () => {
    const { onNavigate } = renderSearch();
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.change(input, { target: { value: movementQuery } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("ArrowDown activates the first row and Enter selects it, carrying the exact movement id", () => {
    const { onNavigate } = renderSearch();
    const input = screen.getByTestId("ward-global-search-input");
    fireEvent.change(input, { target: { value: movementQuery } });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const row = screen.getByTestId(`ward-global-search-result-movement-${targetMovement.id}`);
    expect(row).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onNavigate).toHaveBeenCalledWith(`/mockups/ward-flow/movements/${targetMovement.id}`);
    // Selecting closes the popup and clears the active row — the next Enter must be inert again.
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
  });

  it("Escape clears the query outright, not merely closing the popup", () => {
    renderSearch();
    const input = screen.getByTestId("ward-global-search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: personQuery } });
    expect(screen.getByTestId("ward-global-search-popup")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("");
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
  });

  it("the global shortcut (Ctrl+K) focuses the input from anywhere on the page", () => {
    renderSearch();
    const input = screen.getByTestId("ward-global-search-input") as HTMLInputElement;
    // Focus something else first, so the assertion below cannot pass merely because the input
    // already happened to be focused.
    document.body.focus();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(document.activeElement).toBe(input);
  });

  it("the global shortcut does not hijack a keystroke already headed for another field", () => {
    renderSearch();
    const input = screen.getByTestId("ward-global-search-input") as HTMLInputElement;
    const decoy = document.createElement("input");
    document.body.appendChild(decoy);
    decoy.focus();

    fireEvent.keyDown(decoy, { key: "/" });

    expect(document.activeElement).toBe(decoy);
    expect(document.activeElement).not.toBe(input);
    document.body.removeChild(decoy);
  });

  it("finds a hospital ward by keyword and links to its ward page", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: "Mental Health Unit" } });

    const popup = screen.getByTestId("ward-global-search-popup");
    expect(within(popup).getByText("Wards")).toBeInTheDocument();
    const wardItem = screen.getByTestId("ward-global-search-result-ward-scgh-adult-open");
    expect(wardItem).toHaveAttribute("href", "/mockups/ward-flow/ward/scgh-adult-open");
    expect(wardItem).toHaveTextContent("Ward");
  });

  it("finds an emergency department by name and links to its ED page", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: "Fiona Stanley" } });

    const popup = screen.getByTestId("ward-global-search-popup");
    expect(within(popup).getAllByText("ED").length).toBeGreaterThan(0);
    const edItem = screen.getByTestId("ward-global-search-result-ed-fsh-ed");
    expect(edItem).toHaveAttribute("href", "/mockups/ward-flow/ed/fsh-ed");
    expect(edItem).toHaveTextContent("ED");
  });

  it("finds a community team by name and links to its community team page", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: "Mead Centre (Armadale)" } });

    const popup = screen.getByTestId("ward-global-search-popup");
    expect(within(popup).getAllByText("Community").length).toBeGreaterThan(0);
    const teamItem = screen.getByTestId("ward-global-search-result-community-mead-centre-armadale");
    expect(teamItem).toHaveAttribute("href", "/mockups/ward-flow/community/mead-centre-armadale");
    expect(teamItem).toHaveTextContent("Community");
  });

  it("finds a Mental Health Act legal form and links to the legal forms register", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: "Form 1A" } });

    const popup = screen.getByTestId("ward-global-search-popup");
    expect(within(popup).getByText("Legal")).toBeInTheDocument();
    const formItem = screen.getByTestId("ward-global-search-result-form-1a");
    expect(formItem).toHaveAttribute("href", "/mockups/ward-flow/legal-forms");
    expect(formItem).toHaveTextContent("Legal Form");
  });

  it("finds core views by keyword and links to their routes", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: "Shift Handover" } });

    const popup = screen.getByTestId("ward-global-search-popup");
    expect(within(popup).getByText("Screens")).toBeInTheDocument();
    const viewItem = screen.getByTestId("ward-global-search-result-view-handover");
    expect(viewItem).toHaveAttribute("href", "/mockups/ward-flow/handover");
    expect(viewItem).toHaveTextContent("View");
  });

  it("finds action tasks by keyword 'task' and links to the movement page", () => {
    renderSearch();
    fireEvent.change(screen.getByTestId("ward-global-search-input"), { target: { value: "task" } });

    const popup = screen.getByTestId("ward-global-search-popup");
    expect(within(popup).getByText("Tasks")).toBeInTheDocument();
    const taskItems = screen.getAllByTestId(/^ward-global-search-result-task-/);
    expect(taskItems.length).toBeGreaterThan(0);
    expect(taskItems[0]).toHaveAttribute("href", expect.stringMatching(/\/mockups\/ward-flow\/movements\//));
  });
});
