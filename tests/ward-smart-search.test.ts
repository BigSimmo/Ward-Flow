import { describe, expect, it } from "vitest";

import {
  detectSearchIntent,
  normaliseCommaNameQuery,
  searchGroupOrder,
  searchIntentLabel,
  searchWardFlow,
  type SearchIntent,
} from "@/components/ward-management/search/ward-smart-search";
import { buildActionInbox, isOpen, searchMovements } from "@/components/ward-management/ward-derivations";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { SELECTABLE_LEGAL_FORMS, legalFormName } from "@/components/ward-management/ward-legal-forms";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const units = allUnits();

describe("detectSearchIntent", () => {
  it.each([
    ["Jamie Lee", "person"],
    ["O'Neil", "person"],
    ["Anne-Marie", "person"],
    ["PT-001", "identifier"],
    ["wf-12", "identifier"],
    ["UM100001", "identifier"],
    ["100001", "identifier"],
    ["ward", "place"],
    ["wards", "place"],
    ["ed", "place"],
    ["emergency", "place"],
    ["community", "place"],
    ["teams", "place"],
    ["Fiona Stanley", "place"],
    ["SCGH", "place"],
    ["form", "form"],
    ["legal", "form"],
    ["4C", "form"],
    ["1A", "form"],
    ["delay", "view"],
    ["delays", "view"],
    ["movements", "view"],
    ["capacity", "view"],
    ["command", "view"],
    ["network", "view"],
    ["transport", "view"],
    ["horizon", "view"],
    ["governance", "view"],
    ["task", "task"],
    ["tasks", "task"],
    ["zzq-9", "general"],
    ["", "general"],
  ] as const)("%s → %s", (query, intent) => {
    expect(detectSearchIntent(query)).toBe(intent);
  });
});

describe("searchIntentLabel", () => {
  it("names each intent, and splits identifiers by prefix", () => {
    expect(searchIntentLabel("person", "Jamie Lee")).toBe("People");
    expect(searchIntentLabel("identifier", "WF-001")).toBe("Movements");
    expect(searchIntentLabel("identifier", "wf-001")).toBe("Movements");
    expect(searchIntentLabel("identifier", "PT-001")).toBe("People");
    expect(searchIntentLabel("identifier", "100001")).toBe("People");
    expect(searchIntentLabel("place", "ward")).toBe("Places");
    expect(searchIntentLabel("form", "4C")).toBe("Forms");
    expect(searchIntentLabel("view", "capacity")).toBe("Views");
    expect(searchIntentLabel("task", "tasks")).toBe("Tasks");
    expect(searchIntentLabel("general", "??")).toBe("All");
  });
});

describe("searchGroupOrder", () => {
  it("keeps the fixed order for a general query", () => {
    expect(searchGroupOrder("general", "??")).toEqual([
      "people",
      "similar",
      "movements",
      "referrals",
      "beds",
      "wards",
      "eds",
      "teams",
      "suburbs",
      "forms",
      "views",
      "tasks",
      "contacts",
      "help",
    ]);
  });

  it("leads with Help for a how, where, why or what question", () => {
    expect(searchGroupOrder("general", "how do I pull a bed")[0]).toBe("help");
    expect(searchGroupOrder("person", "Howard")[0]).toBe("people");
  });

  it("leads with the intent group, and with the three place groups for a place query", () => {
    expect(searchGroupOrder("person", "Jamie Lee").slice(0, 2)).toEqual(["people", "similar"]);
    expect(searchGroupOrder("form", "4C")[0]).toBe("forms");
    expect(searchGroupOrder("view", "capacity")[0]).toBe("views");
    expect(searchGroupOrder("task", "tasks")[0]).toBe("tasks");
    expect(searchGroupOrder("place", "emergency").slice(0, 4)).toEqual(["beds", "wards", "eds", "teams"]);
  });

  it("puts movements ahead of people only for a WF- identifier", () => {
    expect(searchGroupOrder("identifier", "WF-001").slice(0, 2)).toEqual(["movements", "people"]);
    expect(searchGroupOrder("identifier", "PT-001").slice(0, 2)).toEqual(["people", "movements"]);
    expect(searchGroupOrder("identifier", "100001").slice(0, 2)).toEqual(["people", "movements"]);
  });
});

