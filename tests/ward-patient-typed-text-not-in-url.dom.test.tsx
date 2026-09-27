import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * THE PRIVACY CATCHER for owner ruling D-11 (`docs/ward-flow/owner-decisions-2026-09-1x.md`
 * ~685-697): a patient's typed name or record number must never reach the address bar. Before this
 * fix, `patient-typeahead.tsx`'s "Add this person" link and `patient-search.tsx`'s two "Add patient"
 * links carried the typed text as a `?name=`/`?search=` query parameter on the way to
 * `/mockups/ward-flow/people/new` — written into browser history and logged by every proxy between
 * the browser and the server, on what this repository documents as routinely a SHARED ward
 * computer.
 *
 * This suite renders each of the three links with an identifying string typed in — a name AND a
 * record-number-shaped fragment together, so either kind of leak would show up — and asserts
 * directly against every anchor's `href` on the page that neither the raw text nor a `name=`/
 * `search=` parameter is present anywhere. It then proves the prefill still works: the same text
 * still reaches `AddPatientForm`, carried instead through `patient-query-handoff.ts`'s in-memory,
 * read-once channel.
 */

const router = vi.hoisted(() => ({ push: vi.fn() }));

// Same reason as `ward-add-patient.dom.test.tsx`: `AddPatientForm` navigates via `useRouter()` and
// jsdom has no App Router context to resolve it against.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// Same reason as every sibling dom suite: `Link` renders next/link anchors and this suite reads a
// real `href` off them rather than actually navigating, which a plain `<a>` supports and the App
// Router component does not under jsdom.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { PatientTypeahead } from "@/components/ward-management/search/patient-typeahead";
import { takeHandedOffPatientQuery } from "@/components/ward-management/search/patient-query-handoff";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";

/** A name and a record-number-shaped fragment together, so either kind of leak the search box
 *  accepts would be caught by one query. Matches nobody and nothing near-spelt in the seed data
 *  (`wardPatients`), so every "nobody found" empty state this suite exercises actually renders. */
const TYPED_TEXT = "Smith, J 1234567";

/** Every href actually on the page, so a leak in a link this suite does not name explicitly is
 *  still caught — the point of this test is the ABSENCE of the text anywhere, not just in the one
 *  link each defect report named. */
function allHrefs(): string[] {
  return Array.from(document.querySelectorAll("a[href]")).map((anchor) => anchor.getAttribute("href") ?? "");
}

function expectNoLeak(hrefs: string[]) {
  expect(hrefs.length, "no anchors were found to check — this assertion would pass vacuously").toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, `href "${href}" carries the typed text`).not.toMatch(/Smith|1234567/i);
    expect(href, `href "${href}" carries a name= or search= parameter`).not.toMatch(/[?&](name|search)=/i);
  }
}

/** `PatientTypeahead` takes `value`/`onValueChange`, so a bare render needs a small stateful host —
 *  same technique `ward-patient-typeahead.dom.test.tsx` uses. */
function TypeaheadHarness(props: Omit<ComponentProps<typeof PatientTypeahead>, "value" | "onValueChange">) {
  const [value, setValue] = useState("");
  return <PatientTypeahead {...props} value={value} onValueChange={setValue} />;
}

