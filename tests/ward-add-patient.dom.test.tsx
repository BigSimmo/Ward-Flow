import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectSays } from "./helpers/ward-caption";

// Same reason as `ward-patient-page.dom.test.tsx`: `AddPatientForm` navigates via `useRouter()`
// after a successful add, and jsdom has no App Router context to resolve it against.
const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// Same reason as `ward-patient-search.dom.test.tsx`: `ClinicalRail` and the search page's own
// person links render `next/link` anchors, and this suite reads a real `href` off one of them
// rather than actually navigating, which a plain `<a>` supports and the App Router component does
// not under jsdom.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import {
  handOffTypedPatientQuery,
  takeHandedOffPatientQuery,
} from "@/components/ward-management/search/patient-query-handoff";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Echoes the live patient count so a test can observe `ADD_PATIENT` actually reaching state,
 *  without reaching into the reducer directly — same technique as `ClockAdvancer` in the sibling
 *  search suite. */
function PatientCount() {
  const { patients } = useWardFlow();
  return <span data-testid="patient-count">{patients.length}</span>;
}

/** Echoes the most-recently-added patient's `gender` (or the string "none" for an absent key,
 *  never `undefined` rendered as an empty node) — the read-back half of the Gender control's
 *  catcher, same "observe live state" technique as `PatientCount` above. */
function LastPatientGender() {
  const { patients } = useWardFlow();
  const last = patients[patients.length - 1];
  return <span data-testid="last-patient-gender">{last && "gender" in last ? (last.gender ?? "none") : "none"}</span>;
}

/** Echoes the live referral count — the "stays two acts" catcher: `ADD_PATIENT` must never create
 *  a `Referral`, however this screen's fields grow in the future. */
function ReferralCount() {
  const { referrals } = useWardFlow();
  return <span data-testid="referral-count">{referrals.length}</span>;
}

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AddPatientForm />
      <PatientCount />
      <LastPatientGender />
      <ReferralCount />
    </WardFlowProvider>,
  );
}

function fillDraft() {
  fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM999999" } });
  fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Testable" } });
  fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Newcomer" } });
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1990-01-01" } });
}

describe("AddPatientForm", () => {
  it("renders the screen and its four labelled fields", () => {
    renderForm();

    expect(screen.getByTestId("ward-add-patient-screen")).toBeInTheDocument();
    expect(screen.getByLabelText(/Record number|UMRN/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Given name")).toBeInTheDocument();
    expect(screen.getByLabelText("Family name")).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth")).toBeInTheDocument();
  });

  it("keeps Add patient unavailable, and dispatches nothing, while any field is unanswered", () => {
    renderForm();
    const before = Number(screen.getByTestId("patient-count").textContent);
    // Precondition: there is a real starting count to hold constant, not an empty seed that would
    // make "unchanged" true trivially.
    expect(before).toBeGreaterThan(0);

    const submit = screen.getByTestId("ward-add-patient-submit");
    expect(submit).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(submit);

    expect(Number(screen.getByTestId("patient-count").textContent)).toBe(before);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("submitting a fully-answered draft dispatches ADD_PATIENT, the new patient reaches state, and the form navigates to that person's own screen", async () => {
    renderForm();
    const before = Number(screen.getByTestId("patient-count").textContent);
    expect(before).toBeGreaterThan(0);

    fillDraft();

    const submit = screen.getByTestId("ward-add-patient-submit");
    expect(submit).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submit);
    // Keep the pending control keyboard-reachable while blocking duplicate submissions.
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);
    fireEvent.submit(screen.getByTestId("ward-add-patient-form"));

    // The dispatch reaches state: the live patient count grows by exactly one.
    await waitFor(() => {
      expect(Number(screen.getByTestId("patient-count").textContent)).toBe(before + 1);
    });

    // The screen navigates to the new person's own page — not search, not the same screen — found
    // by identity (a real `PT-A…` id), never assumed to be a fixed string.
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    });
    const [target] = router.push.mock.calls[0] as [string];
    expect(target).toMatch(/^\/mockups\/ward-flow\/people\/PT-A\d+$/);
  });
});

