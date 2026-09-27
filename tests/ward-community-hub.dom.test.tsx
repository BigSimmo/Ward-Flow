import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { expectNeverSaysAgain, expectSays } from "./helpers/ward-caption";

// Same reason as every sibling dom suite: `ClinicalRail` and the team switcher render next/link
// anchors, and jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
// Moved 2026-09-10: the one team-href builder now lives in the shared facade rather than inside a
// screen four lanes are about to own. Same function, same single route literal, new home.
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";
import { referralAddressingStateLabel } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
/**
 * THE COMMUNITY HUB, ON THE SCREEN, AFTER THE ASSOCIATION RULE WAS REVERSED.
 *
 * ⚠️ **THIS FILE REPLACES A REGION-BASED ONE AND PORTS NONE OF ITS ASSERTIONS.** The previous DOM
 * suite rendered team pages keyed on `admission.homeRegion === team.region`. The owner ruled on
 * 2026-08-31 that a person belongs to the team NAMED ON THEIR REFERRAL and that home region is a
 * geographic guess; region is gone from the module entirely. Adapting those assertions would have
 * produced a guard that protects the defect, so they are not adapted — they are replaced.
 *
 * ⚠️ **THE FALSIFIER THIS FILE IS BUILT AROUND.** Almost any rendering assertion here would also
 * pass against a screen that associated people by home region, because in ordinary fixtures the
 * region and the referred team agree. So the central test builds two people with the SAME home
 * region and DIFFERENT referral teams and asserts the page shows exactly ONE of them, plus the
 * converse on the other team's page. A region-keyed screen shows both on one page and neither on
 * the other; no implementation can satisfy both directions.
 *
 * ⚠️ **THE SENTENCES ARE ASSERTED, NOT ONLY THE ROWS.** `tests/ward-community-hub.test.ts` already
 * proves the four lists partition correctly. What only a rendered page can prove is that an empty
 * list never reads as an all-clear: the follow-up statement is asserted on a team whose discharged
 * list IS empty, and the invisible-cohort line is asserted on a fixture where the count IS nought.
 * A safety statement that vanishes at nought is one nobody ever sees.
 */

/**
 * A fully-populated admission, minted rather than found, so populations the seed cannot produce are
 * still renderable. Typed as `Admission`, so a field added to the record fails to compile here
 * rather than leaving this helper silently building a stale shape.
 */
function admission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TEST-01",
    unitId: "unit-under-test",
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    patientId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: 0,
    arrivedAt: 0,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...overrides,
  };
}

/**
 * Referrals naming community teams, built through the reducer's own write path so the shape they
 * hold is a shape the live system actually produces.
 *
 * ⚠️ **ONE CHAIN, NEVER ONE SEED PER REFERRAL, and that is a correctness requirement rather than
 * tidiness.** Two calls to `seedWardFlowState()` each mint the SAME next referral id, so two
 * independently-seeded referrals collide, `referrals.find(id)` returns the first, and a person
 * referred to team B is reported as belonging to team A — a false result shaped exactly like the
 * defect this file exists to catch, and the way a green suite hides one. The distinct ids are
 * asserted below rather than assumed. Same pattern as `tests/ward-community-hub.test.ts`.
 */
function referralsNaming(teamNames: readonly string[], homeRegion: Referral["homeRegion"]): Referral[] {
  let state = seedWardFlowState();
  const before = state.referrals.length;
  for (const teamName of teamNames) {
    state = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [{ kind: "community_team", teamName }],
      homeRegion,
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    expect(state.rejections, `the reducer refused a referral naming ${teamName}`).toEqual([]);
  }
  const created = state.referrals.slice(before);
  expect(created, "the reducer did not create one referral per requested team").toHaveLength(teamNames.length);
  expect(new Set(created.map((referral) => referral.id)).size, "two fixture referrals share an id").toBe(
    teamNames.length,
  );
  return created;
}

const TEAM_A = COMMUNITY_TEAM_PAGES[0];
const TEAM_B = COMMUNITY_TEAM_PAGES[1];

/**
 * Both data props are supplied on every render, always together. The screen falls back to live
 * provider state for either one independently, and a test that supplied admissions alone would
 * render a page that is empty for the wrong reason — nobody's referral would resolve — while
 * looking exactly like a correct empty page.
 *
 * `initialNow` is pinned so the provider's clock cannot move under a length-of-stay figure.
 */
function renderTeam(teamId: string, admissions: Admission[], referrals: Referral[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityScreen teamId={teamId} admissions={admissions} referrals={referrals} />
    </WardFlowProvider>,
  );
}

/**
 * Every admission actually shown in the "currently admitted" section, read off the per-admission
 * testid rather than counted by list-item role. The FACT this file's central falsifier proves is
 * "exactly this person appears here, and that other one does not" — a fact a rendered `<li>` and a
 * rendered `<tr>` state equally well, so the count is taken from the testid the row carries in
 * either shape rather than from `getAllByRole("listitem")`, which only the `<li>` shape satisfies.
 */
function admittedIds(): string[] {
  return [...document.querySelectorAll('[data-testid^="ward-community-admitted-AD-"]')].map(
    (el) => el.getAttribute("data-testid") ?? "",
  );
}

describe("community hub — an unknown team is never another team", () => {
  it("says no team matches, and renders no list at all", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam("atlantis", [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    expectSays(screen.getByTestId("ward-community-unresolved").textContent, "the empty team search", [
      // Widened 2026-09-09: the two old spellings went RED on the faithful reword
      // "“{teamId}” does not correspond to any community team".
      "no community team",
      "no match",
      "does not correspond",
      "no such team",
      "not a community team",
    ]);
    // A fallback would render one of these names in the heading, so the absence is asserted over
    // the whole page rather than over the heading alone.
    const page = document.body.textContent ?? "";
    for (const team of COMMUNITY_TEAM_PAGES) {
      expect(page, `the not-found page named ${team.name}`).not.toContain(team.name);
    }
    expect(screen.queryByTestId("ward-community-admitted")).toBeNull();
    expect(screen.queryByTestId("ward-community-discharged")).toBeNull();
    expect(screen.queryByTestId("ward-community-referrals")).toBeNull();
  });

  it("does not resolve a team's own name as an id", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.name, [admission({ id: "AD-A", referralId: toA.id })], [toA]);
    // If this ever resolved, the slug function has become the identity and ids carrying spaces and
    // brackets would be reaching the router.
    expect(screen.getByTestId("ward-community-unresolved")).toBeTruthy();
    expect(screen.queryByTestId("ward-community-admitted")).toBeNull();
  });
});

