// PR 2 fix round, worker S (13 Nov 2026): counts, figures and clocks.
//   F-35 (RC 2.5)  one duration formatter that handles the sign; a future start never reads "0m".
//   F-32 (RC 3.2)  each ED wait step's label says where the step starts.
//   F-113 (RC 2.6) one date-of-birth bound for the form and the engine; Midland dates follow the board day.
//   F-27 (A9-26, A9-30, RC 3.7) Weekly measure 3, the ward desk's "to answer" count, the ED alert count.
import { describe, expect, it } from "vitest";

import { alertChecks } from "@/components/ward-management/alerts/alerts-checks";
import {
  MIDLAND_AUTHORED_DAY,
  midlandBoardDay,
  rebaseMidlandText,
} from "@/components/ward-management/community/team-2026/midland-dates";
import { dur } from "@/components/ward-management/patients/patient-now-records";
import { wardDeskAnswerCount, wardOffersOutsideQueue } from "@/components/ward-management/referrals/home-ward-offers";
import { pilotMeasures } from "@/components/ward-management/reports/pilot-measures";
import {
  FUTURE_START_TEXT,
  MINUTES_PER_DAY,
  formatElapsed,
  formatSince,
  perthIsoDay,
  perthMidnight,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { edWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isLongWait } from "@/components/ward-management/ward-operational-defaults";
import { dateOfBirthProblem, latestDateOfBirth } from "@/components/ward-management/ward-patient-registration-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("F-35: one duration formatter, signed, and a future start said in words", () => {
  it("prints minus 90 minutes as -1h 30m, never -30m", () => {
    expect(splitDuration(-90)).toBe("-1h 30m");
    expect(splitDuration(-5)).toBe("-5m");
    expect(splitDuration(-(MINUTES_PER_DAY + 120))).toBe("-1d 2h");
    expect(splitDuration(-0.2)).toBe("0m");
  });

  it("says a start in the future instead of a zero wait", () => {
    expect(formatElapsed(-1)).toBe(FUTURE_START_TEXT);
    expect(formatElapsed(0)).toBe("0m waiting");
    expect(formatSince(NOW_ANCHOR + 30, NOW_ANCHOR)).toBe(FUTURE_START_TEXT);
    expect(formatSince(NOW_ANCHOR - 365, NOW_ANCHOR)).toBe("6h 05m");
  });

  it("gives the patient page the same format as every other screen (6h 05m, not 6h 5m)", () => {
    expect(dur(365)).toBe(splitDuration(365));
    expect(dur(365)).toBe("6h 05m");
  });
});

describe("F-32: each ED wait step starts at its threshold, and its label says so", () => {
  const thresholds = [
    [1, CLINICAL_VALUES.edElevatedPressure.value],
    [2, CLINICAL_VALUES.edSeverePressure.value],
    [3, CLINICAL_VALUES.longWait.value],
    [4, CLINICAL_VALUES.veryLongWait.value],
  ] as const;

  it.each(thresholds)("step %i: one minute before is the step below; the threshold minute is this step", (step, at) => {
    expect(edWaitStep(at - 1)?.step).toBe(step === 1 ? undefined : step - 1);
    expect(edWaitStep(at)?.step).toBe(step);
    const hours = at / 60;
    // "from", never "over": the step includes its threshold minute (Josh 11 Nov 2026, one boundary).
    expect(edWaitStep(at)?.label).toBe(`Step ${step}, from ${hours} ${hours === 1 ? "hour" : "hours"}`);
    expect(edWaitStep(at)?.label).not.toMatch(/\bover\b/u);
  });

  it("starts Step 3 in the same minute as the shared long-wait flag", () => {
    const long = CLINICAL_VALUES.longWait.value;
    expect(isLongWait(long)).toBe(true);
    expect(edWaitStep(long)?.step).toBe(3);
  });
});

describe("F-113: one date-of-birth bound for the form and the engine", () => {
  // 13 Nov 2026, 10:00 Perth (02:00 UTC).
  const realToday = new Date(Date.UTC(2026, 10, 13, 2, 0));

  it("is the earlier of the demo day and the real Perth day", () => {
    expect(perthIsoDay(realToday)).toBe("2026-11-13");
    // Demo clock stepped past midnight: the board says the 14th, the engine still refuses the 14th.
    expect(latestDateOfBirth(realToday, "2026-11-14")).toBe("2026-11-13");
    expect(latestDateOfBirth(realToday, "2026-11-10")).toBe("2026-11-10");
    expect(latestDateOfBirth(realToday, "not a day")).toBe("2026-11-13");
  });

  it("refuses exactly the dates after that bound, so the form's check and the engine's agree", () => {
    const bound = latestDateOfBirth(realToday, "2026-11-14");
    expect(dateOfBirthProblem(bound, realToday, "2026-11-14")).toBeUndefined();
    expect(dateOfBirthProblem("2026-11-14", realToday, "2026-11-14")).toBe(
      "ADD_PATIENT date of birth is in the future",
    );
  });
});