describe("PatientSearchPage empty state", () => {
  function renderSearch() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
  }

  it("offers a real link to /mockups/ward-flow/people/new when nobody is found, and hands off what was typed in memory rather than in the link", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Zzzznotarealname" } });

    expect(screen.getByTestId("ward-patient-search-people-empty")).toBeInTheDocument();
    const link = screen.getByTestId("ward-patient-search-people-empty-add");
    // ⚠️ THE TYPED TEXT IS NOT IN THIS HREF. It used to be a `?search=` query parameter — a name or
    // record number written into browser history and every proxy log between here and the server.
    // See `patient-query-handoff.ts`'s own doc comment for the ruling this closes.
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/people/new");
    expect(link).toHaveTextContent("Add patient");

    // The raw search travels unassigned through the in-memory channel instead; the form must not
    // infer which identity field it names. `takeHandedOffPatientQuery` both proves the write
    // happened and clears it, the same read `AddPatientForm`'s own mount performs.
    fireEvent.click(link);
    expect(takeHandedOffPatientQuery()).toEqual({ text: "Zzzznotarealname", assignTo: "carried" });
  });

  it("states the search scope and asks for an identity check before adding", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Zzzznotarealname" } });

    expect(screen.getByTestId("ward-patient-search-people-empty")).toHaveTextContent(
      /No matching person, waiting referral or open movement\. Check the spelling or (record number|UMRN) before adding a patient\./i,
    );
  });

  // A multi-word query proves the WHOLE string is handed off, unsplit — see
  // `patient-query-handoff.ts`'s own comment for why splitting on the space would be a guess.
  it("hands off a multi-word query whole, unsplit, through the in-memory channel", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Mary Anne Halloway" } });

    const link = screen.getByTestId("ward-patient-search-people-empty-add");
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/people/new");
    fireEvent.click(link);
    expect(takeHandedOffPatientQuery()).toEqual({ text: "Mary Anne Halloway", assignTo: "carried" });
  });
});

describe("AddPatientForm — FIX 1, reading the carried-forward query back", () => {
  // The handoff module is a plain in-memory singleton shared across this whole file, so every test
  // here drains it — otherwise a write left over from a test that never rendered `AddPatientForm`
  // would apply itself to a later, unrelated `renderForm()`.
  afterEach(() => {
    takeHandedOffPatientQuery();
  });

  it("prefills Given name from the handed-off query, and leaves Family name blank for the clinician to answer", () => {
    handOffTypedPatientQuery("Mary Anne Halloway", "given-name");

    renderForm();

    // The prefill is read once, in `AddPatientForm`'s own `useState` initialiser — which runs
    // during the component's first render, before anything paints — so it is present immediately,
    // with no re-render or effect to wait on.
    expect(screen.getByLabelText("Given name")).toHaveValue("Mary Anne Halloway");
    // THE JUDGEMENT CALL, proven directly: the whole typed string lands in ONE field. Family name
    // is left blank rather than guessed at from a split.
    expect(screen.getByLabelText("Family name")).toHaveValue("");
  });

  it("leaves both name fields blank when there is nothing handed off", () => {
    renderForm();

    expect(screen.getByLabelText("Given name")).toHaveValue("");
    expect(screen.getByLabelText("Family name")).toHaveValue("");
  });

  // ⚠️ THE PREFILL APPLIES EXACTLY ONCE — proven directly, not just asserted in a comment.
  // `takeHandedOffPatientQuery` clears the channel the instant `AddPatientForm`'s initial state
  // reads it, so nothing is left pending to reapply itself on a later render of this same
  // instance — unlike the `?name=` query parameter this replaced, which stayed live in the address
  // bar for as long as the page did and needed an explicit one-shot guard to stop re-winning every
  // keystroke. That guard is gone because the channel itself is now the one-shot.
  it("⚠️ applies the handed-off name once, then leaves it alone — typing afterwards must not be fought", () => {
    handOffTypedPatientQuery("Mary Anne Halloway", "given-name");

    renderForm();

    expect(screen.getByLabelText("Given name")).toHaveValue("Mary Anne Halloway");

    // The clinician corrects the prefill — the exact case a re-firing prefill would fight.
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marianne" } });
    expect(screen.getByLabelText("Given name")).toHaveValue("Marianne");

    // A further keystroke must not let a stale handoff win again and overwrite the correction —
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marianne H" } });
    expect(screen.getByLabelText("Given name")).toHaveValue("Marianne H");

    // Clearing the field entirely must not be read as "still blank, apply the prefill again" —
    // the initial-state read ran once, at mount, and nothing on this component re-reads the
    // channel afterwards, however the field's own value changes.
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "" } });
    expect(screen.getByLabelText("Given name")).toHaveValue("");
  });
});