describe("community hub — who the page shows is who the referral named", () => {
  it("renders its own team's name, and the person referred to it", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id, state: "occupied" })], [toA]);

    // The September UX composition makes the selected team the page heading. Keep the exact
    // team identity and referred-person assertions; only its heading level has changed.
    expect(
      screen.getByRole("heading", { level: 1, name: TEAM_A.name }),
      `the page does not name ${TEAM_A.name} — it is showing another team, or none`,
    ).toBeInTheDocument();
    expect(admittedIds()).toHaveLength(1);
    expect(screen.getByTestId("ward-community-admitted-AD-A")).toBeTruthy();
    expect(screen.getByTestId("ward-community-admitted-count").textContent).toContain("1");
    // The rule is stated on the page, once, above every list that depends on it.
    expect(screen.getByTestId("ward-community-association").textContent).toContain(
      "destination team written on the referral, never home region",
    );
  });

  /**
   * ⚠️ **THE FALSIFIER. Same home region, different referral teams.**
   *
   * Under the rule the owner reversed, both of these people are on ONE page (whichever team serves
   * "Perth Metropolitan") and neither is on the other. Under the owner's rule they are on two
   * different pages and the region is never read. A screen that satisfied the old premise fails
   * both halves of this test.
   */
  it("⚠️ shows one of two people who share a home region, on each of the two teams they were referred to", () => {
    const [toA, toB] = referralsNaming([TEAM_A.name, TEAM_B.name], "Perth Metropolitan");
    const personA = admission({ id: "AD-A", referralId: toA.id, homeRegion: "Perth Metropolitan" });
    const personB = admission({ id: "AD-B", referralId: toB.id, homeRegion: "Perth Metropolitan" });
    const both = [personA, personB];

    const first = renderTeam(TEAM_A.id, both, [toA, toB]);
    expect(admittedIds()).toHaveLength(1);
    expect(screen.getByTestId("ward-community-admitted-AD-A")).toBeTruthy();
    expect(screen.queryByTestId("ward-community-admitted-AD-B")).toBeNull();
    expect(screen.getByTestId("ward-community-admitted-count").textContent).toContain("1");
    first.unmount();

    // The converse, on the same fixture: the exclusion above is a consequence of the referral and
    // not of one person being invisible everywhere.
    renderTeam(TEAM_B.id, both, [toA, toB]);
    expect(admittedIds()).toHaveLength(1);
    expect(screen.getByTestId("ward-community-admitted-AD-B")).toBeTruthy();
    expect(screen.queryByTestId("ward-community-admitted-AD-A")).toBeNull();
  });

  it("⚠️ shows a person whose region matches nothing, and one with no region at all", () => {
    // The other direction of the same falsifier: a region-keyed screen renders neither of these,
    // because neither region can match the team serving Armadale.
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const farAway = admission({ id: "AD-FAR", referralId: toA.id, homeRegion: "Kimberley" });
    const noRegion = admission({ id: "AD-NONE", referralId: toA.id, homeRegion: null });

    renderTeam(TEAM_A.id, [farAway, noRegion], [toA]);
    expect(admittedIds()).toHaveLength(2);
    expect(screen.getByTestId("ward-community-admitted-AD-FAR")).toBeTruthy();
    expect(screen.getByTestId("ward-community-admitted-AD-NONE")).toBeTruthy();
  });

  it("shows nobody when no referral named this team, and says so rather than showing an empty list silently", () => {
    const [toB] = referralsNaming([TEAM_B.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-B", referralId: toB.id })], [toB]);

    expect(screen.queryByTestId("ward-community-admitted-list")).toBeNull();
    expect(screen.getByTestId("ward-community-admitted-empty")).toBeTruthy();
    expect(screen.getByTestId("ward-community-admitted-count").textContent).toContain("0");
  });
});

describe("community hub — the cohort that appears on no team's page", () => {
  it("states the count even when it is nought, because a line that vanishes at nought is never seen", () => {
    // Every admission in this fixture belongs to a team, so this IS the nought branch — asserted
    // rather than hoped for, since the sentence on the populated branch is worded differently.
    const [toA, toB] = referralsNaming([TEAM_A.name, TEAM_B.name], "Perth Metropolitan");
    renderTeam(
      TEAM_A.id,
      [admission({ id: "AD-A", referralId: toA.id }), admission({ id: "AD-B", referralId: toB.id })],
      [toA, toB],
    );

    const text = screen.getByTestId("ward-community-unattributable").textContent ?? "";
    // 🔴 ["0 admission"] WAS THE COUNT STANDING IN FOR ITS OWN MEANING — the third instance of this
    // shape on this branch. The claim is that N admissions are ON NO TEAM'S PAGE; the numeral plus
    // the noun satisfied the whole concept without it. Proved 2026-09-09: I changed the sentence to
    // "0 admission is shown here", deleting the claim entirely, and THIS ASSERTION STAYED SILENT.
    // Its own test passed; a different test two blocks down caught the edit.
    //
    // Split, so each half fails for its own reason.
    expectSays(text, "the unattributed-admissions claim", [
      "on no community team",
      "no community team's page",
      "on no team",
    ]);
    // The FIGURE is data — this it() is titled "states the count even when it is nought", so the
    // numeral must actually be printed. A rewording cannot change 0 into another number.
    expect(text, "the nought is no longer printed as a numeral beside the noun").toContain("0 admission");
    // Widened 2026-09-09: RED on "A person appears here only because their referral put this
    // team's name on it" — a faithful restatement. Both old spellings assumed the verb form.
    expectSays(text, "the attribution note", [
      "named this team",
      "names this team",
      "naming this team",
      "put this team's name",
      "this team's name",
    ]);
    // ⚠️ Widened 2026-09-09, and SHADOWED in the batch that first tested it — the site above failed
    // and this never executed, so the batch showed it silent. Silent is not sound. Isolated: RED on
    // "It is not a map of a catchment", a faithful restatement of the identical caveat.
    // ⚠️ Note "not an area" never matched anything: the real sentence says "not a picture of an
    // area", which does not contain that substring. One of the two spellings was already dead.
    expectSays(text, "the not-a-catchment caveat", [
      "not a picture of an area",
      "not an area",
      "not a map",
      "not a catchment",
      "not a picture of",
      "not a geographic or complete population view",
    ]);
  });

  it("counts them when they exist, and shows them on no list", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    // No referral at all — every admission `PULL_PATIENT` creates during a session. Same home region as
    // the member beside it, so a region-keyed screen would have put it on a page.
    const orphan = admission({ id: "AD-ORPHAN", referralId: null, homeRegion: "Perth Metropolitan" });

    renderTeam(TEAM_A.id, [orphan], [toA]);
    expect(screen.getByTestId("ward-community-unattributable").textContent).toContain(
      "1 admission is on no community team's page",
    );
    expect(screen.getByTestId("ward-community-admitted-empty")).toBeTruthy();
    expect(screen.getByTestId("ward-community-discharged-empty")).toBeTruthy();
    expect(screen.getByTestId("ward-community-expected-empty")).toBeTruthy();
  });
});

