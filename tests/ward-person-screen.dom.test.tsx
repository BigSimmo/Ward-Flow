import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PatientId } from "../src/components/ward-management/ward-patients";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
// `patientAgeYears` is deliberately NOT imported — see the age assertion below. Importing it here
// is what made this test a mirror of the function it was supposed to check.
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import { allEmergencyDepartments, wardSites } from "@/components/ward-management/ward-sites";

import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { namesRealPlace } from "./helpers/ward-place-names";

/**
 * A PERSON'S OWN SCREEN — the subject is the PERSON, not a request for a bed.
 *
 * The owner's flow is *search for a patient, and if nobody comes up, add them, then refer from
 * their own screen.* Until now the last step had nowhere to happen: `patients/[patientId]` (since
 * moved to `movements/[movementId]`) looked a `Movement` up by id and rendered a movement
 * workspace, so the route named after people was about requests, and clicking a person in search
 * results did nothing at all because there was nowhere for the tile to point.
 *
 * ⚠️ **`FD-23` BINDS THIS SCREEN, AND THE LEDGER SAYS IT NEEDS A GUARD RATHER THAN A NOTE — FOR A
 * REASON THAT APPLIES TO THIS FILE SPECIFICALLY.** A ward may not see where else a patient has been
 * referred; the coordinator may. The owner's reason: so a ward does not take its time over a patient
 * who has been referred elsewhere.
 *
 * The ledger's warning is the part that matters here: *every instinct in a patient-centred design
 * says a patient screen shows everything known about that patient, so the omission looks like an
 * incomplete implementation rather than a decision, and a later reader will add it helpfully.* This
 * screen is the exact surface that instinct will act on. So the guard below asserts the ABSENCE —
 * `R9` shape — and says why, so the next person to feel that instinct meets the reason before they
 * act on it.
 *
 * ⚠️ **AND TODAY THE ABSENCE IS ALSO STRUCTURAL, WHICH IS WHY THE GUARD IS WRITTEN AS IT IS.**
 * `Referral` carries no patient link — `patientId` is named in `ALLOWED_REFERRAL_FIELDS`' own
 * comment as a field the guard exists to catch — so this screen COULD NOT show a person's referrals
 * even if it wanted to. A guard that only checked "no referrals are shown" would therefore pass
 * today for a reason that has nothing to do with `FD-23`, and would go on passing the day somebody
 * adds the link. It is written to fail on the CAPABILITY, not on today's emptiness.
 */