describe("AddPatientForm — FIX 3, the unanswered-fields notice is announced only on an attempted submit", () => {
  it("is present on mount (every field starts blank) but is NOT an alert region yet", () => {
    renderForm();

    const notice = screen.getByTestId("ward-add-patient-unavailable");
    expect(notice).toBeInTheDocument();
    // A screen reader must not be interrupted the instant this screen loads — nothing has been
    // attempted yet, so this is a static hint, not an alert.
    expect(notice).not.toHaveAttribute("role", "alert");
  });

  it("becomes an alert once the clinician clicks Add patient while a field is still unanswered", () => {
    renderForm();

    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));

    expect(screen.getByTestId("ward-add-patient-unavailable")).toHaveAttribute("role", "alert");
  });

  it("becomes an alert on the keyboard route too — submitting the form directly, not via the button", () => {
    renderForm();

    fireEvent.submit(screen.getByTestId("ward-add-patient-form"));

    expect(screen.getByTestId("ward-add-patient-unavailable")).toHaveAttribute("role", "alert");
  });
});

/**
 * ⚠️ THE CREATION-TIME DUPLICATE CHECK — the door that actually stops the harm.
 *
 * The search screen's near-spelling suggestion helps the clinician who reads it. This catches the
 * one who did not, and that is the one who creates the duplicate. The journey: search "Halowin",
 * be told nobody of that name is known, press Add, and land here with "Halowin" already in Given
 * name while Marcus HALLOWIN sits in the system.
 *
 * ⚠️ `b273dc96b` MADE THAT JOURNEY QUICKER by carrying the typed text forward — before it, the
 * clinician had to retype the name and might have typed it correctly. These tests pin what now
 * stands in the way.
 */
