import { describe, expect, it } from "vitest";
import { csvCell } from "@/components/ward-management/statistics/statistics-csv";
import { ED_EXPORT_HEADER, edExportLines } from "@/components/ward-management/ed/ed-export";
import { DELAYS_EXPORT_HEADER, delaysExportLines } from "@/components/ward-management/delays/delays-export";
import {
  DISCHARGE_RECORD_EXPORT_HEADER,
  DISCHARGE_RELEASE_EXPORT_HEADER,
  dischargeRecordExportLines,
  dischargeReleaseExportLines,
} from "@/components/ward-management/discharges/discharge-export";
import { REFERRAL_EXPORT_HEADER, referralExportLines } from "@/components/ward-management/referrals/referral-export";
import { CENSUS_EXPORT_HEADER, censusExportLines } from "@/components/ward-management/search/census-export";

// Feature 44: list exports carry record numbers, places, times and labels, never names. Every
// fixture below is synthetic and carries a name the output must not repeat.
const NAME = { givenName: "Synthia", familyName: "Testperson" };
const at = (instant: number) => `T+${instant}`;
const asCsv = (lines: readonly (readonly (string | number)[])[]) =>
  lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
const expectNoName = (lines: readonly (readonly (string | number)[])[]) => {
  const text = asCsv(lines);
  expect(text).not.toContain(NAME.givenName);
  expect(text).not.toContain(NAME.familyName);
};

describe("ED handover export", () => {
  const movement = {
    id: "WF-1" as const,
    openedAt: 100,
    urgency: 2 as const,
    legalStatus: "Voluntary" as const,
    legalForm: undefined,
    ...NAME,
  };
  const lines = edExportLines([movement], {
    department: "Synthetic ED",
    umrnOf: () => "UM000001",
    bayOf: () => "Bay 03",
    stageOf: () => "Coordinator finding a ward",
    minutesOf: () => 125,
    at,
  });
  it("has a header row and one row per person, without names", () => {
    expect(lines[0]).toEqual([...ED_EXPORT_HEADER]);
    expect(lines[1]).toEqual([
      "WF-1",
      "UM000001",
      "Synthetic ED",
      "Bay 03",
      "T+100",
      "2h 05m",
      2,
      "Voluntary",
      "None",
      "Coordinator finding a ward",
    ]);
    expectNoName(lines);
  });
  it("guards a formula-like label", () => {
    const guarded = edExportLines([movement], {
      department: "=HYPERLINK(1)",
      umrnOf: () => "UM000001",
      bayOf: () => "Bay 03",
      stageOf: () => "x",
      minutesOf: () => 0,
      at,
    });
    expect(asCsv(guarded)).toContain(`"'=HYPERLINK(1)"`);
  });
});

describe("Waiting export", () => {
  const row = {
    movement: {
      id: "WF-2" as const,
      originEdId: "ed-1",
      legalStatus: "Involuntary inpatient" as const,
      urgency: 1 as const,
    },
    cause: "no_eligible_bed" as const,
    owner: "wards" as const,
    waited: 600,
    sinceReferral: undefined,
    quiet: 30,
    locked: true,
    origin: "North Metro" as const,
    name: `${NAME.givenName} ${NAME.familyName}`,
  };
  const lines = delaysExportLines([row], {
    umrnOf: () => "UM000002",
    edName: () => "+Synthetic ED",
    serviceName: () => "North Metro",
    causeTitle: () => "No suitable bed",
    ownerName: () => "Wards",
    legalTime: () => "Ended Mon 09:15 as typed",
  });
  it("has a header row, waits and legal time, without names", () => {
    expect(lines[0]).toEqual([...DELAYS_EXPORT_HEADER]);
    expect(lines[1]).toEqual([
      "WF-2",
      "UM000002",
      "+Synthetic ED",
      "North Metro",
      "No suitable bed",
      "Wards",
      "10h 00m",
      "Not recorded",
      "30m",
      1,
      "Involuntary inpatient",
      "Ended Mon 09:15 as typed",
      "Yes",
    ]);
    expectNoName(lines);
    expect(asCsv(lines)).toContain(`"'+Synthetic ED"`);
  });
});