describe("a person's own screen", () => {
  const someone = seedWardFlowState().patients[0];

  // Typed `PatientId` rather than `string`: the default already IS one, and a test that could pass
  // a movement id here would be testing the thing the type now forbids.
  function renderPerson(id: PatientId = someone.id) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PersonScreen patientId={id} />
      </WardFlowProvider>,
    );
  }

  it("has a seeded person to render, or every assertion below is vacuous", () => {
    expect(someone, "the seed must carry at least one patient").toBeDefined();
    expect(someone.umrn.length).toBeGreaterThan(0);
    expect(someone.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows the person: name, record number, date of birth and age", () => {
    renderPerson();
    const identity = screen.getByTestId("ward-person-identity");
    expect(identity).toHaveTextContent(patientDisplayName(someone));
    expect(identity).toHaveTextContent(someone.umrn);
    expect(identity).toHaveTextContent(someone.dateOfBirth);
    /*
     * Age is DERIVED and never stored — `patientAgeYears` reads the date of birth. Asserted through
     * the same function the screen uses, so a screen that stored or recomputed its own age would
     * still have to agree with the one place this project derives it.
     *
     * 🔴 **THAT COMMENT WAS TRUE OF THE INTENT AND FALSE OF THE CODE UNTIL 2026-09-04, AND NOTHING
     * MADE THEM AGREE.** The computed `age` was used only as `typeof age === "number"` and then
     * discarded; the render was checked against any digits followed by "years". The reference date
     * passed in was 1 January of the BIRTH year, so even had the two been compared it would have
     * compared against roughly zero.
     *
     * Mutation-proved before and after: `ward-patients.ts` `return age` -> `return 999` turned the
     * model test red ("expected 999 to be 36") and left THIS test green while the screen rendered
     * "999 years". The control firing is what proves the mutant executed.
     *
     * ⚠️ It is fixed FIRST, ahead of the `dayZero` hazard it was found next to, and the order is
     * deliberate: `dayZero` reads the system clock unconditionally, and nothing today asserts a
     * calendar date derived from it. **Until this guard can fail, a future `dayZero` repair would
     * have had nothing to prove it worked.**
     *
     * `new Date()` is correct here and is not a flake: the screen's own `dayZero` reads the real
     * system clock too, so both sides move together. If a pinned date is ever introduced, this
     * assertion is the one that will go red and say so.
     */
    /*
     * 🔴 **COMPUTED HERE, NOT BY `patientAgeYears`, AND THE FIRST FIX GOT THIS WRONG.** Asserting
     * the render against the very function the screen calls is a MIRROR: mutating
     * `ward-patients.ts` to `return 999` moved BOTH sides, the screen rendered "999 years", and
     * this test stayed green — the same green the broken version gave. A test that recomputes
     * through the subject agrees with it forever, including when it is wrong.
     *
     * So the expected value is derived independently from the stored date of birth. The two
     * calculations now have to agree, which is what the comment above always claimed.
     */
    const born = new Date(someone.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - born.getFullYear();
    const monthsApart = today.getMonth() - born.getMonth();
    if (monthsApart < 0 || (monthsApart === 0 && today.getDate() < born.getDate())) age -= 1;
    expect(age).toBeGreaterThan(0);
    /*
     * ⚠️ THE UPPER BOUND IS THE ONE THING AN INDEPENDENT COMPUTATION CANNOT CATCH, and it is Ward
     * Builder Two's contribution after it conceded this file to master's version.
     *
     * Everything else here rests on computing the age twice, by two routes, and requiring the
     * answers to agree. That catches a wrong FUNCTION. It cannot catch a wrong FIXTURE: a date of
     * birth of 1200-03-14 gives an age of 826, both sides compute 826, they agree, and the screen
     * renders a number no human has ever had. Agreement is not plausibility.
     */
    expect(age, "a fixture date of birth is producing an implausible age; both sides would agree on it").toBeLessThan(
      130,
    );
    /*
     * ⚠️ `\b` FAILS AT BOTH ENDS HERE, AND IT COST TWO ATTEMPTS. Every figure and its unit are
     * separate elements, so `textContent` concatenates with no separator at all — the panel reads
     * "…Date of birth1988-03-14Age38yearsAge is calculated from…". There is no word boundary
     * between "Age" and "38", and none between "years" and the "Age" of the next sentence.
     *
     * The lookbehind does the job `\b` was there for — stopping a rendered "138" from satisfying an
     * expected "38". Nothing is needed at the tail: the number must sit immediately against the
     * word "year", which is the property being asserted.
     */
    expect(identity).toHaveTextContent(new RegExp(`(?<!\\d)${age}\\s*year`, "i"));
  });

  it("⚠️ NEVER SHOWS WHERE ELSE THIS PERSON HAS BEEN REFERRED — FD-23, asserted as an absence", () => {
    renderPerson();
    const screenRoot = screen.getByTestId("ward-person-screen");

    // Ward names, unit names and destination words are what a "where else" section would render.
    // Checked against the LIVE registers rather than a hand-written sample, so a place added later
    // is covered without anybody remembering to extend this.
    //
    // ⚠️ WIDENED 2026-09-02. This loop read `units` ONLY, so a hospital name, a hospital CODE or an
    // emergency-department name could have appeared on a person's screen unchallenged. All three
    // identify a destination exactly as well as a ward name does, which is the thing FD-23 forbids.
    // Two sibling files had the identical gap and were widened the same day.
    //
    // ⚠️ **LATENT, NOT LIVE.** `PersonScreen` renders no referral-derived data at all today —
    // `Referral` carries no patient link, so this screen COULD not show one. This is the tripwire
    // that catches the next leak once somebody wires that up, not evidence of a current one.
    const shown = screenRoot.textContent ?? "";
    const forbiddenPlaces = [
      ...seedWardFlowState().units.map((unit) => unit.name),
      ...wardSites.map((site) => site.name),
      ...wardSites.map((site) => site.code),
      ...allEmergencyDepartments().map((ed) => ed.name),
    ];

    // A guard over an empty register is green and worthless.
    expect(
      forbiddenPlaces.length,
      "the forbidden-place register is empty, so this guard checks nothing",
    ).toBeGreaterThan(0);

    for (const place of forbiddenPlaces) {
      expect(
        namesRealPlace(shown, place),
        `"${place}" appears on a person's screen. FD-23: a ward may not see where else a patient ` +
          "has been referred, so that a ward does not take its time over somebody already placed " +
          "elsewhere. If this is a coordinator-only surface now, that is a decision with the " +
          "owner's name on it — not something to unlock by deleting this assertion.",
      ).toBe(false);
    }
  });

  it("⚠️ AND THE SCREEN CANNOT REACH REFERRALS AT ALL — the guard that survives the link landing", async () => {
    // The capability check, and it reads the CODE rather than the prose: the assertion above passes
    // today for a structural reason (`Referral` has no patient link), so on its own it would keep
    // passing on the day somebody adds one and wires this screen up.
    //
    // Checking the `useWardFlow()` destructure is the precise form. A blunt search for the word
    // "referrals" would fail on this file's own doc comment explaining FD-23, which would teach the
    // next person to delete the guard rather than read it.
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/ward-management/patients/person-screen.tsx", "utf8");
    const destructure = source.match(/const\s*\{([^}]*)\}\s*=\s*useWardFlow\(\)/);
    expect(destructure, "the screen must read state through useWardFlow, or this guard sees nothing").not.toBeNull();

    const taken = (destructure?.[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    expect(taken.length, "an empty destructure would make the subset check below vacuous").toBeGreaterThan(0);
    for (const name of taken) {
      expect(
        ["patients", "dayZero", "now"],
        `the person screen takes "${name}" from ward state. FD-23 is a decision, not an unfinished ` +
          "feature: showing a person's referrals, movements or destinations here is the exact " +
          "'helpful' addition the ledger warns a later reader will make. Take it to the owner " +
          "before widening this list.",
      ).toContain(name);
    }
  });

  it("⚠️ AND THIS FILE NEVER REACHES FOR THE AGE HELPER AGAIN — the guard that stops the mirror returning", async () => {
    /*
     * 🔴 WHAT THIS PROTECTS, AND WHY A COMMENT WAS NOT ENOUGH.
     *
     * The age assertion above computes the age here, from the stored date of birth, deliberately
     * NOT by calling the same helper the screen calls. An earlier version imported that helper, and
     * a test that asks the screen and the helper to agree cannot notice when they are wrong
     * together — Ward Builder Two mutated the helper to `return age + 3`, a plausible wrong age well
     * inside any human range, and its version of this test PASSED while the sibling model test
     * caught it. The mutant demonstrably ran; the screen guard simply could not see it.
     *
     * That decision was pinned only by a comment at the top of this file. **A comment is exactly
     * what somebody simplifying "the duplicated arithmetic" deletes on the way to reintroducing the
     * mirror, with every test green — which is the state this file was already in once.** So the
     * decision is asserted now, not explained.
     *
     * ⚠️ THE NAME IS ASSEMBLED FROM TWO HALVES ON PURPOSE. A guard searching for a literal would
     * match its own source and fail on itself, and the next person would delete the guard rather
     * than read it — the trap the FD-23 guard above records against a blunt search for "referrals".
     * Comments are stripped for the same reason: this file's own doc comment names the helper while
     * explaining why it is not imported, and that prose must stay legal.
     */
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("tests/ward-person-screen.dom.test.tsx", "utf8");

    /*
     * 🔴 THE PRECONDITION, AND WARD VERIFIER FOUND TWO SILENT BYPASSES BEFORE IT EXISTED.
     *
     * Comment-stripping by regex is only sound while no string literal in this file contains a
     * comment sequence. Verifier measured what happens when one does:
     *
     *   a BLOCK-comment opener inside a string -> opens a phantom comment that runs to the next
     *                            real close, deleting 1,157 characters of REAL code including a
     *                            genuine helper call. Both anti-vacuity assertions below still
     *                            passed: the length stayed well over 2,000, and the upper-bound
     *                            marker survived because the phantom opened after it.
     *   a LINE-comment opener inside a string  -> deletes the rest of that line. Moves the
     *                            stripped length by 22 characters, which NO length assertion
     *                            can see.
     *
     * ⚠️ THE SEQUENCES ARE DESCRIBED IN WORDS HERE AND NOT QUOTED, AND THAT IS THE POINT RATHER
     * THAN AN INCONVENIENCE. The first version of this comment quoted them inside backticks, and
     * the assertion below — which scans raw file text, comments included — flagged its own
     * explanation. **The temptation at that moment is to soften the guard so it can be
     * documented. Do not.** A blunt check that occasionally flags prose is a false positive the
     * author controls; a cleverer one has more room to be wrong about code. Reword the prose.
     *
     * ⚠️ And my own hypothesis — a string containing a CLOSING sequence — was wrong, tested in
     * both directions: it can only close a comment early, which leaks prose IN. That is the
     * false-alarm direction and it is harmless. **The hiding direction is the OPENING sequence.**
     *
     * A correct stripper needs a tokenizer, which is too much to own here. So the assumption is
     * asserted instead, and fails loudly the day it stops holding. Escaped pairs are removed
     * first, because this file's own guard regex writes the sequences backslash-escaped — they
     * are not adjacent characters there, which is why the control is green for a real reason
     * rather than a lucky one.
     */
    const deEscaped = source.replace(/\\./g, "");
    const risky = deEscaped
      .split("\n")
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /(["'`])[^"'`\n]*(\/\*|\/\/)/.test(line))
      .map(({ number }) => number);
    expect(
      risky,
      "a string literal in this file now contains a comment-opening sequence, so the " +
        "comment stripping below is no longer sound and can silently delete real code. " +
        "Escape the sequence, or move the value out of a literal.",
    ).toEqual([]);

    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Anti-vacuity: if comment-stripping ate the file, every check below passes over nothing.
    expect(code.length, "comment stripping removed almost the whole file").toBeGreaterThan(2000);
    expect(code, "the stripped code no longer contains the age assertion this guard protects").toContain(
      "toBeLessThan(",
    );

    const helper = "patientAge" + "Years";
    expect(
      code.includes(helper),
      `${helper} is referenced in this file's CODE. The age here is computed locally on purpose: ` +
        "asking the screen and the helper to agree cannot catch them being wrong together. " +
        "If you are consolidating the duplicated arithmetic, that is the defect, not the tidy-up.",
    ).toBe(false);
  });

  it("offers a way to refer this person, which is the whole point of the screen", () => {
    renderPerson();
    const refer = screen.getByTestId("ward-person-refer");
    expect(refer).toBeInTheDocument();
    expect(refer).toHaveTextContent(/refer/i);
    // Owner ruling 9, 2026-09-03: the control's wording is "Refer Patient". Asserted exactly,
    // because the `/refer/i` above passes against any sentence containing the word.
    expect(refer).toHaveTextContent(/^Refer Patient$/);
  });

  /**
   * ⚠️ THE LINK'S QUERY KEY, WHICH NOTHING TESTED UNTIL NOW — owner ruling 9, 2026-09-03.
   *
   * Found by attacking the patient-link privacy change: renaming this key from `patientId` to
   * `patient` left **75 tests green** across `ward-person-screen`, `ward-referral-destinations`
   * and `ward-referral-model`, while every referral raised from this screen recorded NOBODY —
   * and the paragraph below the button went on saying "recorded against this person", itself
   * pinned by one of those passing tests. **A false sentence held up by a green test.**
   *
   * ⚠️ WHY THE EXISTING COVERAGE COULD NOT SEE IT: the end-to-end test sets the URL BY HAND
   * (`window.history.pushState(..., "?patientId=PT-001")`) and only then renders the intake. It
   * hardcodes the exact string this component is supposed to build, so producer and reader look
   * jointly tested and are not. And no browser journey reaches this screen at all — checked with
   * a control, after a first control came back empty and proved nothing.
   *
   * This asserts the producer's half of the contract: the key by name, and the id encoded.
   */
  it("builds the referral link with the patientId key, so the intake can read it back", () => {
    renderPerson();
    const href = screen.getByTestId("ward-person-refer").getAttribute("href");

    expect(href, "the Refer control must link somewhere").toBeTruthy();
    // The key by NAME. A test that only checked the id appeared somewhere in the href would pass
    // against `?patient=PT-001`, which is precisely the rename that broke nothing and everything.
    expect(href).toContain(`patientId=${encodeURIComponent(someone.id)}`);
    expect(href).toContain("/mockups/ward-flow/referrals/new");
  });

  it("says the referral IS recorded against this person, and promises no history", () => {
    // ⚠️ THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-09-02, AND IT IS WHY THE COPY COULD NOT
    // SILENTLY GO STALE. It pinned "the referral will NOT yet be attached to this person", which
    // was true while `Referral` had no patient link. The owner ruled that it may have one, and the
    // moment the Refer button began carrying `patientId` that sentence became a lie on a clinical
    // screen. This test went red in the same run — the copy and the capability could not part
    // company. Ward Lead expected nothing to fail here; this did.
    renderPerson();
    const note = screen.getByTestId("ward-person-refer-note");
    expect(note).toHaveTextContent(/linked to this patient/i);
    // The route carries only the patient pointer, rather than copying identity into the URL.
    const href = screen.getByTestId("ward-person-refer").getAttribute("href");
    const query = new URLSearchParams(href?.split("?")[1]);
    expect([...query.keys()]).toEqual(["patientId"]);
    expect(note).toHaveTextContent(/referral history is unavailable/i);
  });

  it("REFUSES AN UNKNOWN PERSON rather than substituting one", () => {
    renderPerson("PT-does-not-exist");
    expect(screen.getByTestId("ward-person-missing")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-person-identity")).toBeNull();
    // The specific failure this guards: rendering `patients[0]` for an unrecognised id, which looks
    // like a working screen and is a different human being.
    expect(screen.getByTestId("ward-person-screen").textContent ?? "").not.toContain(patientDisplayName(someone));
  });

  it("carries the synthetic-prototype banner every ward screen carries", () => {
    renderPerson();
    expect(within(screen.getByTestId("ward-person-screen")).getByText(/synthetic/i)).toBeInTheDocument();
  });

  /**
   * D-1 (owner, 2026-09-10): "But call this page Patient." `owner-decisions-2026-09-1x.md`, D-1.
   * Binds the document title (and, for a top-level document, the accessible name a screen reader
   * announces on load), the label in any navigation list, and the words any other screen uses to
   * link here. It does NOT rename `patientId`, `patientHref`, `ward-patients-seed.ts` or this
   * directory — "not implied and not authorised" — and it does NOT move the `<h1>` off the
   * person's own name; Ward Lead confirmed the `<h1>` stays the name, with "Patient" becoming the
   * page's name everywhere else.
   *
   * "Patient Now" is the drawing's title (`docs/ward-flow/mockups/patient-now-third-edition.html`,
   * Ward Mockups' file, never edited from here) and must never reach the built screen's own text.
   */
  it("is called Patient, and never Patient Now", () => {
    renderPerson();
    expect(document.title).toMatch(/^Patient\b/);
    expect(document.body.textContent).not.toMatch(/Patient Now/);
  });

  it("is still called Patient on the no-such-person state — the page keeps its name whether or not the record exists", () => {
    renderPerson("PT-does-not-exist");
    expect(document.title).toMatch(/^Patient\b/);
    expect(document.body.textContent).not.toMatch(/Patient Now/);
  });

  it("⚠️ EVERY Fact LABEL NAMES THE FIELD IT READS — the guard the Sex/gender bug proves was missing", async () => {
    /*
     * 🔴 THE BUG THIS EXISTS FOR. `person.sexOrGender` was renamed to `person.sex` (owner ruling
     * 2026-09-09/2026-09-10) without touching the label reading it, so
     * `/mockups/ward-flow/people/PT-007` rendered "Sex / gender — Non-binary" while their `gender` was
     * (correctly, deliberately) unrecorded. The rename's diff touched only `ward-patients.ts` and the
     * seed — this screen was untouched, which is exactly why nothing caught it: no test here asserted
     * the label at all.
     *
     * ⚠️ A test that only checks the string "Sex" appears would pass on this exact bug with the WRONG
     * VALUE still showing under a right-sounding label, and would need editing every time wording
     * changes. So this asserts the RELATIONSHIP instead: read every `<Fact>`/`<SensitiveIdentityField>`
     * row's label alongside the exact `person.<field>` expression its `value` prop reads, and check
     * both against one canonical map — a mislabelled row and a field renamed without updating the map
     * both fail, in either direction (checked below).
     */
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/ward-management/patients/person-screen.tsx", "utf8");

    // The canonical label for every field this screen reads through `Fact`/`SensitiveIdentityField`.
    // Adding a row to the JSX with no entry here, or an entry here with no matching row, both fail
    // below — so extending the screen's field set means touching this map on purpose.
    const FIELD_LABELS: Record<string, string> = {
      preferredName: "Preferred name",
      sex: "Sex",
      // Added with Task 9 (2026-09-11): the tenth field this screen reads through `Fact`, and the
      // guard's own comment above invites exactly this extension — unlike the OTHER `useWardFlow()`
      // guard in this file, which explicitly reserves widening for the owner.
      gender: "Gender",
      address: "Address",
      suburb: "Suburb",
      aboriginalOrTorresStraitIslanderStatus: "Aboriginal or Torres Strait Islander status",
      generalPractitioner: "GP",
      interpreterLanguage: "Interpreter / preferred language",
      catchmentCommunityTeam: "Catchment community team",
      legalStatus: "Legal status",
    };

    // Every self-closing `<Fact .../>` or `<SensitiveIdentityField .../>` tag, whole, so `label` and
    // `value` can be pulled out independently of the order they are written in.
    const tags = source.match(/<(?:Fact|SensitiveIdentityField)\b[^]*?\/>/g) ?? [];

    // Anti-vacuity: R-2026-09-04-A named nine fields and all nine render through one of these two
    // components. Fewer than that means the tag pattern stopped matching the real JSX, not that the
    // screen shrank — either way, every check below would be silently checking nothing.
    expect(
      tags.length,
      "found fewer Fact/SensitiveIdentityField rows than R-2026-09-04-A's nine fields — the tag " +
        "pattern likely stopped matching the real JSX, which would make every check below vacuous",
    ).toBeGreaterThanOrEqual(9);

    const seenFields = new Set<string>();

    for (const tag of tags) {
      const labelMatch = tag.match(/label="([^"]+)"/);
      const valueMatch = tag.match(/value=\{person\.(\w+)\}/);
      expect(labelMatch, `a Fact-shaped row has no label prop this guard can read:\n${tag}`).not.toBeNull();
      expect(
        valueMatch,
        `a Fact-shaped row does not read "person.<field>" directly, so this guard cannot check it:\n${tag}`,
      ).not.toBeNull();

      const label = labelMatch![1];
      const field = valueMatch![1];
      seenFields.add(field);

      expect(
        field in FIELD_LABELS,
        `person.${field} is read by a Fact row but has no entry in this test's canonical label map — ` +
          "add one deliberately rather than letting the row go unchecked",
      ).toBe(true);
      expect(
        label,
        `person.${field} is labelled "${label}", but this test's canonical label for that field is ` +
          `"${FIELD_LABELS[field]}". That is the exact shape of the Sex/gender bug: a field renamed or ` +
          "reread under a label that no longer names it.",
      ).toBe(FIELD_LABELS[field]);
    }

    // The other direction: a map entry nothing in the source reads any more is a stale entry that
    // would hide a field being removed or renamed out from under this guard rather than catch it.
    for (const field of Object.keys(FIELD_LABELS)) {
      expect(
        seenFields.has(field),
        `"${field}" is in this test's canonical label map but no Fact row on the screen reads ` +
          `person.${field} any more — the map has drifted from the source and should be pruned`,
      ).toBe(true);
    }
  });

  /**
   * TASK 11 — "the tabs that FD-23 allows". Three tabs, not five (§0.2): Now, Details and
   * Documents are built; History and Community are not, because both would render a place name
   * reached through this person's referrals — exactly what the FD-23 guard above forbids.
   */
  describe("the tabs that FD-23 allows", () => {
    it("carries a tablist named 'The record' — the drawing's own name, not 'Tabs'", () => {
      renderPerson();
      expect(screen.getByRole("tablist", { name: "The record" })).toBeInTheDocument();
    });

    it("builds exactly three tabs, in order — Now, Details, Documents — and no more", () => {
      renderPerson();
      const tabs = screen.getAllByRole("tab");
      expect(tabs.map((tab) => tab.textContent)).toEqual(["Now", "Details", "Documents"]);
    });

    it("starts with Now selected, and roving tabindex keeps only the selected tab in the Tab order", () => {
      renderPerson();
      const [now, details, documents] = screen.getAllByRole("tab");
      expect(now).toHaveAttribute("aria-selected", "true");
      expect(details).toHaveAttribute("aria-selected", "false");
      expect(documents).toHaveAttribute("aria-selected", "false");
      expect(now).toHaveAttribute("tabindex", "0");
      expect(details).toHaveAttribute("tabindex", "-1");
      expect(documents).toHaveAttribute("tabindex", "-1");
    });

    it("Left/Right move the selection and focus follows, wrapping at both ends", async () => {
      const user = userEvent.setup();
      renderPerson();
      const [now, details, documents] = screen.getAllByRole("tab");
      now!.focus();
      await user.keyboard("{ArrowRight}");
      expect(details).toHaveAttribute("aria-selected", "true");
      expect(details).toHaveFocus();
      await user.keyboard("{ArrowRight}");
      expect(documents).toHaveAttribute("aria-selected", "true");
      expect(documents).toHaveFocus();
      // Wraps forward from the last tab back to the first.
      await user.keyboard("{ArrowRight}");
      expect(now).toHaveAttribute("aria-selected", "true");
      expect(now).toHaveFocus();
      // And wraps backward from the first tab to the last.
      await user.keyboard("{ArrowLeft}");
      expect(documents).toHaveAttribute("aria-selected", "true");
      expect(documents).toHaveFocus();
    });

    it("clicking Details shows the placement-details panel and hides the identity panel; clicking Now reverses it", async () => {
      const user = userEvent.setup();
      renderPerson();
      // Both panels are in the DOM from the start (never unmounted — see the source comment on
      // `hidden` — because two other suites read `ward-person-placement-details` with no tab
      // click first), so the property under test is VISIBILITY, not presence.
      expect(screen.getByTestId("ward-person-identity")).toBeVisible();
      expect(screen.getByTestId("ward-person-placement-details")).not.toBeVisible();

      await user.click(screen.getByRole("tab", { name: "Details" }));
      expect(screen.getByTestId("ward-person-placement-details")).toBeVisible();
      expect(screen.getByTestId("ward-person-identity")).not.toBeVisible();

      await user.click(screen.getByRole("tab", { name: "Now" }));
      expect(screen.getByTestId("ward-person-identity")).toBeVisible();
      expect(screen.getByTestId("ward-person-placement-details")).not.toBeVisible();
    });

    it("the Documents tab shows the ruled sentence, and nothing else", async () => {
      const user = userEvent.setup();
      renderPerson();
      await user.click(screen.getByRole("tab", { name: "Documents" }));
      const panel = screen.getByRole("tabpanel", { name: "Documents" });
      expect(panel).toBeVisible();
      // ⚠️ THE SHAPE IS THE POINT. Not "No documents are held for this person" — that reads as a
      // search performed against this person's own file and coming back empty. The system has no
      // document capability at all, for anybody, so the sentence never names the person and never
      // implies a search happened.
      expect(panel).toHaveTextContent("This prototype holds no documents, for anyone.");
      // No count anywhere on this tab, before or after selection — a zero would imply the system
      // looked and found none, and there is nothing here to count.
      const documentsTab = screen.getByRole("tab", { name: "Documents" });
      expect(documentsTab.textContent).toBe("Documents");
    });

    it("names History and Community as absent, in words, and does not promise they are coming", () => {
      renderPerson();
      const sentence = screen.getByTestId("ward-person-tabs-not-built");
      expect(sentence).toHaveTextContent(/history/i);
      expect(sentence).toHaveTextContent(/community/i);
      // True read alone, and not a promise about the future — "coming soon" or "not yet available"
      // would say this is scheduled, which is not a decision this screen gets to make.
      expect(sentence.textContent).not.toMatch(/coming soon|not yet available|will be added|to be built/i);
      // And neither word is a clickable tab — only the three built tabs exist.
      expect(screen.queryByRole("tab", { name: /history/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: /community/i })).not.toBeInTheDocument();
    });
  });
});