describe("Typed patient text never reaches a URL", () => {
  afterEach(() => {
    // The handoff module is a plain in-memory singleton shared across this whole file — drain it
    // so a write one test made cannot apply itself to a later, unrelated render.
    takeHandedOffPatientQuery();
  });

  it("PatientTypeahead's 'Add this person' link carries nothing identifying, and hands the text off in memory instead", () => {
    render(<TypeaheadHarness patients={wardPatients} referrals={[]} />);
    fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: TYPED_TEXT } });

    expect(screen.getByTestId("ward-patient-typeahead-empty")).toBeInTheDocument();
    const link = screen.getByText("Add this person");
    expect(link).toHaveAttribute("href", WARD_ADD_PERSON_HREF);
    expectNoLeak(allHrefs());

    fireEvent.click(link);
    expect(takeHandedOffPatientQuery()).toEqual({ text: TYPED_TEXT, assignTo: "given-name" });
  });

  it("PatientSearchPage's two 'Add patient' links carry nothing identifying, and hand the text off in memory instead", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: TYPED_TEXT } });

    const headerAdd = screen.getByTestId("ward-patient-search-add");
    const emptyStateAdd = screen.getByTestId("ward-patient-search-people-empty-add");
    expect(headerAdd).toHaveAttribute("href", WARD_ADD_PERSON_HREF);
    expect(emptyStateAdd).toHaveAttribute("href", WARD_ADD_PERSON_HREF);
    expectNoLeak(allHrefs());

    fireEvent.click(headerAdd);
    expect(takeHandedOffPatientQuery()).toEqual({ text: TYPED_TEXT, assignTo: "carried" });
  });

  it("AddPatientForm still prefills Given name after the typeahead's click-path handoff", () => {
    const typeahead = render(<TypeaheadHarness patients={wardPatients} referrals={[]} />);
    fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: TYPED_TEXT } });
    fireEvent.click(screen.getByText("Add this person"));
    // Mirrors a real client-side navigation replacing this screen with the add-patient one.
    typeahead.unmount();

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );
    expect(screen.getByLabelText("Given name")).toHaveValue(TYPED_TEXT);
    // THE JUDGEMENT CALL, proven directly here too: the whole typed string lands in ONE field.
    expect(screen.getByLabelText("Family name")).toHaveValue("");
  });

  it("AddPatientForm still carries a search-page handoff unassigned, until the clinician chooses a field", () => {
    const search = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: TYPED_TEXT } });
    fireEvent.click(screen.getByTestId("ward-patient-search-add"));
    search.unmount();

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-add-patient-carried-search")).toHaveTextContent(TYPED_TEXT);
    expect(screen.getByLabelText("Given name")).toHaveValue("");
    expect(screen.getByLabelText(/Record number|UMRN/i)).toHaveValue("");
  });

  /**
   * 🔴 **THE STALE HANDOFF, FOUND BY ADVERSARIAL REVIEW OF `65aa7c54a6`.** A modified click (ctrl-,
   * cmd-, shift- or middle-click) still fires React's `onClick` in THIS tab even though the browser
   * opens the link in a new one, so an unconditional write left a value sitting in `pending` that
   * this tab would never consume — and a later, unrelated click on a DIFFERENT "Add patient" link,
   * with the search box now empty, used to skip the write entirely (guarded by `text.trim()`) and
   * silently inherit that stale value instead of starting blank. Both defects are pinned below:
   * a modified click clears rather than writes, and every plain click writes — including an empty
   * or refused one — so it can never leave an earlier click's value behind.
   */
  describe("a modified click on an Add-patient link clears the handoff instead of leaving it pending", () => {
    it("the typeahead's 'Add this person' link", () => {
      render(<TypeaheadHarness patients={wardPatients} referrals={[]} />);
      fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: TYPED_TEXT } });
      fireEvent.click(screen.getByText("Add this person"), { ctrlKey: true });
      expect(
        takeHandedOffPatientQuery(),
        "a ctrl-click opens a new tab; this tab must not carry a leftover value",
      ).toBeUndefined();
    });

    it("the search page's header 'Add patient' link", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientSearchPage />
        </WardFlowProvider>,
      );
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: TYPED_TEXT } });
      fireEvent.click(screen.getByTestId("ward-patient-search-add"), { metaKey: true });
      expect(takeHandedOffPatientQuery()).toBeUndefined();
    });

    it("the search page's empty-state 'Add patient' link", () => {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <PatientSearchPage />
        </WardFlowProvider>,
      );
      fireEvent.change(screen.getByLabelText("Search"), { target: { value: TYPED_TEXT } });
      fireEvent.click(screen.getByTestId("ward-patient-search-people-empty-add"), { shiftKey: true });
      expect(takeHandedOffPatientQuery()).toBeUndefined();
    });
  });

  it("clearing the search box and clicking Add patient does not replay a value a modified click left pending earlier", () => {
    const typeahead = render(<TypeaheadHarness patients={wardPatients} referrals={[]} />);
    fireEvent.change(screen.getByTestId("ward-patient-typeahead-input"), { target: { value: TYPED_TEXT } });
    // A ctrl-click on "Add this person" opens a new tab and leaves THIS tab's search page open —
    // it does not navigate here, so the harness stays mounted exactly as a real new-tab click would
    // leave the originating tab.
    fireEvent.click(screen.getByText("Add this person"), { ctrlKey: true });
    typeahead.unmount();

    const search = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    // The search box on this fresh mount starts empty — the clinician never typed here, or cleared
    // it — and the plain (unmodified) click below is an ordinary same-tab navigation.
    fireEvent.click(screen.getByTestId("ward-patient-search-add"));
    search.unmount();

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );
    expect(
      screen.getByLabelText("Given name"),
      "the earlier ctrl-click's typed text must not reappear on an unrelated, empty-box Add patient click",
    ).toHaveValue("");
    expect(screen.queryByTestId("ward-add-patient-carried-search")).toBeNull();
  });
});
