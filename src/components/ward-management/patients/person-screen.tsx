"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { type PatientId, patientAgeYears, patientDisplayName } from "@/components/ward-management/ward-patients";
import sharedStyles from "@/components/ward-management/ward-shared.module.css";

import styles from "./person.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * A PERSON'S OWN SCREEN. The subject is the PERSON, not a request for a bed.
 *
 * The owner's flow is *search for a patient, and if nobody comes up, add them, then refer from
 * their own screen.* The last step had nowhere to happen: `/patients/[patientId]`
 * (since moved to `/mockups/ward-flow/movements/[movementId]`) looked a `Movement` up by id, so the
 * route named after people was about requests, and every one of its seven inbound links passed a
 * movement id (checked, not assumed — the variable is called `patient` in several of them, which is
 * where the confusion lives). Clicking a person in search results did nothing at all, because there
 * was nowhere for the tile to point.
 *
 * ⚠️ **`FD-23` BINDS THIS SCREEN AND THIS SCREEN MOST OF ALL.** A ward may not see where else a
 * patient has been referred; the coordinator may. The owner's reason: so a ward does not take its
 * time over a patient who has been referred elsewhere. The ledger's warning is aimed here — *every
 * instinct in a patient-centred design says a patient screen shows everything known about that
 * patient, so the omission looks like an incomplete implementation rather than a decision, and a
 * later reader will add it helpfully.* **If you came to this file to add "their current referrals",
 * that is the addition, and it needs the owner rather than a commit.**
 *
 * `tests/ward-person-screen.dom.test.tsx` guards it twice, deliberately. One assertion checks no
 * unit name reaches the screen. The other reads this source and fails if it consults the referral
 * list at all — because the first one passes today for a reason that has nothing to do with
 * `FD-23`: `Referral` carries no patient link, so this screen COULD not show referrals even if it
 * tried. A guard resting on that would go quiet the day the link lands, which is precisely the day
 * it is needed.
 *
 * **WHAT IT SHOWS: `PD-1`'s four identity facts (name, record number, date of birth, age DERIVED
 * from it rather than stored beside it), plus the nine fields `R-2026-09-04-A` (2026-09-04,
 * `docs/ward-flow/owner-rulings-2026-09-04.md` section A) added — address, suburb, GP, catchment
 * community team, legal status, interpreter/preferred language, Aboriginal or Torres Strait
 * Islander status, sex/gender and preferred name.** Everything else in the approved mockup below
 * stays out: risk flags, diagnosis, next of kin, medication, "open to the team" and the whole
 * history panel were each asked about or considered and none is authorised here. Widening
 * `PATIENT_FIELDS` again needs its own ruling and its own line in
 * `tests/ward-patient-model.test.ts`'s `PLACEMENT_FIELDS` map — not a passing test.
 *
 * ⚠️ **TWO OF THE NINE ARE HELD BUT NOT SETTLED FOR DISPLAY.** Whether Aboriginal or Torres Strait
 * Islander status and interpreter/preferred language belong on a screen at all remains open with
 * the Aboriginal health review; `R-2026-09-04-A` rules only that the record may HOLD them. They are
 * rendered below because the mockup already resolved a real defect in their placement (next
 * paragraph) and hiding them entirely would re-litigate a decision nobody has reopened — but do not
 * read their presence here as the review's answer.
 *
 * ⚠️ **THE PLACEMENT RULE, AND WHY IT HAS TWO HALVES.** The two sensitive fields must not sit
 * adjacent to each other, and neither may sit directly above the psychiatric history panel. An
 * earlier version of this fix satisfied only the first half — it moved Aboriginal status out of
 * that position and pushed interpreter language into it, and the single non-adjacency test passed
 * throughout. `SensitiveIdentityField` below is ONE function with two named slots
 * (`"aboriginalOrTorresStraitIslander"` and `"interpreterLanguage"`), rendered at two separate
 * points in the "Placement details" panel — Aboriginal status early, beside the other demographic
 * facts; interpreter language later, beside GP among the contact facts — with GENERAL PRACTITIONER
 * and LEGAL STATUS between and after them respectively, so neither half of the rule depends on the
 * other holding. `tests/ward-patient-placement-fields.dom.test.tsx` asserts both, separately, each
 * proved by its own mutation.
 *
 * ⚠️ **A NOTE FOR WHOEVER MEETS `docs/ward-flow/design/prototypes/mockup-patient.html` NEXT.** That
 * mockup's "Identity and key facts" panel additionally shows "open to the team" and, in a panel
 * below it, past psychiatric history, current medications, past medical history and referral
 * history. NONE of that is a missing render on this screen — it is a field set `R-2026-09-04-A`
 * did not authorise `Patient` to hold, or (the history panel) a link the model does not carry.
 *
 * ⚠️ **THE HISTORY PANEL IS A SEPARATE, DEEPER GAP AND IS UNBUILDABLE RATHER THAN UNBUILT.**
 * `Movement` (`ward-model.ts`) carries no `patientId` — only `Referral` does, since the pointer work
 * for `FD-23` — so there is no link by which a person's past admissions could be found at all. A
 * "Past psychiatric history: None" state built against that absence would not be an honest empty
 * state; it would state, of every patient, a clinical fact nobody has checked. That is the reasoning
 * behind leaving it out here rather than a missing step.
 *
 * Building any further field set or the history link is an owner decision, not a layout one. This
 * comment exists so the next reader inherits the reasoning rather than re-deriving it.
 *
 * 🔴 **THE THIRD-EDITION DRAWING'S "THE PERSON NOW" PANEL ALSO SHOWS THIS PERSON'S CURRENT MOVEMENT
 * AND ITS ELIGIBILITY VERDICT (`eligibility()` / `candidateReason()`, `ward-eligibility.ts`). THAT
 * HALF IS NOT BUILT HERE, AND IT IS A STOP-AND-HAND-BACK, NOT AN OMISSION.** Finding the current
 * movement needs `referrals.patientId → movement.referralId`, and the verdict needs the movement's
 * accepted unit — both live only in `useWardFlow()`'s `movements`, `referrals` and `units`, which
 * this screen does not take. `tests/ward-person-screen.dom.test.tsx`'s case titled *"AND THE SCREEN
 * CANNOT REACH REFERRALS AT ALL — the guard that survives the link landing"* pins this screen's
 * `useWardFlow()` destructure to exactly `["patients", "dayZero", "now"]` and says, in its own
 * failure message, *"showing a person's referrals, movements or destinations here is the exact
 * 'helpful' addition the ledger warns a later reader will make. Take it to the owner before widening
 * this list."* Building the movement/verdict half would require exactly that widening. Whether
 * showing a person's own SINGLE current movement (never another referral, never a history — the same
 * one-tie read `record-preview.tsx` already performs for the search screen) is the capability that
 * guard means to forbid, or a narrower one FD-23 was never meant to block, is not this file's call.
 * Handed back rather than chosen.
 */