describe("community hub — an empty list must never read as an all-clear", () => {
  it("says follow-up is not recorded, inside the discharged section, on a team whose list is empty", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id, state: "occupied" })], [toA]);

    const section = screen.getByTestId("ward-community-discharged");
    // The branch under test is genuinely the empty one — otherwise this asserts the wording on a
    // populated list and proves nothing about the case that matters.
    expect(within(section).getByTestId("ward-community-discharged-empty")).toBeTruthy();
    const notice = within(section).getByTestId("ward-community-follow-up-not-recorded").textContent ?? "";
    const page = document.body.textContent ?? "";
    // ⚠️ Wording corrected 2026-09-01. This used to pin "…is not recorded", which was FALSE:
    // `Admission.followUp` exists, carries a state/instant/role, and is seeded. What is true is that
    // nothing writes it and nothing reads it. The negative pin below is what stops the false version
    // returning; see `tests/ward-community-index.test.ts` for the full pin and the measurement.
    // 🔴 "admission" REMOVED 2026-09-09. It is a bare noun this paragraph uses constitutively
    // ("on the admission", "seeded admissions"), so it satisfied the concept whether or not the
    // page still said anything about FOLLOW-UP at all. Proved by replacing the whole
    // "follow-up is recorded but nothing reads it" claim with a sentence about admissions: this
    // guard stayed silent. The edit was caught, but by a DIFFERENT test that pins the wording —
    // the converted guard contributed nothing.
    // Every spelling below is now about follow-up, which is the thing this note exists to say.
    // ⚠️ AND NARROWING TO "follow-up" WAS STILL NOT ENOUGH — caught by re-running the break, not by
    // reading. This ONE PARAGRAPH says "follow-up" in four different sentences, three of which are
    // other claims (site 320's "does not mean everybody is being followed up" among them). So the
    // word survived the deletion of the provenance claim and the guard stayed silent a second time.
    // The concept this site owns is narrower than the topic: the field EXISTS AND NOTHING READS IT.
    expectSays(notice, "the follow-up provenance note", [
      "reads it",
      "nothing reads",
      "no screen or figure reads",
      "not shown or editable",
    ]);
    /*
     * ⚠️ **THIS BANNED ONE EXACT SENTENCE UNTIL 2026-09-06, AND THE CLAIM IT GUARDS IS TRIVIAL TO
     * RESTATE.** The false version said the field is not recorded anywhere in this prototype;
     * `Admission.followUp` exists, carries a state, an instant and a role, and is seeded. Any of
     * "there is no such field", "the model has no field for it", "we do not hold that" says the same
     * false thing and walked straight past a single-string ban.
     *
     * The true claim is narrower and is asserted separately, by the model rather than by wording:
     * the field has NO PRODUCER — see "no reducer event gives Admission.followUp a value" in this
     * file, which reads the reducer and goes red if that stops being true. **A ban on wording and a
     * check on the model guard different halves, and neither substitutes for the other**: the model
     * check cannot see the page tell a lie about the schema, and this cannot see the schema change.
     */
    // 🔴 MEASURED 2026-09-09 — BOTH ARMS, THE FIRST TIME ANY BAN IN THIS PROGRAMME HAS BEEN RUN.
    //   verbatim regression put back  -> RED. The ban works for the exact wording it retired.
    //   the SAME false claim, PARAPHRASED -> GREEN. Every ban in this file was defeated.
    // Paraphrases used: "is something this prototype simply does not keep" / "Nothing here suggests
    // anyone is missing follow-up" / "None of the rows above tells you the day somebody left".
    // ⚠️ DELIBERATELY NOT WIDENED. A ban forbids, so every spelling added is a new way to go RED on
    // honest copy — and this page legitimately says "does not mean everybody is being followed up"
    // three lines from a ban on "nobody is missing follow-up". The measurement is the deliverable
    // here, not a fix: treat these as tripwires on a known wording, never as proof the claim is
    // absent. Where a claim can be checked against the MODEL instead, that retires the ban properly.
    // 🔴 THE QUERY WIDENED TO THE WHOLE PAGE 2026-09-09, WHICH IS THE OPPOSITE OF THE STANDING
    // RULING, AND THE OPPOSITE IS CORRECT FOR A BAN. Found by Ward Builder Three, measured here.
    //
    // This ban used to read `notice` — the provenance paragraph alone. I put the retired phrase
    // "no such field" into a NEIGHBOURING element on the same page and the ban never saw it:
    // 37/37 green with a withdrawn false claim back on the screen.
    //
    // The standing ruling is "narrow what is READ, never lengthen the spelling list". That is right
    // for a POSITIVE claim, where a wide haystack lets a bystander satisfy it. It is WRONG for a
    // BAN, where a narrow haystack means looking in the wrong place: the forbidden phrase anywhere
    // on the page is the defect, wherever it appears. ⚠️ Narrowing a ban WEAKENS it while looking
    // exactly like the sanctioned repair — the two failure modes run in opposite directions and the
    // same remedy cannot serve both.
    //
    // The floor below is what makes a page-wide ban safe: without it, a page that rendered nothing
    // passes every ban trivially. Copied from the sibling ban in this file, which already had one.
    expectNeverSaysAgain(page, "the follow-up provenance note", [
      "is not recorded anywhere",
      "no such field",
      "has no field",
      "does not exist in this prototype",
      "is not held anywhere",
      "nothing in the model records",
    ]);
    // ⚠️ MEASURED 2026-09-09, not assumed: the EMPTIEST LEGITIMATE RENDER of this screen — a real
    // team with zero admissions and zero referrals — is 9,380 characters. That is 19x this floor.
    // So this floor CANNOT detect a partial render; it is a tripwire against a TOTAL one (a throw,
    // or a component that returns nothing), and it is sound for exactly that. Raising it toward
    // 9,380 would make it fire on honest content shrinkage, which is the guards-that-block-their-
    // own-purpose defect. Left at 500 deliberately, with its real reach written down.
    expect(page.length, "the page rendered almost nothing, so the ban above proved nothing").toBeGreaterThan(500);
    expectSays(notice.toLowerCase(), "the follow-up caveat", ["does not mean", "followed up"]);
  });

  it("carries the same wording on a team that DOES have a discharge, so it is not an empty-state message", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const wentHome = admission({
      id: "AD-HOME",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR,
    });

    renderTeam(TEAM_A.id, [wentHome], [toA]);
    const section = screen.getByTestId("ward-community-discharged");
    expect(within(section).getByTestId("ward-community-discharged-list")).toBeTruthy();
    expect(within(section).getByTestId("ward-community-discharged-AD-HOME")).toBeTruthy();
    expect(within(section).getByTestId("ward-community-follow-up-not-recorded").textContent).toContain(
      "Follow-up status is not shown or editable here",
    );
  });

  it("never writes the spec's own heading, which would assert the half the model cannot express", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    const page = (document.body.textContent ?? "").toLowerCase();
    // ⚠️ Widened past the two exact strings, because a claim the model cannot express is still
    // unexpressible when it is rephrased — the original pin would pass on "everyone has follow-up".
    // Spellings chosen so they CANNOT collide with the honest copy on this same page, which says
    // "does not mean everybody is being followed up": a naive ban on "followed up" would go red on
    // correct work, which is the failure this whole pass exists to remove.
    // 🔴 MEASURED 2026-09-09 — BOTH ARMS, THE FIRST TIME ANY BAN IN THIS PROGRAMME HAS BEEN RUN.
    //   verbatim regression put back  -> RED. The ban works for the exact wording it retired.
    //   the SAME false claim, PARAPHRASED -> GREEN. Every ban in this file was defeated.
    // Paraphrases used: "is something this prototype simply does not keep" / "Nothing here suggests
    // anyone is missing follow-up" / "None of the rows above tells you the day somebody left".
    // ⚠️ DELIBERATELY NOT WIDENED. A ban forbids, so every spelling added is a new way to go RED on
    // honest copy — and this page legitimately says "does not mean everybody is being followed up"
    // three lines from a ban on "nobody is missing follow-up". The measurement is the deliverable
    // here, not a fix: treat these as tripwires on a known wording, never as proof the claim is
    // absent. Where a claim can be checked against the MODEL instead, that retires the ban properly.
    expectNeverSaysAgain(page, "the community hub", [
      "no follow-up arranged",
      "nobody is missing follow-up",
      "no one is missing follow-up",
      "everybody has follow-up",
      "everyone has follow-up",
      "all follow-up arranged",
    ]);
    // Non-vacuity: the scan must actually have text to search.
    expect(page.length).toBeGreaterThan(500);
  });
  /**
   * 🔴 **THE BAN ABOVE IS A LIST OF WORDINGS. THIS IS THE FACT THAT MAKES IT LEGITIMATE, AND UNTIL
   * NOW NOTHING HELD IT.**
   *
   * The page must never claim a patient's follow-up is arranged because `Admission.followUp` has no
   * producer: it exists, it carries the vocabulary ["arranged", "not_arranged"], the seed writes it
   * — and **no reducer event can set one**, so a value on screen would be describing fixture data as
   * though a ward had done something. A ban on sentences cannot see that premise change: a rewrite
   * that gave the field a producer would leave every spelling above green while the ban quietly
   * became wrong.
   *
   * ⚠️ **AND THE NEAREST EXISTING GUARD PINS THE PROSE ABOUT THIS, NOT THE PROPERTY.**
   * `ward-community-corrected-claims.test.ts` asserts that the explanatory comment still contains
   * "no producer and no consumer" — which is true of a sentence, and stays true when the code stops
   * matching it. This asserts the code.
   *
   * Comments are dropped before the scan, because the comment explaining this very rule names the
   * field and would otherwise satisfy the check that describes it.
   */
  it("no reducer event gives Admission.followUp a value, which is why the wordings above are banned", () => {
    const reducer = readFileSync("src/components/ward-management/ward-flow-reducer.ts", "utf8");
    const executable = reducer.split("\n").filter((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    });

    const FIELD = "followUp:";
    const writes = executable
      .filter((line) => line.includes(FIELD))
      .map((line) =>
        line
          .slice(line.indexOf(FIELD) + FIELD.length)
          .split(",")[0]
          .trim(),
      );

    // ⚠️ FLOORED ON THE POPULATION WALKED, NEVER ON THE FINDINGS. Renaming the field takes this to
    // zero writes, and "every write is null" is trivially true of no writes — the vacuous green.
    // A rename must go RED here, because it means the ban above is guarding a premise that moved.
    expect(
      writes.length,
      "no `followUp:` write found anywhere in the reducer. Either the field was renamed — in which " +
        "case the follow-up wording ban above is guarding a premise that has moved and must be " +
        "re-derived — or this scan is broken. Neither is evidence that nothing writes one.",
    ).toBeGreaterThan(0);

    expect(
      writes.filter((value) => value !== "null"),
      "a reducer event now writes a non-null `Admission.followUp`. The field has gained a producer, " +
        "so 'nothing can arrange follow-up' has stopped being true — take the wording ban above back " +
        "to the owner rather than widening it.",
    ).toEqual([]);
  });

  it("accounts for the departures that are not on list 1 rather than dropping them", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const transferred = admission({
      id: "AD-MOVED",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "transferred-to-another-psychiatric-ward",
      leftAt: NOW_ANCHOR,
    });

    renderTeam(TEAM_A.id, [transferred], [toA]);
    // The person is not on list 1 — and is not silently gone either.
    expect(screen.getByTestId("ward-community-discharged-empty")).toBeTruthy();
    const footnote = screen.getByTestId("ward-community-other-departures").textContent ?? "";
    expect(footnote).toContain("1 other admission");
    // Deliberately trimmed before "into this area". The screen still carries region-era wording in
    // its headings and empty states (reported, not fixed here), and pinning that phrasing would make
    // this guard resist the copy correction rather than survive it.
    // Widened 2026-09-09: RED on "Nothing in those records says the person made it back into
    // the community" — a faithful restatement.
    expectSays(footnote, "the return caveat", ["came back", "returned", "made it back", "back into the community"]);
  });
});