describe("AddPatientForm — the creation-time duplicate check", () => {
  afterEach(() => {
    takeHandedOffPatientQuery();
  });

  /** The notice's three states, read as one value so a test can never assert two at once. */
  function checkState(): "unchecked" | "none" | "matches" {
    if (screen.queryByTestId("ward-add-patient-duplicate-unchecked")) return "unchecked";
    if (screen.queryByTestId("ward-add-patient-duplicate-none")) return "none";
    return "matches";
  }

  it("⚠️ shows the warning AND the prefilled name together, which is the whole acceptance test", () => {
    handOffTypedPatientQuery("Halowin", "given-name");
    renderForm();

    expect(screen.getByLabelText("Given name")).toHaveValue("Halowin");
    // ⚠️ TOGETHER IS THE POINT, not merely "the warning exists". The prefill is what makes the
    // duplicate quick; a warning that waited for a submit attempt would arrive after the record
    // number and the date of birth had been typed, which is exactly when nobody re-reads the top
    // of a form they have just filled in.
    const notice = screen.getByTestId("ward-add-patient-duplicate-check");
    expect(
      notice.textContent,
      "the prefilled misspelling is on screen with nothing saying an almost identical person " +
        "already exists — which is how a second record for Marcus Hallowin gets created",
    ).toContain("Marcus Hallowin");
    // The identifier, because by construction the NAME cannot distinguish these two people.
    expect(notice.textContent).toContain("UM100002");
    expect(notice.textContent).toContain("1961-11-02");
  });

  it("⚠️ keeps warning after the obvious tidy-up — the case that broke in nearPatients", () => {
    renderForm();
    // The clinician realises "Halowin" is a surname and moves it, typing the given name correctly.
    // An "already found" guard used to exclude Marcus Hallowin the instant "Marcus" matched his
    // real given name exactly — so the warning vanished at the moment the record became MOST
    // obviously a duplicate. Right first name, misspelt surname is the commonest duplicate there
    // is. Found by standing where the caller stands; fixed in `nearPatients` at a3886747e.
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marcus" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Halowin" } });

    expect(checkState()).toBe("matches");
    expect(screen.getByTestId("ward-add-patient-duplicate-check").textContent).toContain("Marcus Hallowin");
  });

  it("⚠️ says the check has NOT RUN rather than reporting a clear result, below the matcher's floor", () => {
    renderForm();
    // ⚠️ THREE STATES, NOT TWO, AND I DEMANDED THIS OF THE SEARCH SCREEN BEFORE APPLYING IT HERE.
    // "No similar names" over a blank form is a reassurance nobody earned: `nearPatients` will not
    // look at a term below four characters, so there is no result to report. A screen that has not
    // looked and a screen that looked and found nothing are different answers.
    expect(checkState(), "a blank form claims a clear result").toBe("unchecked");

    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Mar" } });
    expect(checkState(), "a three-letter name claims a clear result the matcher never produced").toBe("unchecked");

    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marc" } });
    expect(checkState(), "at the matcher's own floor the check still refuses to report").not.toBe("unchecked");
  });

  it("says plainly when nobody is near, rather than falling silent", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Zebedee" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Ashgrove" } });
    // Silence reads as "we checked and it is clear" — a reassurance the screen would be issuing on
    // its own authority. An empty result and no check are different answers and must look different.
    expect(checkState()).toBe("none");
    expect(screen.getByTestId("ward-add-patient-duplicate-none")).toBeInTheDocument();
  });

  it("⚠️ NEVER BLOCKS, and offers no way to dismiss it", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM100099" } });
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marcus" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Halowin" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1961-11-02" } });

    expect(checkState(), "the warning is not even showing, so the assertion below proves nothing").toBe("matches");
    const submit = screen.getByRole("button", { name: "Add patient" });
    // ⚠️ Two people really can have near-identical names. A hard stop would be worked around by
    // typing a name that does not collide, which puts a deliberately WRONG name into an identity
    // record — worse than the duplicate it prevented.
    expect(submit.getAttribute("aria-disabled"), "the warning has become a gate").toBeNull();
    expect((submit as HTMLButtonElement).disabled, "the warning has become a gate").toBe(false);
    // ⚠️ A dismiss control on a notice that updates as you type becomes a thing clicked once and
    // never seen again while the names go on matching.
    expect(
      screen.getByTestId("ward-add-patient-duplicate-check").querySelector("button"),
      "the notice can be dismissed, so it can be silenced while it is still true",
    ).toBeNull();
  });
});

/**
 * ⚠️ THE EXACT-DUPLICATE TIERS — the hole I declared in my own work rather than leaving it to be
 * found. `nearPatients` cannot report an exact duplicate by construction, because a string is not
 * one keystroke from itself, so re-entering Marcus Hallowin with BOTH names spelled correctly
 * produced no warning at all. The near-miss case was covered and the exact case was not, which is
 * the wrong way round for how often each happens.
 */
