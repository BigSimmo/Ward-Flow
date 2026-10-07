import { describe, expect, it } from "vitest";

import {
  detectSearchIntent,
  searchGroupOrder,
  searchIntentLabel,
  searchWardFlow,
  type SearchIntent,
} from "@/components/ward-management/search/ward-smart-search";
import { searchMovements } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { allUnits } from "@/components/ward-management/ward-sites";

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
      "movements",
      "wards",
      "eds",
      "teams",
      "forms",
      "views",
      "tasks",
    ]);
  });

  it("leads with the intent group, and with the three place groups for a place query", () => {
    expect(searchGroupOrder("person", "Jamie Lee")[0]).toBe("people");
    expect(searchGroupOrder("form", "4C")[0]).toBe("forms");
    expect(searchGroupOrder("view", "capacity")[0]).toBe("views");
    expect(searchGroupOrder("task", "tasks")[0]).toBe("tasks");
    expect(searchGroupOrder("place", "emergency").slice(0, 3)).toEqual(["wards", "eds", "teams"]);
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
    expect(result).not.toHaveProperty("referrals");
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