/** A plain fact row: label, value, or `absentLabel` when the value is absent. Every one of
 *  R-2026-09-04-A's nine optional fields defaults to the flat "Not recorded" — a person just added
 *  via search-then-add has none of them yet, and nobody is obliged to fill any of the nine in, so
 *  there is no pending step to imply. `absentLabel` exists for the one field that must NOT default
 *  to that wording — see the `Gender` call site below for why (D-6). Exported for
 *  `tests/ward-patient-now.dom.test.tsx`, which proves the two wordings directly rather than only
 *  through the seed's one gender-unset fixture. */
export function Fact({
  label,
  value,
  absentLabel = "Not recorded",
}: {
  label: string;
  value: string | undefined;
  absentLabel?: string;
}) {
  return (
    <div className={`${sharedStyles.field} ${styles.fact}`}>
      <dt>{label}</dt>
      <dd className={value === undefined ? sharedStyles.pending : undefined}>{value ?? absentLabel}</dd>
    </div>
  );
}

/**
 * ⚠️ ONE MODULE, TWO NAMED SLOTS — read the placement-rule paragraph in this file's header comment
 * before touching this function.
 *
 * Aboriginal or Torres Strait Islander status and interpreter/preferred language are the two fields
 * the placement rule binds: not adjacent to each other, and neither directly above a psychiatric
 * history panel. Both render through this ONE function, so a change to how a sensitive field looks
 * or behaves applies to both identically (removability), but each CALL sits wherever `PersonScreen`
 * places it (non-adjacency) — the two calls below are deliberately far apart in the JSX rather than
 * looped from one array, which is what lets one move without dragging the other with it.
 *
 * `data-sensitive-slot` names which slot this is, so
 * `tests/ward-patient-placement-fields.dom.test.tsx` can find both by slot rather than by label text
 * or DOM position — position is exactly what that test is checking, so it must not be how the test
 * locates the elements.
 */