describe("AddPatientForm — the exact-duplicate tiers", () => {
  function type(umrn: string, given: string, family: string, born: string) {
    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: umrn } });
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: given } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: family } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: born } });
  }

  it("⚠️ states a record-number collision FLATLY, because it is not a resemblance", () => {
    renderForm();
    type("UM100002", "", "", "");
    // A record number is unique by definition: either this is the same person or somebody
    // mistyped. There is no third reading in which a new patient legitimately holds it, so a
    // hedged "might be" would be a WEAKER claim than the evidence supports.
    const notice = screen.getByTestId("ward-add-patient-duplicate-umrn");
    // ⚠️ "UM100002" REMOVED FROM THIS LIST 2026-09-09, AND IT IS THE WHOLE FIX. That string is the
    // record number THIS TEST TYPED IN, echoed straight back by `{draft.umrn.trim()}`. Because
    // expectSays is satisfied by ANY ONE spelling, the echo alone passed the assertion — so the
    // guard could not fail while the branch rendered at all. Proved by deleting the entire
    // "already belongs to <name> (born <dob>)" clause: 23/23 still passed.
    //
    // The identity of the EXISTING holder is the claim this refusal exists to make — a coordinator
    // must be told whose record they are colliding with. It is DATA, so it is pinned deliberately.
    expectSays(notice.textContent ?? "", "the duplicate-record refusal", ["Hallowin"]);
    expect(
      notice.textContent,
      "the collision is hedged, which understates evidence that admits only two readings",
    ).not.toMatch(/might|possibly|perhaps/i);
  });

  it("distinguishes same-name-same-birth-date from same-name-birth-date-unconfirmed", () => {
    const first = renderForm();
    type("", "Marcus", "Hallowin", "1961-11-02");
    expect(screen.getByTestId("ward-add-patient-duplicate-same-name-same-dob")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-add-patient-duplicate-same-name")).not.toBeInTheDocument();
    first.unmount();

    renderForm();
    type("", "Marcus", "Hallowin", "1999-01-01");
    expect(screen.getByTestId("ward-add-patient-duplicate-same-name")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-add-patient-duplicate-same-name-same-dob")).not.toBeInTheDocument();
  });

  it("labels each candidate with why it matched, never with a made-up percentage", () => {
    // 25 September 2026 audit, A8: the cards read "100% match", "98% match", "85% match" and "72%
    // match", figures nothing computed. What the comparison found is the reason, so that is the label.
    const first = renderForm();
    type("", "Marcus", "Hallowin", "1961-11-02");
    const exact = screen.getByTestId("ward-add-patient-duplicate-check").textContent ?? "";
    expect(exact).toContain("Same name & DOB");
    expect(exact).not.toMatch(/\d+\s*% match/);
    first.unmount();

    renderForm();
    type("", "Marcus", "Halowin", "");
    const near = screen.getByTestId("ward-add-patient-duplicate-check").textContent ?? "";
    expect(near).toContain("Similar spelling");
    expect(near).not.toMatch(/\d+\s*% match/);
  });

  it("⚠️ never says the date of birth is DIFFERENT when the field is blank", () => {
    renderForm();
    // This screen reaches this tier with the date of birth not yet typed EVERY time, because the
    // notice renders live from first paint. "Different date of birth" would be a false statement
    // about an empty field, on a clinical record. Ward Builder Three renamed the tier for this
    // reason and declined my request to split it, correctly: two arrays would have tempted this
    // copy into exactly that falsehood.
    type("", "Marcus", "Hallowin", "");
    const notice = screen.getByTestId("ward-add-patient-duplicate-same-name");
    expect(notice).toBeInTheDocument();
    // ⚠️ THE PROPERTY, NOT A LIST OF PHRASINGS. My first version of this assertion named two
    // wordings — "different date of birth" and "dates differ" — and a mutation writing "The date
    // of birth is different" walked straight past both. A denylist of sentences somebody thought
    // of is not a check on what the sentence CLAIMS. With the field blank, no form of the word
    // "differ" can be true here, so that is what is asserted.
    expect(
      notice.textContent,
      "the screen asserts the dates differ when no date has been given — a false statement about " +
        "an empty field, on an identity record",
    ).not.toMatch(/differ/i);
    expect(notice.textContent, "the same falsehood by another route").not.toMatch(/does not match|do not match/i);
  });

  it("⚠️ an unknown record number says no record matches, and NEVER 'did you mean'", () => {
    renderForm();
    type("UM19999", "", "", "");
    // `nearPatients` deliberately never near-matches a record number: a number one keystroke from
    // another IS a different patient. So there is no such thing as a near-miss here, and offering
    // one would be the single most dangerous sentence on this page.
    expect(screen.getByTestId("ward-add-patient-duplicate-none")).toBeInTheDocument();
    expect(
      screen.getByTestId("ward-add-patient-duplicate-check").textContent,
      "a record number was offered as a near miss, which would point a clinician at a different person",
    ).not.toMatch(/did you mean/i);
  });

  it("names nobody twice across the tiers", () => {
    renderForm();
    type("UM100002", "Marcus", "Hallowin", "1961-11-02");
    const rows = screen.getAllByTestId(/^ward-add-patient-duplicate-PT-/);
    expect(rows.length, "no candidate is listed at all, so this asserts nothing").toBeGreaterThan(0);
    const ids = rows.map((row) => row.getAttribute("data-testid"));
    // A screen that says the same thing twice about one person trains a reader to skim both.
    expect(new Set(ids).size, "the same person is named more than once in one notice").toBe(ids.length);
  });

  it("still does not block, even on a record-number collision", () => {
    renderForm();
    type("UM100002", "Marcus", "Hallowin", "1961-11-02");
    expect(screen.getByTestId("ward-add-patient-duplicate-umrn")).toBeInTheDocument();
    // ⚠️ Tempting to block, because a duplicate record number is definitively wrong. But a
    // clinician who cannot proceed types a DIFFERENT record number, which puts a knowingly wrong
    // identifier into a clinical record — worse than the duplicate it prevented.
    const submit = screen.getByRole("button", { name: "Add patient" });
    expect(submit.getAttribute("aria-disabled"), "the collision has become a gate").toBeNull();
    expect((submit as HTMLButtonElement).disabled, "the collision has become a gate").toBe(false);
  });
});