describe("community hub — the list that cannot be built", () => {
  it("renders the referrals section with a statement and no list at all", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    const section = screen.getByTestId("ward-community-referrals");
    const statement = within(section).getByTestId("ward-community-referrals-unattributable").textContent ?? "";
    // Widened 2026-09-09: RED on "Nothing can pin down which referrals this team itself raised".
    // ⚠️ Deliberately NOT widened to "nothing says which team" — the NEXT sentence of this same
    // paragraph already says it, so that spelling would survive deleting this claim and put the
    // hole straight back. Checked against the surviving text, not against the reword.
    expectSays(statement, "the raised-by attribution refusal", [
      "cannot be attributed",
      "not attributable",
      "pin down",
      "cannot be traced",
    ]);
    // Widened 2026-09-09: RED on "but nothing on the raising end names a team", a faithful
    // restatement. ⚠️ "nothing says which team" is safe to add here even though those words appear
    // in the rail panel too — this haystack is the referrals element alone, not the page. Checked.
    expectSays(statement, "the raised-by attribution refusal", [
      "source side",
      "no team",
      "nothing says which team",
      "does not name a team",
      "without a team name",
    ]);
    // A section that says why it is empty is honest; a list here would necessarily be a
    // fabrication, because nothing in the model says which team raised a referral.
    expect(within(section).queryByRole("list")).toBeNull();
  });
});

/**
 * ⚠️ **NO CALENDAR DATE OR CLOCK FACE IS EVER RENDERED — REWRITTEN 2026-09-01 RATHER THAN DELETED,
 * BECAUSE THE GUARANTEE SURVIVES IN A NARROWER FORM.**
 *
 * Until this change this block pinned that neither withheld field ever printed anything beyond "a
 * date is recorded" — the render was deliberately unchanged while only the file's account of WHY
 * changed. The owner has since ruled (2026-09-01) that once a duration can be computed soundly — see
 * the screen's header block: `INSTANT_FIELDS` names both fields, so `now - field` is sound on this
 * clock — it should be SHOWN, as elapsed time, never a calendar date. So what this block still owes
 * a reader is narrower but not weaker: no CALENDAR date and no clock face ever appears —
 * `formatInstant`'s "HH:MM" shape and `formatInstantWithDay`'s "yesterday"/"tomorrow" register are
 * both still forbidden — only a duration counted in days or weeks.
 *
 * The fixture below populates both fields deliberately, one in each direction — `expectedDischargeAt`
 * still ahead, `leftAt` well in the past — so the assertions prove the row for each field, not only
 * that the page rendered something.
 */
describe("community hub — elapsed time is rendered, never a calendar date or clock face", () => {
  it("renders how long ago somebody left and how far off the expected date sits, never an instant", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const dated = admission({
      id: "AD-DATED",
      referralId: toA.id,
      state: "occupied",
      expectedDischargeAt: NOW_ANCHOR + 3 * MINUTES_PER_DAY,
    });
    const wentHome = admission({
      id: "AD-HOME",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 35 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [dated, wentHome], [toA]);
    // Non-vacuity: both instant-carrying rows really are on the page.
    expect(screen.getByTestId("ward-community-expected-AD-DATED")).toBeTruthy();
    expect(screen.getByTestId("ward-community-discharged-AD-HOME")).toBeTruthy();

    const page = document.body.textContent ?? "";
    // `formatInstant`'s output shape. Any HH:MM here means somebody put a clock face back.
    /*
     * 🔴 **NO `\b` HERE, AND ITS ABSENCE IS THE POINT — THIS ASSERTION COULD NOT FAIL UNTIL
     * 2026-09-07.** It read `/\b\d{2}:\d{2}\b/`, and `textContent` CONCATENATES SIBLING ELEMENTS
     * WITH NO SEPARATOR, so a rendered clock face arrives as `"North Metro14:30Ready"`. `o` and `1`
     * are both word characters, so there is no word boundary between them and `\b` never fires:
     *
     *     /\b\d{2}:\d{2}\b/.test("North Metro14:30Ready")   -> false   what the DOM gives
     *     /\b\d{2}:\d{2}\b/.test("North Metro 14:30 Ready") -> true    what the author pictured
     *
     * **So `not.toMatch` passed whether or not a time was on screen** — a guard against a clinical
     * regression that was guarding nothing, on the exact defect class this file exists to catch.
     * ⚠️ The same root cause shipped in a second test tonight, in another chat's work, for the same
     * reason: **an author writes the string they see on screen, and the DOM hands the test a string
     * with the spaces taken out.**
     *
     * Lookarounds instead of boundaries: they exclude a longer run of digits (`123:456` does not
     * match) without requiring a non-word character to sit beside the time.
     */
    expect(page).not.toMatch(/(?<!\d)\d{2}:\d{2}(?!\d)/);
    // `formatInstantWithDay`'s calendar-relative register — this screen speaks only in elapsed
    // days/weeks, never "yesterday"/"tomorrow".
    for (const relative of ["yesterday", "tomorrow"]) {
      expect(page.toLowerCase(), `the community hub renders "${relative}"`).not.toContain(relative);
    }

    // The retired "a date is recorded, and nothing more" wording must not have come back.
    // ⚠️ The retired wording, plus the rephrasings that would restore the same withdrawn claim.
    // A ban on three exact sentences is defeated by anyone who paraphrases them — which is what a
    // redesign does — so the guard has to forbid the CLAIM, not the sentence that carried it.
    // 🔴 MEASURED 2026-09-09 — BOTH ARMS, THE FIRST TIME ANY BAN IN THIS PROGRAMME HAS BEEN RUN.
    //   verbatim regression put back  -> RED. The ban works for the exact wording it retired.
    //   the SAME false claim, PARAPHRASED -> GREEN. Every ban in this file was defeated.
    // Paraphrases used: "is something this prototype simply does not keep" / "Nothing here suggests
    // anyone is missing follow-up" / "None of the rows above tells you the day somebody left".
    // ⚠️ DELIBERATELY NOT WIDENED. A ban forbids, so every spelling added is a new way to go RED on
    // honest copy — and this page legitimately says "does not mean everybody is being followed up"
    // three lines from a ban on "nobody is missing follow-up". The measurement is the deliverable
    // here, not a fix: treat these as tripwires on a known wording, never as proof the claim is
    // absent. Where a claim can be checked against the MODEL instead, that retires the ban properly.
    expectNeverSaysAgain(page, "the community hub's departure rows", [
      "The date itself is not shown",
      "the date is not shown",
      "No row above says when somebody left",
      "no row says when somebody left",
      "The ward has written down an expected discharge date",
      "the ward has recorded an expected discharge date",
    ]);
    // The floor that makes a page-wide ban safe: a page that rendered nothing passes every ban
    // trivially. Its sibling ban in this file already carried one; this one did not. Added
    // 2026-09-09 for consistency. ⚠️ ADOPTED, NOT PROVED — see the note on the other ban.
    // ⚠️ MEASURED 2026-09-09, not assumed: the EMPTIEST LEGITIMATE RENDER of this screen — a real
    // team with zero admissions and zero referrals — is 9,380 characters. That is 19x this floor.
    // So this floor CANNOT detect a partial render; it is a tripwire against a TOTAL one (a throw,
    // or a component that returns nothing), and it is sound for exactly that. Raising it toward
    // 9,380 would make it fire on honest content shrinkage, which is the guards-that-block-their-
    // own-purpose defect. Left at 500 deliberately, with its real reach written down.
    expect(page.length, "the page rendered almost nothing, so the ban above proved nothing").toBeGreaterThan(500);

    // What the rows say INSTEAD of an instant: elapsed time, in both directions.
    expect(screen.getByTestId("ward-community-expected-AD-DATED").textContent).toContain(
      "Expected discharge in 3 days",
    );
    // 🔴 "left" REMOVED FROM ALL FOUR OF THESE 2026-09-09, AND IT WAS THE WHOLE GUARD.
    // "Left this ward" is the FIXED PREFIX of every departureLabel output, so it satisfied this
    // concept whatever the duration said — or whether any duration was rendered at all. Proved by
    // dropping the elapsed figure from EVERY row: not one of these four guards fired, and the only
    // assertion that caught it was an UNCONVERTED verbatim pin three lines below one of them.
    // The duration is a MEASURED FIGURE, not prose — a rewording cannot turn "5 weeks" into
    // something else and still be true — so one spelling is correct here, not a tolerance gap.
    expectSays(
      screen.getByTestId("ward-community-discharged-AD-HOME").textContent,
      "the elapsed-since-departure figure",
      ["5 weeks"],
    );
  });
});

