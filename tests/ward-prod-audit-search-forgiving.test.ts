import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { findPatients } from "../src/components/ward-management/ward-patients";

// Audit 24-7 (CT-23): small typing differences on the Patients page no longer find nobody.
describe("findPatients forgives spacing and name order", () => {
  const patients = seedWardFlowState().patients;
  const patient = patients[0]!;
  const ids = (query: string) => findPatients(patients, query).map((found) => found.id);

  it("matches a doubled space between given and family name", () => {
    expect(ids(`${patient.givenName}  ${patient.familyName}`)).toContain(patient.id);
  });

  it("matches a UMRN typed with a space after its letters", () => {
    const spaced = patient.umrn.replace(/^([A-Za-z]+)/, "$1 ");
    expect(spaced).not.toBe(patient.umrn);
    expect(ids(spaced)).toContain(patient.id);
  });

  it("matches 'Family, Given'", () => {
    expect(ids(`${patient.familyName}, ${patient.givenName}`)).toContain(patient.id);
  });
});