describe("F-113: the Midland dates follow the board's own day past midnight", () => {
  const dayZero = perthMidnight(2026, 10, 9);

  it("keeps day 0 as day 0, and moves a day when the board passes midnight", () => {
    expect(midlandBoardDay(dayZero, NOW_ANCHOR)).toBe(dayZero);
    const nextDay = midlandBoardDay(dayZero, MINUTES_PER_DAY + 30);
    expect(perthIsoDay(nextDay)).toBe("2026-11-10");
  });

  it("writes the authored day as the board's day", () => {
    // The mock-up was written against Mon 2 Nov; "Mon 2 Nov" is "today" on the board.
    expect(rebaseMidlandText("Mon 2 Nov", midlandBoardDay(dayZero, NOW_ANCHOR))).toBe("Mon 9 Nov");
    expect(rebaseMidlandText("Mon 2 Nov", midlandBoardDay(dayZero, MINUTES_PER_DAY + 30))).toBe("Tue 10 Nov");
    expect(rebaseMidlandText("Mon 2 Nov", MIDLAND_AUTHORED_DAY)).toBe("Mon 2 Nov");
  });
});

describe("F-27 (A9-26): Weekly's bed figures on time read the wards' own confirmations", () => {
  const state = seedWardFlowState();
  const week = { offset: -1, start: 0, end: 7 * MINUTES_PER_DAY, countedEnd: NOW_ANCHOR };
  const run = (rollups: Record<string, { confirmedAt: number }>, units = state.units) =>
    pilotMeasures(
      {
        movements: state.movements,
        referrals: state.referrals,
        patients: state.patients,
        now: NOW_ANCHOR,
        pullHoldMinutes: state.configuration.pullHoldMinutes,
        units,
        morningRollupConfirmations: rollups,
        morningRollupDeadlineMinutes: state.configuration.morningRollupDeadlineMinutes,
      },
      week,
    ).bedFigures;

  it("counts a ward's count confirmation today when no roll-up is recorded (the demo day starts with none)", () => {
    expect(state.morningRollupConfirmations).toEqual({});
    const today = state.units.filter((unit) => Math.floor(unit.allocatable.confirmedAt / MINUTES_PER_DAY) === 0);
    const figures = run({});
    expect(figures.wards).toBe(state.units.length);
    expect(figures.confirmedToday).toBe(today.length);
    expect(figures.confirmedToday).toBeGreaterThan(0);
  });

  it("still lets a recorded roll-up win over a later count refresh", () => {
    const unit = { ...state.units[0]!, allocatable: { ...state.units[0]!.allocatable, confirmedAt: NOW_ANCHOR } };
    const late = run({}, [unit]);
    const onTime = run({ [unit.id]: { confirmedAt: 8 * 60 } }, [unit]);
    expect(late).toMatchObject({ confirmedToday: 1, onTime: 0 });
    expect(onTime).toMatchObject({ confirmedToday: 1, onTime: 1 });
  });
});

describe("F-27 (A9-30): a ward desk's one count of what it has to answer", () => {
  it("adds the beds offered straight to the ward to its queued referrals", () => {
    const state = seedWardFlowState();
    const offers = wardOffersOutsideQueue(state.movements, state.referrals);
    expect(offers.length).toBeGreaterThan(0);
    expect(wardDeskAnswerCount(0, state.movements, state.referrals)).toBe(offers.length);
    expect(wardDeskAnswerCount(2, state.movements, state.referrals)).toBe(offers.length + 2);
    expect(wardDeskAnswerCount(0, [], state.referrals)).toBe(0);
  });
});

describe("F-27 (RC 3.7): the 'ED over a day' alert counts the people Waiting lists", () => {
  it("leaves out a journey in transit, so the count matches the list it opens", () => {
    const state = seedWardFlowState();
    const open = state.movements.filter((movement) => !movement.closure);
    const now = NOW_ANCHOR + 3 * MINUTES_PER_DAY;
    const ed = alertChecks({
      allInbox: [],
      openMovements: open,
      referrals: state.referrals,
      movements: state.movements,
      now,
    }).find((check) => check.key === "ed")!;
    const listed = open.filter((movement) => isWaitingInEd(movement) && isLongWait(now - movement.openedAt));
    const inTransit = open.filter(
      (movement) =>
        movement.originEdId !== undefined && !isWaitingInEd(movement) && isLongWait(now - movement.openedAt),
    );
    expect(inTransit.length).toBeGreaterThan(0);
    expect(ed.n).toBe(listed.length);
  });
});