describe("Discharges export", () => {
  it("lists releases with fixed-list hold-ups, without names", () => {
    const lines = dischargeReleaseExportLines(
      [
        {
          id: "BR-1",
          admissionId: "ADM-1",
          unitId: "u-1",
          expectedAt: 900,
          blocker: null,
          waitingOn: "Awaiting ward round" as const,
          ...NAME,
        },
      ],
      { umrnOf: () => "UM000003", wardName: () => "Synthetic ward", statusOf: () => "Expected", at },
    );
    expect(lines[0]).toEqual([...DISCHARGE_RELEASE_EXPORT_HEADER]);
    expect(lines[1]).toEqual(["ADM-1", "UM000003", "Synthetic ward", "Expected", "T+900", "", "Awaiting ward round"]);
    expectNoName(lines);
  });
  it("lists recorded discharges with the linked UMRN only, without names", () => {
    const lines = dischargeRecordExportLines(
      [
        {
          admissionId: "ADM-2",
          unitId: "u-1",
          leftAt: 1000,
          identity: { kind: "linked", patient: { id: "PT-1" as const, umrn: "UM000004", ...NAME } },
        },
        { admissionId: "ADM-3", unitId: "u-1", leftAt: null, identity: { kind: "unresolved-link" } },
      ],
      {
        wardName: () => "@Synthetic ward",
        destinationOf: () => "Home",
        followUpOf: () => "not_arranged",
        at,
      },
    );
    expect(lines[0]).toEqual([...DISCHARGE_RECORD_EXPORT_HEADER]);
    expect(lines[1]).toEqual(["ADM-2", "UM000004", "@Synthetic ward", "T+1000", "Home", "Not arranged"]);
    expect(lines[2]?.[1]).toBe("UMRN not recorded");
    expect(lines[2]?.[3]).toBe("Not recorded");
    expectNoName(lines);
    expect(asCsv(lines)).toContain(`"'@Synthetic ward"`);
  });
});

describe("Referral queue export", () => {
  it("lists the queue with needs as fixed words, without names", () => {
    const lines = referralExportLines([{ id: "RF-1", raisedAt: 60, ...NAME }], {
      now: 180,
      umrnOf: () => "UM000005",
      tierOf: () => "Tier 1 · Urgent",
      priorityOf: () => "Overdue",
      fromOf: () => "-Synthetic hospital",
      needsOf: () => ["Locked bed", "Transport"],
      at,
    });
    expect(lines[0]).toEqual([...REFERRAL_EXPORT_HEADER]);
    expect(lines[1]).toEqual([
      "RF-1",
      "UM000005",
      "Tier 1 · Urgent",
      "Overdue",
      "T+60",
      "2h 00m",
      "-Synthetic hospital",
      "Locked bed; Transport",
    ]);
    expectNoName(lines);
    expect(asCsv(lines)).toContain(`"'-Synthetic hospital"`);
  });
});

describe("Patient list export", () => {
  it("lists the census rows by record and UMRN, without names or dates of birth", () => {
    const row = {
      key: "ADM-9",
      umrn: "UM000006",
      group: "ward" as const,
      unitId: "u-1",
      bedNumber: 4,
      tier: null,
      where: "Synthetic ward",
      legal: "=Voluntary",
      formCode: null,
      waitMinutes: null,
      name: `${NAME.familyName}, ${NAME.givenName}`,
      dob: "1990-01-01",
      searchText: "testperson synthia um000006",
    };
    const lines = censusExportLines([row], { wardName: () => "Synthetic ward" });
    expect(lines[0]).toEqual([...CENSUS_EXPORT_HEADER]);
    expect(lines[1]?.[0]).toBe("ADM-9");
    expect(lines[1]?.[1]).toBe("UM000006");
    expect(lines[1]?.[5]).toBe(4);
    expectNoName(lines);
    expect(asCsv(lines)).not.toContain("1990-01-01");
    expect(asCsv(lines)).toContain('"Recorded (see Ward Flow)"');
  });
});

describe("census legal column", () => {
  it("writes only short known labels, never typed intake text", async () => {
    const { exportLegal } = await import("@/components/ward-management/search/census-export");
    expect(exportLegal("Form 1A")).toBe("Form 1A");
    expect(exportLegal("Voluntary")).toBe("Voluntary");
    expect(exportLegal("Brought in by police, Mr Smith said")).toBe("Recorded (see Ward Flow)");
  });
});