function SensitiveIdentityField({
  slot,
  label,
  value,
}: {
  slot: "aboriginalOrTorresStraitIslander" | "interpreterLanguage";
  label: string;
  value: string | undefined;
}) {
  return (
    <div className={`${sharedStyles.field} ${styles.fact}`} data-sensitive-slot={slot}>
      <dt>{label}</dt>
      <dd className={value === undefined ? sharedStyles.pending : undefined}>{value ?? "Not recorded"}</dd>
    </div>
  );
}

/**
 * TASK 11 — "the tabs that FD-23 allows". Three tabs, not five: the drawing
 * (`patient-now-third-edition.html`) draws Now · History · Community · Details · Documents, with
 * the tablist's own accessible name **"The record"**. History and Community are NOT built here —
 * both would render a ward, ED or team name reached through this person's referrals, which is
 * exactly the capability `tests/ward-person-screen.dom.test.tsx`'s FD-23 guard (the one titled
 * "AND THE SCREEN CANNOT REACH REFERRALS AT ALL") forbids. See this file's header comment. Their
 * absence is said in words beside the tablist, not rendered as a tab nobody can open.
 *
 * ⚠️ **NO COUNT ON ANY OF THESE THREE**, though the drawing puts one beside four of its five tabs.
 * `Documents` never carries one — a count of zero on a tab with no document capability at all
 * reads as "we looked and found none", which is a search this prototype never performs. `Details`
 * carries no count in the drawing either. And `Now` has nothing left to count: the drawing's `Now`
 * count belonged to the movement/verdict panel Task 9 handed back, so there is no derived quantity
 * here to show without inventing one — "Derived, never typed" (Global Constraints) forbids a
 * literal standing in for it.
 */
const RECORD_TABS = [
  { id: "now", label: "Now" },
  { id: "details", label: "Details" },
  { id: "documents", label: "Documents" },
] as const;
type RecordTabId = (typeof RECORD_TABS)[number]["id"];

/**
 * ⚠️ **THIS ONE REALLY DOES TAKE A PERSON**, and its prop is typed `PatientId` to say so. The pair
 * matters more than either half: `WardPatientWorkspace` next door is named for a patient and holds
 * a MOVEMENT, and while both props were a bare `string` nothing could tell the two apart. Now the
 * compiler refuses a movement id here and a patient id there.
 */