/**
 * ⚠️ **THE WEEK-ROUNDING BOUNDARY, PINNED EXACTLY — `community-elapsed.ts`'s ONE rule both fields
 * use.** "5 weeks ago" for 34 days and for 41 days are both defensible; what is not defensible is
 * nobody knowing which. This project floors, the same discipline `daysInBed` already holds for days:
 * a duration reads as a further week only once that whole day has actually completed, never on the
 * day before appearing close enough. So 34 days is still "4 weeks ago" and 35 days — the first day
 * a fifth full week is complete — is where "5 weeks ago" begins. Both sides of the boundary are
 * asserted so a future change that rounds the other way, or rounds nearest instead of down, fails
 * here rather than being noticed on a screen.
 */
describe("community hub — the week-rounding boundary is floored, and pinned on both sides", () => {
  it("does not cross into a further week until that whole day has completed", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const stillFourWeeks = admission({
      id: "AD-34",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 34 * MINUTES_PER_DAY,
    });
    const justFiveWeeks = admission({
      id: "AD-35",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 35 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [stillFourWeeks, justFiveWeeks], [toA]);

    expectSays(
      screen.getByTestId("ward-community-discharged-AD-34").textContent,
      "the elapsed-since-departure figure",
      ["4 weeks"],
    );
    expect(screen.getByTestId("ward-community-discharged-AD-34").textContent).not.toContain("5 weeks");
    expect(screen.getByTestId("ward-community-discharged-AD-35").textContent).toContain("Left this ward 5 weeks ago");
  });

  it("stays in whole days below one week, on both sides of that boundary", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const sixDays = admission({
      id: "AD-6D",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 6 * MINUTES_PER_DAY,
    });
    const oneWeek = admission({
      id: "AD-7D",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: NOW_ANCHOR - 7 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [sixDays, oneWeek], [toA]);

    expectSays(
      screen.getByTestId("ward-community-discharged-AD-6D").textContent,
      "the elapsed-since-departure figure",
      ["6 days"],
    );
    expectSays(
      screen.getByTestId("ward-community-discharged-AD-7D").textContent,
      "the elapsed-since-departure figure",
      ["1 week"],
    );
  });
});

/**
 * ⚠️ **THE TWO WITHHELD FIELDS ARE NOT THE SAME SHAPE — `expectedDischargeAt` CAN BE OVERDUE.**
 * `leftAt` is always past; `expectedDischargeAt` can be past or future, and `isPastExpectedDischarge`
 * exists precisely because a person can be overdue. An elapsed renderer applied blindly to both would
 * print "left −3 days ago" for someone not yet due. This screen still never spends the word
 * "overdue" (`tests/ward-community-hub.dom.test.tsx`'s "no threshold" test below still forbids it),
 * so the overdue direction is proved on its own wording: "was N ago" rather than a negative count.
 */
describe("community hub — an overdue expected date reads as overdue, not as a negative number", () => {
  it("says the plan is ahead when the date has not yet passed", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const stillAhead = admission({
      id: "AD-AHEAD",
      referralId: toA.id,
      state: "occupied",
      expectedDischargeAt: NOW_ANCHOR + 10 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [stillAhead], [toA]);

    expect(screen.getByTestId("ward-community-expected-AD-AHEAD").textContent).toContain(
      "Expected discharge in 1 week",
    );
  });

  it("says the plan has passed, in the past tense, when the ward is now overdue", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const overdue = admission({
      id: "AD-OVERDUE",
      referralId: toA.id,
      state: "occupied",
      expectedDischargeAt: NOW_ANCHOR - 10 * MINUTES_PER_DAY,
    });

    renderTeam(TEAM_A.id, [overdue], [toA]);

    const row = screen.getByTestId("ward-community-expected-AD-OVERDUE").textContent ?? "";
    // ⚠️ "expected" REMOVED 2026-09-09 — "Expected discharge" is the fixed prefix of every
    // expectedBackLabel branch, so it held regardless of the overdue figure.
    expectSays(row, "the overdue-expected-date figure", ["1 week"]);
    // Never a negative count, and never the word this screen still does not use.
    expect(row).not.toMatch(/-\s*\d/);
    expect(row.toLowerCase()).not.toContain("overdue");
  });
});

/**
 * ⚠️ **NULL IS NOT ZERO.** A record with no `leftAt` has no elapsed time to state — it is a distinct
 * absence, not a duration of "0 days ago", and the wording for it is unchanged from before this
 * screen rendered elapsed time at all.
 */
describe("community hub — an unrecorded departure time is an absence, never a zero", () => {
  it("renders the same absence wording it always has, and no elapsed count", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    const noDepartureTime = admission({
      id: "AD-NO-TIME",
      referralId: toA.id,
      state: "departed",
      leavingDestination: "discharged-to-the-community",
      leftAt: null,
    });

    renderTeam(TEAM_A.id, [noDepartureTime], [toA]);

    const row = screen.getByTestId("ward-community-discharged-AD-NO-TIME").textContent ?? "";
    // 🔴 THE SPELLING "left" REMOVED 2026-09-09, AND THIS WAS THE WORST OF THE THREE. "Left this
    // ward" is the fixed prefix of EVERY departureLabel output, including the ordinary recorded
    // case — so "left" alone satisfied this concept and the guard could not fail. This test's own
    // title is "an unrecorded departure time is an absence, never a zero"; proved by rendering the
    // unrecorded case as the fabricated "Left this ward 3 weeks ago", which is precisely the
    // invented figure it forbids. 37/37 passed. The sibling bans on "0 days" and "today" did not
    // catch it either, because an invented "3 weeks" contains neither.
    expectSays(row, "the unrecorded-departure line", ["not recorded", "unrecorded", "no departure time"]);
    expect(row).not.toContain("0 days");
    expect(row).not.toContain("today");
  });
});

describe("community hub — what it must never grow", () => {
  it("has no writable control anywhere: no handover note, no free text of any kind", () => {
    // FD-13 permits exactly one story field and it is on the referral. This is the screen where a
    // second one feels obviously necessary, so the absence is asserted rather than intended.
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll("input")).toHaveLength(0);
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(document.querySelectorAll("[contenteditable]")).toHaveLength(0);
  });

  it("shows no threshold, no overdue and no invented interval", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(
      TEAM_A.id,
      [admission({ id: "AD-A", referralId: toA.id, expectedDischargeAt: NOW_ANCHOR + 4320 })],
      [toA],
    );

    const page = (document.body.textContent ?? "").toLowerCase();
    for (const forbidden of ["overdue", "breach", "deadline", "days to contact", "within 7 days"]) {
      expect(page, `the community hub renders "${forbidden}"`).not.toContain(forbidden);
    }
    expect(page.length).toBeGreaterThan(500);
  });

  it("says the team name is a placeholder from one source document, above every list", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    renderTeam(TEAM_A.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);

    expect(screen.getByTestId("ward-community-placeholder-notice").textContent).toContain(
      "This team name comes from the S2015 catchment table",
    );
  });
});

