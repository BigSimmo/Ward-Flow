/**
 * The header search's non-AI improvements (search review, 19 October 2026): common questions answered
 * from the Patients page's census, queued referrals, near spellings, beds and wards with a ready bed.
 * Every expectation is read off the seeded synthetic world, never a string typed here, so a fixture
 * change moves the queries with it.
 */
import { describe, expect, it } from "vitest";

import { searchHub, hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import {
  answerQuestion,
  nextStepLine,
  normaliseQuestion,
  questionFor,
  whereNowLine,
} from "@/components/ward-management/search/search-answers";
import { isReadyBedQuery, parseBedQuery, wardFactsLine } from "@/components/ward-management/search/search-places";
import { searchWardFlow, unitReadyBedCount } from "@/components/ward-management/search/ward-smart-search";
import { censusRowItem, smartSearchGroups } from "@/components/ward-management/ward-global-search-groups";
import { demoDayZero, dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

const state = seedWardFlowState();
const census = buildCensus({
  ...state,
  now: NOW_ANCHOR,
  thresholds: dueSoonThresholdsOf(state.configuration),
  dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
});

function search(query: string) {
  return searchWardFlow({
    query,
    patients: state.patients,
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    now: NOW_ANCHOR,
    limitPerGroup: 40,
  });
}

describe("common questions", () => {
  it.each([
    ["over 24 hours", "long"],
    ["Who is waiting over 24 hours?", "long"],
    ["long waits", "long"],
    ["no bed yet", "wait"],
    ["unplaced", "wait"],
    ["bed found", "found"],
    ["in transit", "move"],
    ["past expected discharge", "edd"],
    ["delayed discharges", "edd"],
    ["away at ED", "aed"],
    ["Tier 1", "t1"],
    ["on a form", "form"],
    ["Form 1A", "form-1a"],
    ["on form 4c", "form-4c"],
  ])("reads %s as %s", (query, id) => {
    expect(questionFor(query)?.id).toBe(id);
  });

  it("does not read names, partial phrases, legal statuses or unknown forms as questions", () => {
    for (const query of ["Wren", "over", "bed", "voluntary", "involuntary", "Form 9Z", "moving house"]) {
      expect(questionFor(query), query).toBeUndefined();
    }
  });

  it("strips the question's framing but keeps its words", () => {
    expect(normaliseQuestion("  Show me   patients  NO BED YET? ")).toBe("no bed yet");
  });

  it("answers from the census, longest wait first, with only rows the census itself flags", () => {
    const answer = answerQuestion("over 24 hours", census);
    const flagged = census.rows.filter((row) => row.longWait);
    if (flagged.length < 2) throw new Error("fixture drifted: fewer than two long waits, so order is untested");
    expect(answer?.rows.map((row) => row.key).sort()).toEqual(flagged.map((row) => row.key).sort());
    const waits = answer!.rows.map((row) => row.waitMinutes ?? -1);
    expect(waits).toEqual([...waits].sort((left, right) => right - left));
  });

  it("answers a form code with exactly the people on that form", () => {
    const answer = answerQuestion("form 1a", census);
    expect(answer?.question.heading).toBe("On Form 1A");
    expect(answer!.rows.length).toBeGreaterThan(0);
    expect(answer!.rows.every((row) => row.formCode === "1A")).toBe(true);
  });

  it("cuts an answer at the caller's limit like any other group, and still counts every row", () => {
    const full = answerQuestion("no bed yet", census)!;
    if (full.rows.length < 3) throw new Error("fixture drifted: fewer than three people without a bed");
    const cut = answerQuestion("no bed yet", census, 2)!;
    expect(cut.rows.map((row) => row.key)).toEqual(full.rows.slice(0, 2).map((row) => row.key));
    expect(cut.total).toBe(full.rows.length);
  });

  it("gives no answer without a census, so a screen outside the provider shows none", () => {
    expect(answerQuestion("over 24 hours", null)).toBeUndefined();
  });

  it("leads the groups with the answer and does not list its records twice", () => {
    const query = "form 1a";
    const answer = answerQuestion(query, census)!;
    const groups = smartSearchGroups(search(query), query, state.units, state, answer);
    expect(groups[0]).toMatchObject({ key: "answers", heading: "On Form 1A" });
    const answered = new Set(groups[0]!.items.map((item) => item.href));
    for (const group of groups.slice(1)) {
      for (const item of group.items) expect(answered.has(item.href), item.href).toBe(false);
    }
  });
});

describe("the questions the overall review found unanswered (20 Oct 2026)", () => {
  it.each([
    ["transport not booked", "transport-not-booked"],
    ["no transport booked", "transport-not-booked"],
    ["escort", "escort"],
    ["needs an escort", "escort"],
    ["today", "today"],
    ["who is leaving today?", "today"],
    ["on leave", "leave"],
    ["leave", "leave"],
    ["AWOL", "awol"],
    ["absent without leave", "awol"],
  ])("reads %s as %s", (query, id) => {
    expect(questionFor(query)?.id).toBe(id);
  });

  it("filters to exactly the rows the census flags, and never reorders them", () => {
    for (const [query, flagged] of [
      ["transport not booked", (row: (typeof census.rows)[number]) => row.next === "Book transport"],
      ["escort", (row: (typeof census.rows)[number]) => row.escort],
      ["today", (row: (typeof census.rows)[number]) => row.leavingToday === true],
    ] as const) {
      const answer = answerQuestion(query, census)!;
      expect(answer.rows.map((row) => row.key).sort(), query).toEqual(
        census.rows
          .filter(flagged)
          .map((row) => row.key)
          .sort(),
      );
      const waits = answer.rows.map((row) => row.waitMinutes ?? -1);
      expect(waits, query).toEqual([...waits].sort((left, right) => right - left));
    }
  });

  it("answers leave and absence from the leave beds, and not at all without them", () => {
    const stays = state.admissions.filter((admission) => admission.state === "occupied");
    const [onLeave, absent] = [stays[0]!, stays[1]!];
    const leaveBeds = [
      {
        id: "LB-Q1",
        unitId: onLeave.unitId,
        admissionId: onLeave.id,
        expectedReturn: NOW_ANCHOR + 60,
        confirmedAt: NOW_ANCHOR - 30,
        confirmedBy: "Ward",
      },
      {
        id: "LB-Q2",
        unitId: absent.unitId,
        admissionId: absent.id,
        expectedReturn: NOW_ANCHOR + 60,
        confirmedAt: NOW_ANCHOR - 30,
        confirmedBy: "Ward",
        absentWithoutLeave: { since: NOW_ANCHOR - 20, steps: [] },
      },
    ];
    const base = {
      ...state,
      now: NOW_ANCHOR,
      thresholds: dueSoonThresholdsOf(state.configuration),
      dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
    };
    const withLeave = buildCensus({ ...base, leaveBeds });
    const keyOf = (admissionId: string) => `adm:${admissionId}`;
    const leaveKeys = answerQuestion("on leave", withLeave)!.rows.map((row) => row.key);
    const awolKeys = answerQuestion("awol", withLeave)!.rows.map((row) => row.key);
    // Each stay appears on its own list only, if the census shows it as a ward row at all.
    for (const [keys, mine, other] of [
      [leaveKeys, onLeave.id, absent.id],
      [awolKeys, absent.id, onLeave.id],
    ] as const) {
      expect(keys).not.toContain(keyOf(other));
      const shown = withLeave.rows.some((row) => row.key === keyOf(mine));
      expect(keys.includes(keyOf(mine))).toBe(shown);
    }
    expect(leaveKeys.length + awolKeys.length).toBeGreaterThan(0);

    const { leaveBeds: _unused, ...withoutLeaveState } = base;
    void _unused;
    const noLeave = buildCensus(withoutLeaveState);
    expect(answerQuestion("on leave", noLeave)).toBeUndefined();
    expect(answerQuestion("awol", noLeave)).toBeUndefined();
  });
});

describe("where a person is now, and where a result opens", () => {
  it("opens each kind of census row where its record lives", () => {
    for (const row of census.rows.slice(0, 400)) {
      const item = censusRowItem(row);
      if (row.kind === "movement") expect(item.href).toBe(movementHref(row.key));
      if (row.kind === "referral") expect(item.href).toContain("/ward-flow/referrals?referral=");
      if (row.kind === "admission" && row.unitId) expect(item.href).toContain(`/ward-flow/ward/`);
      expect(item.subjectUmrn).toBe(row.umrn);
    }
  });

  it("says where the person is and the next step, and has no step for someone not active", () => {
    const waiting = census.rows.find((row) => row.kind === "movement" && row.group === "wait");
    const inactive = census.rows.find((row) => row.group === "off");
    if (!waiting || !inactive) throw new Error("fixture drifted: no waiting movement or inactive person");
    expect(whereNowLine(waiting)).toContain(waiting.where);
    expect(nextStepLine(waiting)).toContain(waiting.next);
    expect(nextStepLine(inactive)).toBeUndefined();
  });
});

describe("referrals in the header search", () => {
  const queued = state.referrals.filter(
    (referral) => referralState(referral) === "queued" && referral.destinations.some(isAwaitingAnswer),
  );
  const named = queued
    .map((referral) => ({ referral, info: resolveSubjectPatient(referral, state) }))
    .find((entry) => entry.info.patient !== undefined);
  if (!named) throw new Error("fixture drifted: no queued referral with a named patient");

  it("finds a queued referral by its patient's family name and by UMRN", () => {
    for (const query of [named.info.patient!.familyName, named.info.umrn]) {
      expect(
        search(query).referrals.map((result) => result.referral.id),
        query,
      ).toContain(named.referral.id);
    }
  });

  it("never offers a referral that is no longer waiting on an answer", () => {
    const queuedIds = new Set(queued.map((referral) => referral.id));
    for (const referral of state.referrals) {
      for (const result of search(referral.id).referrals) expect(queuedIds.has(result.referral.id)).toBe(true);
    }
  });
});

describe("near spellings", () => {
  const patient = state.patients.find((candidate) => candidate.familyName.length >= 6);
  if (!patient) throw new Error("fixture drifted: no family name of six letters or more");
  const misspelt = patient.familyName.slice(0, 1) + patient.familyName.slice(2);

  // Josh, 31 Oct 2026: no "Did you mean?" names. A typo match on a person risks the wrong patient.
  it("never offers a person for a family name that is missing a letter", () => {
    const results = search(misspelt);
    expect(results.people).toEqual([]);
    expect(results).not.toHaveProperty("similarPeople");
  });
});

describe("beds and ready beds", () => {
  const ward = state.units.find((unit) => unit.beds >= 4);
  if (!ward) throw new Error("fixture drifted: no ward with four beds");

  it("reads a bed question only when it names a ward", () => {
    expect(parseBedQuery(`${ward.name} bed 4`)).toEqual({ wardText: ward.name.toLowerCase(), bedNumber: 4 });
    expect(parseBedQuery("who is in bed 4")).toBeUndefined();
    expect(parseBedQuery("bed 4")).toBeUndefined();
  });

  it("opens the named bed on the ward screen, and never a bed the ward does not have", () => {
    const beds = search(`${ward.name} bed 4`).beds;
    expect(beds.map((bed) => bed.href)).toContain(`/ward-flow/ward/${encodeURIComponent(ward.id)}?bed=4`);
    expect(search(`${ward.name} bed ${ward.beds + 1}`).beds.filter((bed) => bed.unit.id === ward.id)).toEqual([]);
  });

  it("lists exactly the wards with a recorded ready bed for 'free beds'", () => {
    expect(isReadyBedQuery("free beds")).toBe(true);
    expect(isReadyBedQuery("beds available")).toBe(true);
    expect(isReadyBedQuery("bed")).toBe(false);
    const results = search("free beds");
    expect(results.readyBedsOnly).toBe(true);
    const expected = state.units.filter((unit) => (unitReadyBedCount(unit) ?? 0) > 0).map((unit) => unit.id);
    if (expected.length === 0) throw new Error("fixture drifted: no ward has a ready bed");
    expect(results.wards.map((result) => result.unit.id)).toEqual(expected.slice(0, 40));
  });

  it("states locked beds and a sex designation only when recorded", () => {
    expect(wardFactsLine({ beds: 20, lockedBeds: 0, sexDesignation: "Undesignated" })).toBe("");
    expect(wardFactsLine({ beds: 20, lockedBeds: 6, sexDesignation: "Female only" })).toBe("6 locked · Female only");
    expect(wardFactsLine({ beds: 6, lockedBeds: 6, sexDesignation: "Undesignated" })).toBe("all beds locked");
  });
});

describe("screens and places", () => {
  it("finds On-call when 'on call' is typed with a space", () => {
    expect(search("on call").views.map((view) => view.view.key)).toContain("on-call");
  });

  it("matches every typed word on the Places page, in any order", () => {
    const entries = hubEntries({ units: state.units, bedReleases: [], now: NOW_ANCHOR, sites: wardSites });
    const entry = entries.find((candidate) => candidate.kind === "ward" && candidate.site);
    if (!entry?.site) throw new Error("fixture drifted: no ward entry with a site");
    const firstWord = entry.name.split(/\s+/)[0]!.toLowerCase();
    const siteWord = entry.site.split(/\s+/)[0]!.toLowerCase();
    const found = searchHub(entries, `${siteWord} ${firstWord}`, "all");
    expect(found.map((candidate) => candidate.id)).toContain(entry.id);
  });
});