describe("AddPatientForm — Q004 registration workspace", () => {
  afterEach(() => {
    takeHandedOffPatientQuery();
  });

  it("keeps a carried search unassigned until the user chooses an identity field", () => {
    handOffTypedPatientQuery("Mary Anne Halloway", "carried");
    renderForm();
    const before = screen.getByTestId("patient-count").textContent;
    const navigationCount = router.push.mock.calls.length;
    for (const label of [/Record number|UMRN/i, "Given name", "Family name", "Date of birth"]) {
      expect(screen.getByLabelText(label)).toHaveValue("");
    }
    expect(screen.getByTestId("ward-add-patient-carried-search")).toHaveTextContent("Mary Anne Halloway");
    fireEvent.click(screen.getByRole("button", { name: "Use as given name" }));
    expect(screen.getByLabelText("Given name")).toHaveValue("Mary Anne Halloway");
    expect(screen.getByLabelText("Family name")).toHaveValue("");
    expect(screen.getByLabelText(/Record number|UMRN/i)).toHaveValue("");
    expect(screen.getByTestId("patient-count").textContent).toBe(before);
    expect(router.push).toHaveBeenCalledTimes(navigationCount);
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "" } });
    expect(screen.getByLabelText("Given name")).toHaveValue("");
    expect(screen.queryByTestId("ward-add-patient-carried-search")).not.toBeInTheDocument();
  });

  it("assigns an explicit record-number choice and immediately checks existing records", () => {
    handOffTypedPatientQuery("UM100002", "carried");
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /Use as (record number|UMRN)/i }));
    expect(screen.getByLabelText(/Record number|UMRN/i)).toHaveValue("UM100002");
    expect(screen.getByLabelText("Given name")).toHaveValue("");
    expect(screen.getByLabelText("Family name")).toHaveValue("");
    expect(screen.getByTestId("ward-add-patient-duplicate-umrn")).toHaveTextContent("Marcus Hallowin");
    expect(screen.getByTestId("ward-add-patient-submit")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not overwrite entered identity fields with carried search text", () => {
    handOffTypedPatientQuery("Unassigned", "carried");
    renderForm();
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Entered name" } });
    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM999999" } });
    const nameButton = screen.getByRole("button", { name: "Use as given name" });
    const numberButton = screen.getByRole("button", { name: /Use as (record number|UMRN)/i });
    expect(nameButton).toBeDisabled();
    expect(numberButton).toBeDisabled();
    fireEvent.click(nameButton);
    fireEvent.click(numberButton);
    expect(screen.getByLabelText("Given name")).toHaveValue("Entered name");
    expect(screen.getByLabelText(/Record number|UMRN/i)).toHaveValue("UM999999");
    expect(screen.getByTestId("ward-add-patient-carried-search")).toBeInTheDocument();
  });

  it("keeps live duplicate checks and a return route beside registration, without an unrelated patient sampler", () => {
    renderForm();
    const count = Number(screen.getByTestId("patient-count").textContent);
    expect(count).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-add-patient-duplicate-check")).toHaveTextContent(
      `Duplicate check covers all ${count} patient records.`,
    );
    expect(screen.getByTestId("ward-add-patient-duplicate-unchecked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to patient search" })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/search",
    );
    expect(screen.queryByTestId("ward-add-patient-board-list")).not.toBeInTheDocument();
  });
});