export function PersonScreen({ patientId }: { patientId: PatientId }) {
  const { patients, dayZero } = useWardFlow();
  const person = patients.find((candidate) => candidate.id === patientId);

  // "The record" — the tablist's own accessible name, copied from the drawing (§A3 of the
  // companion facts doc), not "Tabs". Three tabs are built; see the doc comment above `RECORD_TABS`.
  const [activeTab, setActiveTab] = useState<RecordTabId>("now");

  /**
   * Left/Right move the selection and focus follows, the same roving-tabindex shape
   * `hub-screen.tsx`'s `onTabsKeyDown` already proves out: moving tabs here costs nothing to
   * undo (it swaps which panel is visible, nothing is submitted or lost), so selecting as the
   * arrow moves — rather than requiring a second key to confirm — is the right choice, not an
   * oversight.
   */
  function onRecordTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = RECORD_TABS.map((tab) => tab.id);
    const current = order.indexOf(activeTab);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % order.length;
    if (event.key === "ArrowLeft") next = (current - 1 + order.length) % order.length;
    if (next === -1) return;
    event.preventDefault();
    const target = order[next];
    if (target === undefined) return;
    setActiveTab(target);
    const el = event.currentTarget.querySelector<HTMLButtonElement>(`[data-record-tab="${target}"]`);
    el?.focus();
  }

  // D-1 (owner, 2026-09-10): "But call this page Patient." The name binds the document title, the
  // accessible name of the page and every navigation label pointing here — never `patientId`,
  // `patientHref`, the seed or this directory, which D-1 says a rename is "not implied and not
  // authorised" for. Set unconditionally, including the "no such person" state below, because the
  // PAGE keeps its name whether or not the requested record exists.
  //
  // Same technique `ClinicalDashboard.tsx` uses (`sharedHomeDocumentTitle`): this route is reached
  // by client-side navigation (`router.push` from `add-patient.tsx`, and search's own `Link`), so a
  // static server `metadata.title` alone can go stale; this keeps the browser tab and the
  // accessible document name aligned on that client-only path too.
  useEffect(() => {
    document.title = "Patient - Ward Flow";
  }, []);

  return (
    <div
      className={styles.screen}
      data-testid="ward-person-screen"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="patient-now"
    >
      <main id="main-content" className={styles.main}>
        {person === undefined ? (
          /*
           * Conservative failure. The specific mistake this shape exists to prevent is rendering
           * `patients[0]` for an unrecognised id: that looks like a working screen and it is a
           * different human being. A gap is only useful if you can see it, so the gap is what is
           * rendered.
           */
          <section className={styles.missing} data-testid="ward-person-missing">
            <h1 className={styles.pageTitle}>No such person</h1>
            <p>No patient record was found for this address. Search by name or record number.</p>
            <Link className={styles.secondaryButton} href="/mockups/ward-flow/search">
              Back to search
            </Link>
          </section>
        ) : (
          <>
            <header className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>{patientDisplayName(person)}</h1>
              <p className={styles.pageSubtitle}>
                Record {person.umrn} · Born {person.dateOfBirth}
              </p>
            </header>

            <div className={styles.recordWorkspace}>
              {/*
              ⚠️ `role="tablist"` IS A PROMISE ABOUT KEYS, NOT A LABEL — see `hub-screen.tsx`'s own
              comment on the same point. Roving tabindex (only the selected tab sits in the Tab
              order) plus the Left/Right handler below are both required for the role to mean what
              it claims; a `role="tab"` with no keyboard support tells a screen-reader user to press
              keys that do nothing, which is worse than no ARIA at all.

              "The record" is the drawing's own name for this tablist (§A3 of the drawing-facts
              companion doc), not "Tabs" — copied, not invented.
            */}
              <div
                role="tabpanel"
                id="ward-person-panel-now"
                aria-labelledby="ward-person-tab-now"
                hidden={activeTab !== "now"}
              >
                <div data-testid="ward-person-identity">
                  <WardPanel title="The person now">
                    <dl className={styles.factList}>
                      <div className={`${sharedStyles.field} ${styles.fact}`}>
                        <dt>Name</dt>
                        <dd>{patientDisplayName(person)}</dd>
                      </div>
                      {/* R-2026-09-04-A: a dignity fact, not a clinical one. No inference attaches to it. */}
                      <Fact label="Preferred name" value={person.preferredName} />
                      <div className={`${sharedStyles.field} ${styles.fact}`}>
                        <dt>Record number</dt>
                        <dd>{person.umrn}</dd>
                      </div>
                      <div className={`${sharedStyles.field} ${styles.fact}`}>
                        <dt>Date of birth</dt>
                        <dd>{person.dateOfBirth}</dd>
                      </div>
                    </dl>
                    <WardFigureStrip>
                      <WardFigure label="Age" value={String(patientAgeYears(person, dayZero))} unit="years" />
                    </WardFigureStrip>
                    {/*
                    Derived, never stored. `patientAgeYears` reads the date of birth above and is the
                    one place this project computes an age — holding both would let a record state an
                    age that disagrees with its own date of birth. Said in words, not only in this
                    comment, because a figure with no explanation invites somebody to "fix" it into a
                    stored field of its own later.
                  */}
                    <p className={sharedStyles.hint}>Age at the current prototype date.</p>
                    <p
                      className={styles.currentMovementUnavailable}
                      data-testid="ward-person-current-movement-unavailable"
                    >
                      Current movement and eligibility are unavailable on this record.
                    </p>
                  </WardPanel>
                </div>
                <section className={styles.actions}>
                  <h2 className={styles.sectionHeading}>Referral</h2>
                  <Link
                    className={styles.primaryButton}
                    href={`/mockups/ward-flow/referrals/new?patientId=${encodeURIComponent(person.id)}`}
                    data-testid="ward-person-refer"
                  >
                    {/* "Refer Patient" is the owner's wording, ruling 9, 2026-09-03. It replaced
                    "Refer this person". */}
                    Refer Patient
                  </Link>
                  {/*
                ⚠️ THIS PARAGRAPH SAID THE OPPOSITE UNTIL 2026-09-02, AND IT CHANGED IN THE SAME
                COMMIT THAT MADE IT FALSE — which is the only moment it could have.

                It read: "A referral started here is not yet attached to this person. This prototype
                has no way to join the two." That was true, careful and honest, and the instant the
                button above began carrying `patientId` it became a lie. ⚠️ NOTHING WOULD HAVE
                FAILED. No test asserts this sentence, and a screen quietly telling a clinician that
                a link does not exist while the link is being written is worse than never having
                said anything.

                Owner ruling 2026-09-02: a referral may remember its patient. A POINTER, never a
                copy — no name, date of birth or record number travels with it.

                ⚠️ AND IT PROMISES NO HISTORY, DELIBERATELY. Whether a ward may see where else a
                person has been referred is `FD-23` and its mechanism does not exist. Writing the
                pointer and displaying a person's referrals are two decisions and only the first has
                been made, so this says what is true today and offers nothing that is not built.
              */}
                  <p className={styles.note} data-testid="ward-person-refer-note">
                    Start a referral linked to this patient. Referral history is unavailable here.
                  </p>
                </section>
              </div>

              <div className={styles.tabList} role="tablist" aria-label="The record" onKeyDown={onRecordTabsKeyDown}>
                {RECORD_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`ward-person-tab-${tab.id}`}
                    aria-controls={`ward-person-panel-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    data-record-tab={tab.id}
                    className={activeTab === tab.id ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/*
              🔴 FD-23 (§0.2 of the lane plan). History and Community are not built: both would
              render a ward, ED or team name reached through this person's referrals, which is
              exactly the capability the FD-23 guard in `tests/ward-person-screen.dom.test.tsx`
              forbids — so their absence is said here in words, beside the tablist, rather than
              rendered as a tab that leads nowhere. This sentence promises nothing about when, or
              whether, that changes; it states why the screen looks the way it does today.
            */}
              <p className={styles.tabsNotBuilt} data-testid="ward-person-tabs-not-built">
                Referral history and community journeys are unavailable on this record.
              </p>

              {/*
              A plain wrapper, not the panel itself: `WardPanel` does not forward arbitrary props,
              so the `ward-person-identity` testid — asserted by `tests/ward-person-screen.dom.test.tsx`
              both for its content and for its absence on an unknown person — lives here instead.

              ⚠️ `hidden`, NOT a conditional unmount. Two existing suites —
              `tests/ward-patient-now.dom.test.tsx` and `tests/ward-patient-placement-fields.dom.test.tsx`
              — call `screen.getByTestId("ward-person-placement-details")` straight after render, with
              no tab click first. Unmounting the inactive panel would make that lookup throw. `hidden`
              keeps every panel in the DOM (so those lookups still find it) while showing only the
              active one — the browser's own UA stylesheet turns `display: none` on for a `hidden`
              element, and nothing in this file overrides that.
            */}
              {/*
              R-2026-09-04-A's nine placement fields, under the Details tab — "the patient's own
              fields" (Task 11). A plain wrapper for the same reason as `ward-person-identity` above:
              `WardPanel` does not forward arbitrary props.

              ⚠️ ORDER IS THE PLACEMENT RULE, NOT DECORATION. Sex/gender, address and suburb come
              first; then Aboriginal or Torres Strait Islander status, EARLY in this demographic
              group rather than last; then GP; then interpreter/preferred language, sitting WITH GP
              among the contact facts rather than beside the field above; then catchment team; then
              legal status LAST. That keeps the two sensitive fields separated by GP (non-adjacency)
              and keeps legal status — not either sensitive field — the item that would sit directly
              above a psychiatric history panel if one is ever built here. Reordering this list back
              toward alphabetical or "tidier" would reopen exactly the adjacency this fixes.
            */}
              <div
                role="tabpanel"
                id="ward-person-panel-details"
                aria-labelledby="ward-person-tab-details"
                hidden={activeTab !== "details"}
              >
                <div data-testid="ward-person-placement-details">
                  <WardPanel title="Placement details">
                    <dl className={styles.factList}>
                      {/* `person.sexOrGender` renamed to `person.sex` (owner ruling 2026-09-09/2026-09-10,
                        `ward-patients.ts`) — sex and gender are now separate fields on `Patient`. The
                        rename left this row reading only `sex` while its label still promised BOTH, so
                        for any person whose `gender` is unrecorded (PT-007) the screen stated a gender
                        the record does not hold. Fixed to `label="Sex"`, which is what this row has
                        always actually shown. `tests/ward-person-screen.dom.test.tsx`'s "every Fact
                        label names the field it reads" guard pins the relationship so a future rename
                        cannot repeat this. */}
                      <Fact label="Sex" value={person.sex} />
                      {/*
                      GENDER (THIS FIELD, `Patient.gender`) — a RECORDED FACT ABOUT THE PERSON ONLY.
                      Never write, imply or test any sentence saying THIS FIELD decides a bed:
                      `genderEligibility` (`ward-eligibility.ts`), the gate that reads it, still has
                      no caller in the live verdict pipeline (its own doc comment argues why, at
                      length, and calls wiring it a stop-and-hand-back). 🔴 CORRECTED 2026-09-17, T10
                      — "placement today runs on movement.sex through sex_designation/sex_mix" IS NOW
                      FALSE for the designation half: T10 (item 8) renamed `sex_designation` to
                      `gender_designation` and wired it to the gender recorded AT REFERRAL
                      (`Movement.gender`/`WardReferralDestination.gender`) — a SEPARATE field from
                      this one, never looked up from a linked `Patient`. `sex_mix` still reads
                      `movement.sex`, unchanged. This row shows the patient-profile fact and nothing
                      more.

                      ⚠️ TWO ABSENCE WORDINGS ON THIS SCREEN, DELIBERATELY — D-6 (Ward Lead,
                      2026-09-11), Lane C's recommendation adopted with its reasoning intact. Gender's
                      `absentLabel` overrides `Fact`'s flat default because gender is the one field
                      here whose recording is EXPECTED AND PENDING: the owner's ruling has the
                      referring clinician complete it at referral, so an unset `gender` is a step not
                      yet taken, not a fact nobody was ever obliged to record. Saying "Not yet" of the
                      other nine would invent an obligation nobody imposed; saying the flat "Not
                      recorded" of gender would hide the one the owner did impose. The exact phrase
                      also matches, word for word, `Patient.gender`'s own doc comment and
                      `genderEligibility`'s detail sentence in `ward-eligibility.ts` ("Gender is not
                      yet recorded — this gate cannot determine whether X accepts this patient") — a
                      third phrasing here would be the same drift the label-guard above exists to
                      catch, just in the absence wording rather than the label.
                    */}
                      <Fact label="Gender" value={person.gender} absentLabel="Not yet recorded" />
                      <Fact label="Address" value={person.address} />
                      <Fact label="Suburb" value={person.suburb} />
                      <SensitiveIdentityField
                        slot="aboriginalOrTorresStraitIslander"
                        label="Aboriginal or Torres Strait Islander status"
                        value={person.aboriginalOrTorresStraitIslanderStatus}
                      />
                      <Fact label="GP" value={person.generalPractitioner} />
                      <SensitiveIdentityField
                        slot="interpreterLanguage"
                        label="Interpreter / preferred language"
                        value={person.interpreterLanguage}
                      />
                      <Fact label="Catchment community team" value={person.catchmentCommunityTeam} />
                      <Fact label="Legal status" value={person.legalStatus} />
                    </dl>
                    <p className={sharedStyles.hint}>
                      “Not recorded” is an honest gap for a person just added to this prototype — not a missing screen.
                    </p>
                  </WardPanel>
                </div>
              </div>

              {/*
              🔴 THE SENTENCE'S SHAPE MATTERS AND IS PINNED VERBATIM. It must never name this
              person, and never read as though a search happened — "no documents are held for this
              person" implies somebody looked in this person's own file and found it empty; the
              truth is starker and system-wide: nothing in this prototype models a document at all
              beyond the five catchment policy papers, for anyone. Naming the person here would be
              the exact false "we checked and there is nothing" this sentence exists to avoid.
            */}
              <div
                role="tabpanel"
                id="ward-person-panel-documents"
                aria-labelledby="ward-person-tab-documents"
                hidden={activeTab !== "documents"}
              >
                <WardPanel title="Documents">
                  <p className={styles.documentsNote}>This prototype holds no documents, for anyone.</p>
                </WardPanel>
              </div>
            </div>
          </>
        )}
        <WardPrototypeFooter
          testId="ward-person-governance"
          note="Suburb and catchment team pairings use the recorded catchment table · Not a medical device"
        />
      </main>
    </div>
  );
}
