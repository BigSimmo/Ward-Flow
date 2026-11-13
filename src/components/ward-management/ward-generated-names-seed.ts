/**
 * The name lists a generated sample patient (`PT-G-<record id>`) is drawn from, moved out of
 * `ward-patients-seed.ts` so that file stays under the line cap. Synthetic names only.
 */

/** Fixed lists a generated patient's name is drawn from — deliberately a different naming style from
 *  the hand-authored compound surnames in `ward-patients-seed.ts`, so a generated patient is
 *  recognisably from this list rather than a copy of a hand-authored one. Checked against every
 *  hand-authored family name there: none shares a name or a near-miss spelling with that set, so
 *  `nearPatients`/`findPatients` cannot confuse a generated occupant with a named record.
 *
 *  A16-01 (Audit 16, Josh 13 Nov 2026): the given name comes from the list for the person's recorded
 *  sex, and from a neutral list when sex is not recorded. All three lists are the same length, so the
 *  name pairing in `generatedName` stays one to one. */
// Every given name holds an "a", so typing "a" finds every seeded person (the typeahead scroll
// test's invariant, pinned in tests/ward-patient-model.test.ts as WF-PAT-02).
export const GENERATED_GIVEN_NAMES_BY_SEX = {
  Female: [
    "Delia",
    "Fiora",
    "Hazelle",
    "Isadora",
    "Junia",
    "Maren",
    "Petra",
    "Quinta",
    "Reya",
    "Sabine",
    "Tansy",
    "Alma",
    "Beata",
    "Clara",
    "Edina",
    "Freya",
    "Greta",
    "Ilana",
    "Lorna",
    "Nadia",
  ],
  Male: [
    "Alaric",
    "Bramwen",
    "Calder",
    "Eamon",
    "Gareth",
    "Kalan",
    "Nolan",
    "Adrian",
    "Callum",
    "Darian",
    "Ewan",
    "Fabian",
    "Hamish",
    "Isaac",
    "Jonah",
    "Lachlan",
    "Matthias",
    "Oscar",
    "Rafael",
    "Tobias",
  ],
  "Not recorded": [
    "Alex",
    "Ari",
    "Avery",
    "Blair",
    "Casey",
    "Dana",
    "Darcy",
    "Jordan",
    "Kai",
    "Lark",
    "Logan",
    "Morgan",
    "Reagan",
    "Sasha",
    "Shay",
    "Tate",
    "Jamie",
    "Harper",
    "Rowan",
    "Sage",
  ],
} as const;

/** The length of each given-name list, which `generatedName` pairs with the surnames one to one. */
export const GIVEN_NAME_COUNT = 20;

export const GENERATED_FAMILY_NAMES = [
  "Ferrowmoor",
  "Glasswell",
  "Huntmire",
  "Inkstone",
  "Jorrowfen",
  "Kellbourne",
  "Linforth",
  "Moongate",
  "Norrowfield",
  "Oxleyburn",
  "Pallowmere",
  "Quenfold",
  "Ridgeholt",
  "Stonevale",
  "Trelling",
  "Umberleigh",
  "Vosswick",
  "Whistlecombe",
  "Yelmstead",
  "Zelmsworth",
] as const;