describe("AddPatientForm — third-edition upgrade, the Gender control", () => {
  it("defaults to 'Not yet recorded' and omits the gender key entirely on submit", async () => {
    renderForm();
    // The literal sentinel `add-patient.tsx`'s own `GENDER_NOT_RECORDED` uses — not exported, so
    // named here rather than imported, matching this file's existing style of pinning values
    // rather than reaching into the component's private constants.
    expect(screen.getByLabelText("Gender")).toHaveValue("not-recorded");

    fillDraft();
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("last-patient-gender")).toHaveTextContent("none");
    });
  });

  it("dispatches 'Female' when chosen", async () => {
    renderForm();
    fillDraft();
    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "Female" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("last-patient-gender")).toHaveTextContent("Female");
    });
  });

  it("dispatches 'Male' when chosen", async () => {
    renderForm();
    fillDraft();
    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "Male" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("last-patient-gender")).toHaveTextContent("Male");
    });
  });

  it("never gates 'Add patient' on Gender — the field starts unanswerable and the button is still available once identity is complete", () => {
    renderForm();
    fillDraft();
    const submit = screen.getByTestId("ward-add-patient-submit");
    expect(submit.getAttribute("aria-disabled"), "Gender became a required gate").toBeNull();
  });
});

/**
 * ⚠️ THE "STAYS TWO ACTS" CATCHER — `contract-referrals.md`'s own extra catcher, in the opposite
 * direction: `ADD_PATIENT` must never create a `Referral`, however this screen's fields grow.
 */
describe("AddPatientForm — ADD_PATIENT never creates a referral", () => {
  it("leaves the referral count unchanged after adding a patient, with or without a gender chosen", async () => {
    renderForm();
    const referralsBefore = Number(screen.getByTestId("referral-count").textContent);

    fillDraft();
    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "Female" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("last-patient-gender")).toHaveTextContent("Female");
    });
    expect(Number(screen.getByTestId("referral-count").textContent)).toBe(referralsBefore);
  });
});