describe("searchWardFlow ranking", () => {
  const patients: Patient[] = [
    {
      id: "PT-B",
      umrn: "UM900002",
      givenName: "Joanna",
      familyName: "Banner",
      dateOfBirth: "1990-01-01",
    },
    {
      id: "PT-A",
      umrn: "UM900001",
      givenName: "Ann",
      familyName: "Able",
      dateOfBirth: "1991-01-01",
    },
  ];

  it("lists a word-start name before a match buried inside a word", () => {
    const result = searchWardFlow({ query: "ann", patients, movements: [], units: [] });
    expect(result.intent).toBe<SearchIntent>("person");
    expect(result.people.map((patient) => patient.id)).toEqual(["PT-A", "PT-B"]);
    // With no referrals supplied there are none to find (referrals are covered by their own suite).
    expect(result.referrals).toEqual([]);
  });

  it("uses the same accent folding for relevance as for matching", () => {
    const result = searchWardFlow({
      query: "eva",
      patients: [
        { ...patients[0], givenName: "XÉva" },
        { ...patients[1], givenName: "Éva" },
      ],
      movements: [],
      units: [],
    });
    expect(result.people.map((patient) => patient.id)).toEqual(["PT-A", "PT-B"]);
  });

  it("caps each group at 6 and keeps word-start name matches inside that cap", () => {
    const wordStart = wardPatients.filter((patient) =>
      `${patient.givenName} ${patient.familyName}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((word) => word.startsWith("a")),
    );
    expect(wordStart.length).toBeGreaterThan(6);

    const found = searchWardFlow({
      query: "a",
      patients: wardPatients,
      movements: wardMovements,
      units,
    });
    expect(found.people).toHaveLength(6);
    for (const patient of found.people) {
      const words = `${patient.givenName} ${patient.familyName}`.toLowerCase().split(/[^a-z0-9]+/);
      expect(words.some((word) => word.startsWith("a"))).toBe(true);
    }
  });
});

describe("words across the supplied record's fields", () => {
  const search = (query: string) => searchWardFlow({ query, patients: [], movements: [], units });

  it("finds wards by site and name in either order, with optional kind wording", () => {
    for (const query of ["SCGH mental", "mental SCGH", "ward SCGH mental", "  SCGH   mental  "]) {
      const result = search(query);
      expect(result.wards.map(({ unit }) => unit.id)).toContain("scgh-adult-open");
      expect(result.wards.every(({ unit }) => unit.siteCode === "SCGH")).toBe(true);
      expect(result.people).toEqual([]);
    }
    expect(search("SCGH mental zzz-no-match").wards).toEqual([]);
  });

  it("finds an ED using its kind and site code without requiring a literal ED abbreviation", () => {
    const result = search("ed SCGH");
    expect(result.emergencyDepartments.length).toBeGreaterThan(0);
    expect(result.emergencyDepartments.every(({ ed }) => ed.siteCode === "SCGH")).toBe(true);
  });

  it("finds a team using reordered name words and its kind", () => {
    const team = COMMUNITY_TEAM_PAGES.find((candidate) => candidate.name.trim().split(/\s+/).length >= 2)!;
    expect(team).toBeDefined();
    const words = team.name.trim().split(/\s+/);
    const query = `team ${words[1]} ${words[0]}`;
    expect(search(query).communityTeams.map(({ team }) => team.id)).toContain(team.id);
    expect(search(`${query} zzz-no-match`).communityTeams).toEqual([]);
  });

  it("requires every page keyword and form-title word rather than accepting a partial query", () => {
    expect(search("notes shift").views.map(({ view }) => view.key)).toContain("handover");
    expect(search("notes shift zzz-no-match").views).toEqual([]);
    const form = SELECTABLE_LEGAL_FORMS[0];
    const word = legalFormName(form)
      .split(/\s+/)
      .find((word) => /^[a-z]{4,}$/i.test(word))!;
    expect(word).toBeDefined();
    const query = `form ${form.code} ${word}`;
    expect(search(query).legalForms.map(({ form }) => form.code)).toContain(form.code);
    expect(search(`${query} zzz-no-match`).legalForms).toEqual([]);
  });

  it("finds task words across title and detail without deriving any new task", () => {
    const existing = buildActionInbox(wardMovements.filter(isOpen), NOW_ANCHOR, units)[0];
    expect(existing).toBeDefined();
    const task = { ...existing, title: "Transport awaiting departure", detail: "Synthetic pickup booked" };
    const input = { patients: [], movements: [], units, precomputedTasks: [task] };
    expect(searchWardFlow({ ...input, query: "transport pickup" }).tasks.map(({ task }) => task.id)).toEqual([task.id]);
    expect(searchWardFlow({ ...input, query: "transport zzz-no-match" }).tasks).toEqual([]);
  });
});

describe("movement display names", () => {
  const movement = wardMovements.find((item) => item.id === "WF-001");
  if (!movement?.patientId) throw new Error("fixture drifted: WF-001 has no patient id");
  const patient = wardPatients.find((item) => item.id === movement.patientId);
  if (!patient) throw new Error("fixture drifted: WF-001 patient is missing");
  const name = patientDisplayName(patient);

  it("leaves movement matching unchanged when no names are passed", () => {
    const found = searchMovements(wardMovements, units, { text: name });
    expect(found.some((item) => item.id === movement.id)).toBe(false);
  });

  it("matches the open movement when that display name is supplied", () => {
    const found = searchMovements(wardMovements, units, {
      text: name,
      patientDisplayNames: { [movement.id]: name },
    });
    expect(found.some((item) => item.id === movement.id)).toBe(true);
  });

  it("searchWardFlow uses the linked display name", () => {
    const found = searchWardFlow({
      query: name,
      patients: wardPatients,
      movements: wardMovements,
      units,
    });
    expect(found.intent).toBe("person");
    expect(found.movements.some((item) => item.id === movement.id)).toBe(true);
    expect(found.people.some((item) => item.id === patient.id)).toBe(true);
  });
});

/**
 * L5 (site review, 12 Oct 2026): "Wren" or his UMRN found Tobias Wren but not his open movement,
 * which is linked to him through its referral. Every open movement is indexed by its patient's
 * name and UMRN.
 */
describe("smart search finds a person's open movement by name and UMRN", () => {
  it("finds Tobias Wren's movement by family name and by UMRN", () => {
    const state = seedWardFlowState();
    const wren = state.patients.find((patient) => patient.familyName === "Wren");
    expect(wren, "the seed must hold Tobias Wren").toBeDefined();
    const open = state.movements.filter(isOpen);
    for (const query of ["Wren", wren!.umrn]) {
      const results = searchWardFlow({
        query,
        patients: state.patients,
        movements: state.movements,
        units: state.units,
        referrals: state.referrals,
        now: NOW_ANCHOR,
      });
      expect(
        results.people.map((patient) => patient.id),
        query,
      ).toContain(wren!.id);
      expect(results.movements.length, `${query} finds no open movement`).toBeGreaterThan(0);
      expect(results.movements.every((movement) => open.includes(movement))).toBe(true);
    }
  });
});

describe("a name typed the way lists print it (audit round 2, S-33)", () => {
  it("reads 'Surname, Given' as 'Given Surname' and leaves digit queries alone", () => {
    expect(normaliseCommaNameQuery("Pallowmere, Orla")).toBe("Orla Pallowmere");
    expect(normaliseCommaNameQuery(" Pallowmere,")).toBe("Pallowmere");
    expect(normaliseCommaNameQuery("12/03/1990, x")).toBe("12/03/1990, x");
    expect(normaliseCommaNameQuery("Orla Pallowmere")).toBe("Orla Pallowmere");
  });

  it("finds a seeded person from the comma form", () => {
    const person = wardPatients[0];
    const result = searchWardFlow({
      query: `${person.familyName}, ${person.givenName}`,
      patients: wardPatients,
      movements: [],
      units: [],
    });
    expect(result.people.map((patient) => patient.id)).toContain(person.id);
  });

  it("keeps a comma query as typed for wards, so it is not reordered like a name", () => {
    // A synthetic two-word ward name; the old rewrite turned "Beta, Alpha" into "Alpha Beta".
    const unit = { ...units[0], name: "Alpha Beta" };
    const wardsFor = (query: string) =>
      searchWardFlow({ query, patients: [], movements: [], units: [unit] }).wards.map((ward) => ward.unit.id);
    expect(wardsFor("Beta, Alpha")).not.toContain(unit.id);
    expect(wardsFor("Alpha Beta")).toContain(unit.id);
  });
});

describe("search result truncation", () => {
  it.each([40, 41, 55])("distinguishes %i matches from the returned limit of 40", (count) => {
    const patients: Patient[] = Array.from({ length: count }, (_, index) => ({
      id: `PT-LIMIT-${index}`,
      umrn: `UM9${index.toString().padStart(5, "0")}`,
      givenName: "Synthetic",
      familyName: `Limit${index}`,
      dateOfBirth: "1990-01-01",
    }));
    const results = searchWardFlow({ query: "Synthetic", patients, movements: [], units: [], limitPerGroup: 40 });
    expect(results.people).toHaveLength(40);
    expect(results.truncatedGroups.includes("people")).toBe(count > 40);
  });
});