describe("community hub — the team switcher, and the route it resolves", () => {
  /**
   * The reachability figure `tests/ward-nav.test.ts` records for `community/[teamId]` counts
   * CONCRETE hrefs, and the switcher builds the rest of them. What it actually covers is
   * established here, by rendering the screen and reading the links back out of the markup.
   */
  it("links every other team, and never the page it is on", () => {
    const [toA] = referralsNaming([TEAM_A.name], "Perth Metropolitan");
    for (const team of [TEAM_A, TEAM_B]) {
      const { unmount } = renderTeam(team.id, [admission({ id: "AD-A", referralId: toA.id })], [toA]);
      const switcher = screen.getByRole("navigation", { name: "Other community teams" });
      const hrefs = within(switcher)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));

      expect(hrefs).toHaveLength(COMMUNITY_TEAM_PAGES.length - 1);
      expect(hrefs).not.toContain(communityTeamHref(team));
      for (const other of COMMUNITY_TEAM_PAGES) {
        if (other.id === team.id) continue;
        expect(hrefs, `${team.name} does not link ${other.name}`).toContain(communityTeamHref(other));
      }
      unmount();
    }
  });

  it("builds every href from the derived id, under the real route", () => {
    for (const team of COMMUNITY_TEAM_PAGES) {
      expect(communityTeamHref(team)).toBe(`/mockups/ward-flow/community/${team.id}`);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * THIRD EDITION — the referral queue and "admitted while already with this team".
 *
 * Everything below guards the CLAIM and the CLINICAL PROPERTY, never the rendering: no pinned
 * sentence, no class name, no DOM shape, no positional column index. Table columns are read by
 * their HEADER NAME, resolved at render time from the real `<thead>`, so a restyle of this panel
 * cannot break these tests the way a restyle would break a test that read `cells[3]`.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

/** One referral naming `teamName`, raised at `raisedAt`, through the reducer's own write path —
 *  never constructed by hand, so its shape is a shape the live system actually produces. Returns
 *  the state it landed in (for a caller that wants to accept it next) alongside the referral. */
function raiseTeamReferral(
  state: ReturnType<typeof seedWardFlowState>,
  teamName: string,
  raisedAt: number,
): { state: ReturnType<typeof seedWardFlowState>; referral: Referral } {
  const before = state.referrals.length;
  const next = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: raisedAt,
    ageBand: "Adult",
    destinations: [{ kind: "community_team", teamName }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(next.rejections, "the fixture referral was refused").toEqual([]);
  const created = next.referrals.slice(before);
  expect(created, "the reducer did not create the fixture referral").toHaveLength(1);
  return { state: next, referral: created[0] };
}

/** `referral` accepted by the network at `decidedAt`, as `coordinator` — a coordinator answering
 *  on a destination's behalf (`CO-D2`), used here as a read-only fixture builder for the
 *  "excludes a referral once answered" test below. The community hub's OWN control now dispatches
 *  as `role: "community"` instead (RB5, item 16, 2026-09-17) — see the live-dispatch describe
 *  block further down for that proof. */
function acceptTeamReferral(
  state: ReturnType<typeof seedWardFlowState>,
  referralId: string,
  decidedAt: number,
): ReturnType<typeof seedWardFlowState> {
  const next = wardFlowReducer(state, {
    type: "ACCEPT_REFERRAL",
    role: "coordinator",
    now: decidedAt,
    referralId,
    destinationKind: "community_team",
  });
  expect(next.rejections, "the fixture acceptance was refused").toEqual([]);
  return next;
}

/** The `<td>`/`<th>` text under a header name, resolved from the real `<thead>` rather than a
 *  hard-coded index — exactly what the brief asks for: address a column by its name, not its
 *  position, so a reordered or renamed column fails loudly instead of silently comparing the
 *  wrong cell. */
function cellByHeader(table: HTMLElement, row: HTMLElement, headerName: string): string {
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.trim());
  const index = headers.indexOf(headerName);
  expect(index, `no column named "${headerName}" in this table (headers: ${headers.join(", ")})`).toBeGreaterThan(-1);
  // `th[scope=row]` and `td` together, in DOM order — the same order the headers were read in, so
  // the two arrays line up by position without either being read by a hard-coded index.
  const cells = Array.from(row.querySelectorAll("th, td"));
  return cells[index]?.textContent?.trim() ?? "";
}

const ACCEPTED_TEAM = COMMUNITY_TEAM_PAGES[2];

describe("admitted while already with this team — the acceptance-before-admission rule", () => {
  /**
   * ⚠️ **THE FLOOR.** One fixture, three admissions, each forcing a different one of the three
   * outcomes `categoriseTeamAdmission` can produce. If the seed only ever produced one shape, every
   * assertion below would pass vacuously — this walks the population and proves it is not vacuous
   * before drawing any conclusion from it.
   */
  function buildThreeShapeFixture() {
    let state = seedWardFlowState();

    // Shape 1: accepted well before the bed began — belongs in the table.
    const acceptedEarly = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 20 * MINUTES_PER_DAY);
    state = acceptTeamReferral(acceptedEarly.state, acceptedEarly.referral.id, NOW_ANCHOR - 15 * MINUTES_PER_DAY);
    // ⚠️ Re-read the referral from the state the acceptance actually landed in. Keeping the
    // pre-acceptance object here is the bug this comment exists to prevent: it still reads
    // "queued", so the admission below would never resolve to "accepted-before-admission" at all.
    const acceptedEarlyReferral = state.referrals.find((referral) => referral.id === acceptedEarly.referral.id)!;
    const admittedAfterAcceptance = admission({
      id: "AD-ACCEPTED-FIRST",
      referralId: acceptedEarlyReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 5 * MINUTES_PER_DAY,
    });

    // Shape 2: the bed began first, and the referral to this team came afterwards — the ward
    // reaching out during an admission that is still open. Must be EXCLUDED from the table.
    const referredLate = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 10 * MINUTES_PER_DAY);
    state = acceptTeamReferral(referredLate.state, referredLate.referral.id, NOW_ANCHOR - 8 * MINUTES_PER_DAY);
    const referredLateReferral = state.referrals.find((referral) => referral.id === referredLate.referral.id)!;
    const admittedBeforeReferral = admission({
      id: "AD-REFERRED-DURING",
      referralId: referredLateReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 30 * MINUTES_PER_DAY,
    });

    // Shape 3: a bed pulled for this team and nobody has arrived yet — no admission start exists
    // to compare an acceptance against, so this can be neither of the other two.
    const pulledFor = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 3 * MINUTES_PER_DAY);
    state = pulledFor.state;
    const bedPulled = admission({
      id: "AD-PULLED",
      referralId: pulledFor.referral.id,
      state: "pulled",
      pulledAt: NOW_ANCHOR - 1 * MINUTES_PER_DAY,
      arrivedAt: null,
    });

    return {
      referrals: [acceptedEarlyReferral, referredLateReferral, pulledFor.referral],
      admissions: [admittedAfterAcceptance, admittedBeforeReferral, bedPulled],
    };
  }

  it("floors the population: the fixture really does produce both an included and an excluded admission", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    // Non-vacuity on the fixture itself, independent of the rendered page: three admissions, three
    // distinct referrals, none colliding.
    expect(admissions).toHaveLength(3);
    expect(new Set(referrals.map((referral) => referral.id)).size).toBe(3);
  });

  it("includes only the admission this team accepted BEFORE the bed began", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    const table = screen.getByTestId("ward-community-accepted-before-admission-table");
    expect(within(table).queryByTestId("ward-community-accepted-before-admission-AD-ACCEPTED-FIRST")).toBeTruthy();
    expect(within(table).queryByTestId("ward-community-accepted-before-admission-AD-REFERRED-DURING")).toBeNull();
    expect(within(table).queryByTestId("ward-community-accepted-before-admission-AD-PULLED")).toBeNull();
  });

  it("excludes a referral raised during the admission the person is still in, and names it in the other-groups count", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    const otherGroups = screen.getByTestId("ward-community-accepted-before-admission-other-groups").textContent ?? "";
    // One admission referred during its own bed (AD-REFERRED-DURING), one bed pulled with nobody
    // arrived (AD-PULLED) — both real counts, read from the same fixture the table renders.
    expectSays(otherGroups, "the referred-during-stay count", ["1 admission", "referred"]);
    // ⚠️ THE SPELLING "1 " REMOVED 2026-09-09. It is one digit and a space, and the SAME paragraph
    // says "1 admission was referred..." two clauses earlier — site 910's subject. So this guard
    // was satisfied by its neighbour's count and could not fail. Proved by deleting the whole
    // "and N has a bed pulled and not yet arrived" clause: 37/37 still passed.
    expectSays(otherGroups, "the pulled-not-arrived count", ["bed pulled", "not yet arrived"]);
  });

  it("reads the acceptance-before-admission gap by its column header, not by position", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    const table = screen.getByTestId("ward-community-accepted-before-admission-table");
    const row = within(table).getByTestId("ward-community-accepted-before-admission-AD-ACCEPTED-FIRST");
    // 15 days accepted before now, 5 days into the bed — the gap between acceptance and arrival is
    // 10 days, resolved by the column NAMED "Accepted before the bed began".
    const gapCell = cellByHeader(table, row, "Accepted before the bed began");
    expect(gapCell.length, "the gap column rendered nothing").toBeGreaterThan(0);
    expect(gapCell.toLowerCase()).not.toContain("overdue");
  });

  it("never claims, in any heading or sentence, that a person is currently or actively with the team", () => {
    const { admissions, referrals } = buildThreeShapeFixture();
    renderTeam(ACCEPTED_TEAM.id, admissions, referrals);

    // The NEGATIVE half is a page-wide ban and must stay page-wide: a forbidden claim anywhere on
    // the screen is the defect, so narrowing this would be the bug, not the fix.
    const page = (document.body.textContent ?? "").toLowerCase();
    for (const forbidden of ["currently active with", "actively with this team", "currently with this team"]) {
      expect(page, `the page claims active care with the forbidden phrase "${forbidden}"`).not.toContain(forbidden);
    }

    /*
     * 🔴 **THE POSITIVE HALF READ THE WHOLE PAGE UNTIL 2026-09-05, AND THAT MADE IT UNABLE TO FAIL.**
     * A second paragraph further down repeats "no team discharge, no episode end", so both concepts
     * were satisfied by a sentence that is not this caveat. Measured, not argued: deleting the whole
     * `<p data-testid="ward-community-accepted-before-admission-not-active-claim">` from
     * `community-screen.tsx` — the caveat gone from the screen entirely — left this test GREEN.
     *
     * That caveat is the only thing stopping a coordinator reading the table above as "these people
     * are currently under this team's care", which the record cannot support. Pointed at its own
     * element, the same deletion now fails on the missing testid before any wording is compared.
     *
     * ⚠️ The fix is the ELEMENT, not the wording. Do not repair a future red here by adding
     * spellings: a longer list makes a guard that already cannot fail harder to fail.
     */
    const caveat = screen.getByTestId("ward-community-accepted-before-admission-not-active-claim");
    // 🔴 "still with" REMOVED 2026-09-09 — IT APPEARED IN THE CAVEAT AND IN ITS OPPOSITE.
    // The caveat says the table "does not say they were STILL WITH this team". A reversal saying
    // the table "shows the people STILL WITH this team today, and who remain under its care"
    // contains the same two words — so this guard passed a claim that asserts exactly what the
    // caveat exists to deny. Measured: 37/37 green on the reversed text.
    //
    // This is worse than a guard that cannot fail. It BLESSED a false clinical statement — that a
    // community team currently has these people in its care — which nothing in the model can
    // support, because nothing records a team closing somebody.
    //
    // The spellings below are all forms of the REFUSAL, which the reversal cannot borrow.
    // Deliberately NOT including "never as a statement": the paragraph's closing sentence already
    // says it, so it would survive a reversal of this sentence and put the hole straight back.
    expectSays(caveat, "the still-with-team caveat", [
      "does not say",
      "does not claim",
      "makes no claim",
      "does not establish current care",
    ]);
    // 🔴 SECOND REVERSAL IN THE SAME PARAGRAPH, same shape as the line above. The old spellings
    // ["no team discharge", "no episode end"] are an ENUMERATION OF WHAT IS MISSING, and an
    // enumeration reads identically inside a sentence asserting the opposite:
    //   real:     "Nothing records a team closing somebody: no team discharge, no episode end
    //              and no closing date exist anywhere on the record."
    //   reversal: "Closing a person is fully recorded: no team discharge, no episode end and no
    //              closing date is ever missing from the record."
    // Measured 2026-09-09: 37/37 green on the reversal. A coordinator would be told the record is
    // complete, and so would trust a list that still shows people this team closed months ago.
    //
    // Now asserts the ABSENCE ITSELF, which a reversal cannot carry. Deliberately NOT "no way to
    // know" — the next sentence says it and would survive a reversal of this one.
    expectSays(caveat, "the still-with-team caveat", [
      "nothing in this prototype records",
      "nothing records",
      "records nothing",
      "no record of a team closing",
      "no community-team closure is recorded",
    ]);
  });

  it("carries no colour or emphasis keyed to the size of the gap: two very different gaps render identically apart from their own id", () => {
    let state = seedWardFlowState();
    const short = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 6 * MINUTES_PER_DAY);
    state = acceptTeamReferral(short.state, short.referral.id, NOW_ANCHOR - 5 * MINUTES_PER_DAY);
    const shortReferral = state.referrals.find((referral) => referral.id === short.referral.id)!;
    const shortGapAdmission = admission({
      id: "AD-SHORT-GAP",
      referralId: shortReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 4 * MINUTES_PER_DAY,
    });

    const long = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 400 * MINUTES_PER_DAY);
    state = acceptTeamReferral(long.state, long.referral.id, NOW_ANCHOR - 380 * MINUTES_PER_DAY);
    const longReferral = state.referrals.find((referral) => referral.id === long.referral.id)!;
    const longGapAdmission = admission({
      id: "AD-LONG-GAP",
      referralId: longReferral.id,
      state: "occupied",
      arrivedAt: NOW_ANCHOR - 4 * MINUTES_PER_DAY,
    });

    renderTeam(ACCEPTED_TEAM.id, [shortGapAdmission, longGapAdmission], [shortReferral, longReferral]);

    const table = screen.getByTestId("ward-community-accepted-before-admission-table");
    const shortRow = within(table).getByTestId("ward-community-accepted-before-admission-AD-SHORT-GAP");
    const longRow = within(table).getByTestId("ward-community-accepted-before-admission-AD-LONG-GAP");
    // Same class list on both rows regardless of a roughly sixty-fold difference in the gap they
    // render — the only thing distinguishing them is their own identity, never a rule keyed to
    // how long the gap is.
    expect(shortRow.className).toBe(longRow.className);
    expect(shortRow.hasAttribute("data-tone")).toBe(false);
    expect(longRow.hasAttribute("data-tone")).toBe(false);
  });

  it("says nobody accepted-before-admission in words, when there is nobody, and never a bare dash or blank", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [admission({ id: "AD-A", referralId: toTeam.id, state: "occupied" })], [toTeam]);

    const empty = screen.getByTestId("ward-community-accepted-before-admission-empty").textContent ?? "";
    expect(empty.length).toBeGreaterThan(10);
    expect(empty.trim()).not.toBe("");
    expect(empty.trim()).not.toBe("-");
    expect(empty.trim()).not.toBe("—");
  });
});