describe("AddPatientForm safety regressions", () => {
  beforeEach(() => router.push.mockClear());
  it("recovers from a rejected duplicate and can submit a corrected identity", async () => {
    renderForm();
    const before = Number(screen.getByTestId("patient-count").textContent);
    fillDraft();
    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM100002" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));

    expect(await screen.findByTestId("ward-add-patient-rejection")).toHaveTextContent("Patient could not be added");
    expect(screen.getByTestId("ward-add-patient-submit")).toHaveTextContent("Add patient");
    expect(Number(screen.getByTestId("patient-count").textContent)).toBe(before);
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: "UM999999" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
    await waitFor(() => expect(Number(screen.getByTestId("patient-count").textContent)).toBe(before + 1));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("clears every intake field and notice after confirming reset", () => {
    renderForm();
    fillDraft();
    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "Female" } });
    fireEvent.change(screen.getByLabelText("Indigenous status"), { target: { value: "aboriginal" } });
    fireEvent.change(screen.getByLabelText(/^Address/), { target: { value: "1 Invented Street" } });
    fireEvent.change(screen.getByTestId("ward-add-patient-suburb"), { target: { value: "Armadale" } });
    fireEvent.change(screen.getByLabelText("Health service catchment"), { target: { value: "East Metro" } });
    fireEvent.change(screen.getByLabelText("Presenting facility"), { target: { value: "rph-ed" } });
    fireEvent.click(screen.getByRole("button", { name: /^ATS 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Form 1A/ }));
    fireEvent.change(screen.getByLabelText("Presenting complaint / reason for admission"), {
      target: { value: "other" },
    });
    fireEvent.change(screen.getByLabelText("Clinical intake notes"), { target: { value: "Invented intake note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    fireEvent.click(screen.getByTestId("ward-add-patient-reset"));
    expect(screen.getByRole("dialog", { name: "Reset patient form?" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-add-patient-reset-confirm"));

    for (const label of [
      /Record number|UMRN/i,
      "Given name",
      "Family name",
      "Date of birth",
      /^Address/,
      "Clinical intake notes",
    ]) {
      expect(screen.getByLabelText(label)).toHaveValue("");
    }
    expect(screen.getByLabelText("Gender")).toHaveValue("not-recorded");
    expect(screen.getByLabelText("Indigenous status")).toHaveValue("not-stated");
    expect(screen.getByTestId("ward-add-patient-suburb")).toHaveValue("");
    expect(screen.getByLabelText("Health service catchment")).toHaveValue("");
    expect(screen.getByLabelText("Presenting facility")).toHaveValue("");
    expect(screen.getByRole("button", { name: /^ATS 4/ })).toHaveAttribute("aria-pressed", "true");
    expect(
      within(screen.getByRole("group", { name: "Legal status" })).getByRole("button", { name: /^Voluntary/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Presenting complaint / reason for admission")).toHaveValue("assessment");
    expect(screen.queryByTestId("ward-add-patient-d4-notice")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["Indigenous status", "Triage urgency", "Legal status", "Presenting complaint"])(
    "asks before discarding a change only to %s",
    (field) => {
      renderForm();
      if (field === "Indigenous status")
        fireEvent.change(screen.getByLabelText(field), { target: { value: "aboriginal" } });
      if (field === "Triage urgency") fireEvent.click(screen.getByRole("button", { name: /^ATS 1/ }));
      if (field === "Legal status") fireEvent.click(screen.getByRole("button", { name: /^Form 1A/ }));
      if (field === "Presenting complaint")
        fireEvent.change(screen.getByLabelText("Presenting complaint / reason for admission"), {
          target: { value: "other" },
        });
      fireEvent.click(screen.getByTestId("ward-add-patient-reset"));
      expect(screen.getByRole("dialog", { name: "Reset patient form?" })).toBeInTheDocument();
    },
  );
});