describe("waiting for your answer — the team's own queue, and how it decides (RB5, item 16, 2026-09-17)", () => {
  it("shows a referral whose addressing to this team is still queued", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [], [toTeam]);

    expect(screen.getByTestId(`ward-community-waiting-${toTeam.id}`)).toBeTruthy();
  });

  it("excludes a referral once this team's addressing has been answered", () => {
    let state = seedWardFlowState();
    const raised = raiseTeamReferral(state, ACCEPTED_TEAM.name, NOW_ANCHOR - 2 * MINUTES_PER_DAY);
    state = acceptTeamReferral(raised.state, raised.referral.id, NOW_ANCHOR - 1 * MINUTES_PER_DAY);
    const accepted = state.referrals.find((referral) => referral.id === raised.referral.id)!;

    renderTeam(ACCEPTED_TEAM.id, [], [accepted]);

    expect(screen.queryByTestId(`ward-community-waiting-${accepted.id}`)).toBeNull();
    expect(screen.getByTestId("ward-community-waiting-empty")).toBeTruthy();
  });

  it("offers an accept button and a decline button naming the community vocabulary, and the decline confirm control is blocked until a reason is chosen", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [], [toTeam]);

    const panel = screen.getByTestId("ward-community-waiting");
    // RB5 (item 16, 2026-09-17) — "a community team may accept, for follow-up only". This used to
    // assert NO accept button existed at all; see the live-dispatch proof below ("clicking Accept
    // referral dispatches ACCEPT_REFERRAL...") for the click actually reaching the reducer.
    expect(within(panel).getByTestId(`ward-community-accept-${toTeam.id}`)).toBeTruthy();
    const declineToggle = within(panel).getByTestId(`ward-community-decline-toggle-${toTeam.id}`);
    expect(declineToggle).toBeTruthy();

    fireEvent.click(declineToggle);
    const reasonSelect = screen.getByTestId(`ward-community-decline-reason-${toTeam.id}`);
    const confirmBtn = screen.getByTestId(`ward-community-decline-confirm-${toTeam.id}`);

    // Engine fix, 2026-09-17 (was ISSUE-P1-83): the reason list is the REAL community vocabulary
    // (`COMMUNITY_DECLINE_REASONS`/`COMMUNITY_DECLINE_REASON_LABELS`), and the confirm control now
    // dispatches a real `DECLINE_REFERRAL` once a reason is chosen — see the "dispatches a real
    // DECLINE_REFERRAL" suite below for the live proof. Until then it stays `aria-disabled` (never
    // native `disabled`, so it stays screen-reader-discoverable) — the same "state a reason before
    // declining" rule `referral-match.tsx`'s own ward and ED controls hold to.
    expect(within(reasonSelect).getByText("Outside the team's catchment area")).toBeTruthy();
    expect(confirmBtn.getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(reasonSelect, { target: { value: "outside_the_teams_catchment" } });
    expect(confirmBtn.getAttribute("aria-disabled")).toBeNull();
    expect(confirmBtn.getAttribute("title")).toBeNull();

    expect(screen.getByTestId("ward-community-waiting-not-actionable").textContent).toContain(
      "Community-team roles can accept or decline referrals addressed to their own team, for follow-up only",
    );
  });
});

/**
 * ⚠️ **THE CONFIRM CONTROL DISPATCHES A REAL `DECLINE_REFERRAL` — engine fix, 2026-09-17, closing
 * ISSUE-P1-83.** Everything below drives the LIVE reducer through `useWardFlow()`'s own `dispatch`
 * (never a hand-built `Referral` passed as a display prop, which `renderTeam`'s tests above use and
 * which the confirm button's own `dispatch` cannot see), so a referral raised through the seed
 * button is a referral the reducer actually holds — the only way to prove a click really reaches
 * it rather than merely looking as though it does.
 */
describe("confirming a community decline dispatches a real DECLINE_REFERRAL (engine fix, 2026-09-17)", () => {
  function LiveQueueTest() {
    const { dispatch, referrals } = useWardFlow();
    const seeded = referrals.find(
      (referral) =>
        referral.destinations[0]?.destination.kind === "community_team" &&
        referral.destinations[0].destination.teamName === ACCEPTED_TEAM.name,
    );
    return (
      <>
        <button
          type="button"
          data-testid="seed-referral-btn"
          onClick={() => {
            dispatch({
              type: "RECEIVE_REFERRAL",
              role: "community",
              now: NOW_ANCHOR,
              ageBand: "Adult",
              destinations: [{ kind: "community_team", teamName: ACCEPTED_TEAM.name }],
              homeRegion: "Perth Metropolitan",
              suburb: { kind: "named", name: "Armadale" },
              source: "community",
              urgency: 2,
              originSiteCode: "RPH",
              transportNeeded: false,
              ...FIXTURE_HISTORY,
            });
          }}
        >
          Seed
        </button>
        {/* The one home for this wording (`ward-referrals.ts`) — read here rather than re-spelled,
            so this test asserts the real addressing state rather than a string it invented. */}
        <span data-testid="harness-declined-label">
          {seeded ? referralAddressingStateLabel(seeded.destinations[0]) : "not seeded"}
        </span>
        <CommunityScreen teamId={ACCEPTED_TEAM.id} />
      </>
    );
  }

  function renderLiveQueue() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LiveQueueTest />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("seed-referral-btn"));
  }

  it("does nothing when confirmed with no reason chosen — the referral stays queued", () => {
    renderLiveQueue();

    const panel = screen.getByTestId("ward-community-waiting");
    fireEvent.click(within(panel).getByRole("button", { name: /decline referral/i }));

    const confirmBtn = within(panel).getByRole("button", { name: /confirm decline/i });
    fireEvent.click(confirmBtn);

    // No reason was chosen, so the click is a no-op: the referral is still on the queue, its own
    // decline toggle/panel survive untouched, and its addressing still reads "Queued." — nothing
    // reached the reducer.
    expect(within(panel).getByRole("button", { name: /decline referral/i })).toBeTruthy();
    expect(within(panel).queryByTestId("ward-community-waiting-empty")).toBeNull();
    expect(screen.getByTestId("harness-declined-label").textContent).toBe("Queued.");
  });

  it("choosing a reason and confirming dispatches DECLINE_REFERRAL, and the referral shows as declined with that label", () => {
    renderLiveQueue();

    const panel = screen.getByTestId("ward-community-waiting");
    fireEvent.click(within(panel).getByRole("button", { name: /decline referral/i }));

    const select = within(panel).getByRole("combobox");
    fireEvent.change(select, { target: { value: "outside_the_teams_catchment" } });

    const confirmBtn = within(panel).getByRole("button", { name: /confirm decline/i });
    expect(confirmBtn).not.toHaveAttribute("aria-disabled");
    fireEvent.click(confirmBtn);

    // The dispatch really reached the reducer: the referral has left this team's waiting queue —
    // a `community_team` addressing that is `declined` is no longer awaiting an answer.
    expect(within(panel).queryByRole("button", { name: /decline referral/i })).toBeNull();
    expect(within(panel).getByTestId("ward-community-waiting-empty")).toBeTruthy();
    // ...and its own addressing now reads Declined, labelled from the REAL community vocabulary —
    // never a bed-placement reason recorded against a community refusal (O-16.6).
    expect(screen.getByTestId("harness-declined-label").textContent).toBe(
      "Declined — Outside the team's catchment area.",
    );
  });

  /**
   * RB5 (item 16, 2026-09-17) — "a community team may accept, for follow-up only". Same live
   * harness as the decline proofs above: the seed button raises a fresh referral through the real
   * reducer, so clicking Accept here is a dispatch the reducer can genuinely refuse, not a prop
   * this view was handed.
   */
  it("clicking Accept referral dispatches ACCEPT_REFERRAL, and the referral shows as accepted with that label", () => {
    renderLiveQueue();

    const panel = screen.getByTestId("ward-community-waiting");
    expect(screen.getByTestId("harness-declined-label").textContent).toBe("Queued.");

    fireEvent.click(within(panel).getByRole("button", { name: /accept referral/i }));

    // The dispatch really reached the reducer: the referral has left this team's waiting queue —
    // a `community_team` addressing that is `accepted` is no longer awaiting an answer — and its
    // own addressing now reads Accepted.
    expect(within(panel).queryByRole("button", { name: /accept referral/i })).toBeNull();
    expect(within(panel).queryByRole("button", { name: /decline referral/i })).toBeNull();
    expect(within(panel).getByTestId("ward-community-waiting-empty")).toBeTruthy();
    expect(screen.getByTestId("harness-declined-label").textContent).toBe("Accepted.");
  });
});

describe("the discharged-into-the-area caveat renders above its list, never below", () => {
  it("puts the follow-up notice before the list (or its empty state) in document order", () => {
    const [toTeam] = referralsNaming([ACCEPTED_TEAM.name], "Perth Metropolitan");
    renderTeam(ACCEPTED_TEAM.id, [admission({ id: "AD-A", referralId: toTeam.id, state: "occupied" })], [toTeam]);

    const section = screen.getByTestId("ward-community-discharged");
    const notice = within(section).getByTestId("ward-community-follow-up-not-recorded");
    const emptyOrList =
      within(section).queryByTestId("ward-community-discharged-list") ??
      within(section).getByTestId("ward-community-discharged-empty");

    // DOCUMENT_POSITION_FOLLOWING means the second node comes after the first — i.e. the notice is
    // above the list it qualifies, not read-able-past on the way down to an empty one.
    const relation = notice.compareDocumentPosition(emptyOrList);
    expect(Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING), "the follow-up notice is not above its list").toBe(
      true,
    );
  });
});

describe("the KPI figures state absence in words, never a bare zero rendered as nothing", () => {
  it("says 'None waiting' rather than a bare number when nobody is waiting on this team", () => {
    renderTeam(ACCEPTED_TEAM.id, [], []);

    const longestWaitLabel = screen.getByText("Longest wait");
    const figure = longestWaitLabel.closest('[data-ward-primitive="figure"]');
    expect(figure, "the Longest wait figure tile was not found").toBeTruthy();
    expect(figure?.textContent).toContain("None waiting");
  });
});
