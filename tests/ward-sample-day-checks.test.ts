import { describe, expect, it } from "vitest";

import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";
import { bedIsOccupied, stayDayNumber, type Admission } from "@/components/ward-management/ward-admissions";
import { holdUpReasonFits } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY, dayOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { formRecordedEnded } from "@/components/ward-management/ward-legal-form-ended";
import { currentLegalPosition, legalFormNowWords } from "@/components/ward-management/ward-legal-form-progression";
import type { Movement } from "@/components/ward-management/ward-model";
import { OBSERVATION_LEVELS, OBSERVATION_NOT_RECORDED } from "@/components/ward-management/ward-observation";
import { travelBand } from "@/components/ward-management/ward-distance";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals-out-of-area";
import { WARD_SCENARIOS, type WardScenario } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ALL_STAFF } from "@/components/ward-management/ward-staff-names-seed";
import { CHECKED_TRAVEL_BANDS } from "@/components/ward-management/ward-travel-bands";

/**
 * F-88, the sample-day check suite (D-175 item 1: "A sample-day check suite guards the seed"; Audit 16
 * question 13; root-cause review 6.4). Part 1 of 2: the records themselves. Every invariant runs over
 * the WHOLE built day (every ward, stay, journey and referral) of every scenario, so a generator that
 * stops reading true fails here, by record id. Under D-174 item 1 a failure is a fault in the
 * generator or rule that built the record, never a record to hand-edit. Each rule cites the ruling
 * that makes it a rule; none sets or proposes a clinical value. Synthetic data only.
 *
 * Part 2 (`ward-sample-day-checks-figures.test.ts`) checks that the screens' figures agree.
 */

const NOW = NOW_ANCHOR;

type Built = { label: string; state: WardFlowState };

/** Every built day: each scenario, plus the Standard day with the worked examples on (A16-14). */
const DAYS: readonly Built[] = [
  ...WARD_SCENARIOS.map((scenario: WardScenario) => ({ label: scenario, state: seedWardFlowState(scenario) })),
  { label: "standard + worked examples", state: seedWardFlowState("standard", { workedExamples: true }) },
];

/** Run one rule over every built day and collect the record ids that break it, per day. */
function breaches(rule: (state: WardFlowState) => string[]): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const day of DAYS) {
    const ids = rule(day.state);
    if (ids.length > 0) found[day.label] = ids;
  }
  return found;
}

const isLive = (admission: Admission) => admission.state === "occupied" || admission.state === "pulled";
const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** `a` is at or before `b` when both are recorded. A missing time is not an order fault. */
function outOfOrder(a: number | null | undefined, b: number | null | undefined): boolean {
  return finite(a) && finite(b) && a > b;
}

describe("F-88 beds and stays", () => {
  // A16-13 (D-175 item 1) and R-B-05: a bed holds one stay. Each ward seats every live stay in its own
  // numbered bed, inside the ward's beds, through the same seating the bed board draws from.
  it("seats every live stay in its own bed, inside the ward's beds", () => {
    expect(
      breaches((state) =>
        state.units.flatMap((unit) => {
          const live = state.admissions.filter((admission) => admission.unitId === unit.id && isLive(admission));
          const seats = wardStaySeats(unit, live);
          const taken = new Map<number, string>();
          const wrong: string[] = [];
          for (const admission of live) {
            const seat = admission.bedNumber ?? seats.get(admission.id);
            if (seat === undefined || seat < 1 || seat > unit.beds) {
              wrong.push(`${admission.id}@${unit.id}: no bed`);
              continue;
            }
            const other = taken.get(seat);
            if (other) wrong.push(`${other}+${admission.id}@${unit.id}#${seat}`);
            else taken.set(seat, admission.id);
          }
          return wrong;
        }),
      ),
    ).toEqual({});
  });

  // A16-13 and RC 6.2 (D-175 item 1): one person is in one place. No patient holds two live beds.
  it("gives no person two live beds", () => {
    expect(
      breaches((state) => {
        const byPatient = new Map<string, string[]>();
        for (const admission of state.admissions.filter(isLive)) {
          if (!admission.patientId) continue;
          byPatient.set(admission.patientId, [...(byPatient.get(admission.patientId) ?? []), admission.id]);
        }
        return [...byPatient.entries()]
          .filter(([, ids]) => ids.length > 1)
          .map(([id, ids]) => `${id}:${ids.join("+")}`);
      }),
    ).toEqual({});
  });

  // A16-13 (D-175 item 1, approved system fix): "a pulled bed must name the ED stay or referral it is
  // held for, enforced in the builder and the check". The journey holding it is still open.
  it("holds every pulled bed for an open journey, for the same person, on the same ward", () => {
    expect(
      breaches((state) =>
        state.admissions
          .filter((admission) => admission.state === "pulled")
          .filter((bed) => {
            const journey = state.movements.find((movement) => movement.admissionId === bed.id);
            if (journey) {
              return (
                journey.closure !== undefined ||
                journey.stage === "arrived" ||
                journey.acceptedUnitId !== bed.unitId ||
                (bed.patientId !== null && journey.patientId !== undefined && journey.patientId !== bed.patientId)
              );
            }
            const referral = bed.referralId ? state.referrals.find((each) => each.id === bed.referralId) : undefined;
            return !referral?.destinations.some((entry) => entry.state === "accepted");
          })
          .map((bed) => bed.id),
      ),
    ).toEqual({});
  });

  // A16-13 (D-175 item 1): "the pull time comes from that record". A pulled bed is pulled after the
  // person reached ED and after a ward accepted them, and its limit runs from the pull by the
  // configured hold (a signed value, read from the configuration, never typed here).
  it("pulls each held bed after the journey opened and was accepted, with the limit counted from the pull", () => {
    expect(
      breaches((state) =>
        state.admissions
          .filter((bed) => bed.state === "pulled" && finite(bed.pulledAt))
          .flatMap((bed) => {
            const journey = state.movements.find((movement) => movement.admissionId === bed.id);
            if (!journey) return [];
            const wrong: string[] = [];
            if (bed.pulledAt! < journey.openedAt) wrong.push(`${journey.id}: pulled before reaching ED`);
            if (outOfOrder(journey.acceptedAt, bed.pulledAt)) wrong.push(`${journey.id}: pulled before accepted`);
            if (journey.pullExpiresAt !== undefined) {
              const extended = (journey.pullExtensions ?? []).reduce(
                (total, extension) => total + extension.minutes,
                0,
              );
              const limit = bed.pulledAt! + state.configuration.pullHoldMinutes + extended;
              if (journey.pullExpiresAt !== limit) wrong.push(`${journey.id}: limit not from the pull`);
            }
            return wrong;
          }),
      ),
    ).toEqual({});
  });

  // A16-13 / D-181 item 10: a stay names who is in it. Every live stay and journey links a person on file.
  it("links every live stay, open journey, referral and booking to a person on the patient list", () => {
    expect(
      breaches((state) => {
        const people = new Set<string>(state.patients.map((patient) => patient.id));
        const missing = (id: string | null | undefined) => id !== null && id !== undefined && !people.has(id);
        return [
          ...state.admissions
            .filter(isLive)
            .filter((a) => a.patientId === null || missing(a.patientId))
            .map((a) => a.id),
          ...state.movements.filter((m) => missing(m.patientId)).map((m) => m.id),
          ...state.referrals.filter((r) => missing(r.patientId)).map((r) => r.id),
          ...state.plannedAdmissions.filter((p) => missing(p.patientId)).map((p) => p.id),
        ];
      }),
    ).toEqual({});
  });
});

describe("F-88 times are in order and none is in the future unless it is a plan", () => {
  // RC 6.4 (D-175 item 1): the sample day must read in the order the app's own actions allow. The
  // transport chain is enforced by the actions (booked, collected, arrived); a referral comes before
  // its acceptance, an acceptance before the pull (A16-13: "pulled after reaching ED"), the pull
  // before the arrival. No order is proposed beyond what the actions already require.
  it("orders each journey: opened, referred, accepted, pulled, booked, collected, arrived, closed", () => {
    expect(
      breaches((state) =>
        state.movements
          .filter((movement) => {
            const bed = movement.admissionId
              ? state.admissions.find((admission) => admission.id === movement.admissionId)
              : undefined;
            const transport = movement.transport;
            const steps = [
              movement.openedAt,
              movement.referredAt,
              movement.acceptedAt,
              bed?.pulledAt,
              transport?.collectedAt,
              transport?.arrivedAt,
            ];
            const chain = steps.filter(finite);
            const ordered = chain.every((at, index) => index === 0 || chain[index - 1]! <= at);
            return (
              !ordered ||
              outOfOrder(transport?.bookedAt, transport?.collectedAt) ||
              outOfOrder(transport?.collectedAt, transport?.arrivedAt) ||
              outOfOrder(movement.openedAt, movement.closure?.at) ||
              outOfOrder(bed?.pulledAt, bed?.arrivedAt)
            );
          })
          .map((movement) => movement.id),
      ),
    ).toEqual({});
  });

  // RC 6.4 / A16-03: a referral is raised before any ward is asked or answers it.
  it("orders each referral: raised, then each ward asked, then each ward's answer", () => {
    expect(
      breaches((state) =>
        state.referrals
          .filter((referral) =>
            referral.destinations.some(
              (entry) =>
                outOfOrder(referral.raisedAt, entry.referredAt) ||
                outOfOrder(referral.raisedAt, entry.decidedAt) ||
                outOfOrder(entry.referredAt, entry.decidedAt),
            ),
          )
          .map((referral) => referral.id),
      ),
    ).toEqual({});
  });

  // RC 6.4 / A16-13: a stay is pulled before it is arrived, and arrives before it leaves.
  it("orders each stay: pulled, arrived, left", () => {
    expect(
      breaches((state) =>
        state.admissions
          .filter(
            (admission) =>
              outOfOrder(admission.pulledAt, admission.arrivedAt) || outOfOrder(admission.arrivedAt, admission.leftAt),
          )
          .map((admission) => admission.id),
      ),
    ).toEqual({});
  });

  // RC 2.0 and 6.4 (D-175 item 1): something recorded as done has happened by the demo clock. Plans
  // (planned moves, expected discharges and returns, typed form ends, pull limits) may be later.
  it("records nothing as already done after the demo clock", () => {
    const after = (at: number | null | undefined) => finite(at) && at > NOW;
    expect(
      breaches((state) => [
        ...state.movements
          .filter(
            (m) =>
              after(m.openedAt) ||
              after(m.referredAt) ||
              after(m.acceptedAt) ||
              after(m.formedAt) ||
              after(m.legalFormReceivedAt) ||
              after(m.examination?.at) ||
              after(m.closure?.at) ||
              after(m.transport?.bookedAt) ||
              after(m.transport?.collectedAt) ||
              after(m.transport?.arrivedAt),
          )
          .map((m) => m.id),
        ...state.admissions
          .filter((a) => after(a.pulledAt) || after(a.arrivedAt) || after(a.leftAt) || after(a.dischargeConfirmedAt))
          .map((a) => a.id),
        ...state.referrals
          .filter((r) => after(r.raisedAt) || r.destinations.some((e) => after(e.referredAt) || after(e.decidedAt)))
          .map((r) => r.id),
        ...state.plannedAdmissions.filter((p) => after(p.bookedAt)).map((p) => p.id),
        ...state.leaveBeds.filter((l) => after(l.confirmedAt)).map((l) => l.id),
      ]),
    ).toEqual({});
  });

  // D-175 item 5 (root-cause question 4): Day N counts Perth calendar days, the arrival day is Day 1.
  it("numbers every stay's day from its Perth arrival day, with the arrival day as Day 1", () => {
    expect(
      breaches((state) =>
        state.admissions
          .filter(bedIsOccupied)
          .filter((admission) => finite(admission.arrivedAt))
          .filter((admission) => stayDayNumber(admission, NOW) !== dayOf(NOW) - dayOf(admission.arrivedAt!) + 1)
          .map((admission) => admission.id),
      ),
    ).toEqual({});
  });
});

describe("F-88 legal forms read as recorded", () => {
  // D-176 A1 and D-181 item 2: a form shows as recorded on every screen until a person records it
  // ended. Nothing is inferred from an examination or an arrival.
  it("shows every form nobody recorded as ended as the form on record, not ended", () => {
    expect(
      breaches((state) =>
        state.movements
          .filter(
            (movement): movement is Movement & { legalForm: NonNullable<Movement["legalForm"]> } =>
              movement.legalForm !== undefined,
          )
          .filter((movement) => {
            const position = currentLegalPosition(movement);
            if (formRecordedEnded(movement)) return !position.ended;
            return position.ended || legalFormNowWords(movement) !== `Form ${movement.legalForm.code}`;
          })
          .map((movement) => movement.id),
      ),
    ).toEqual({});
  });

  // RC 6.4 ("form times cannot be in the future or end before they start", enforced by the actions):
  // a form's written time is not after the clock and not after the typed end written on it.
  it("never times a form after the clock or after the end typed on it", () => {
    expect(
      breaches((state) =>
        state.movements
          .filter(
            (movement) =>
              (finite(movement.formedAt) && movement.formedAt > NOW) ||
              outOfOrder(movement.formedAt, movement.legalForm?.dueAt),
          )
          .map((movement) => movement.id),
      ),
    ).toEqual({});
  });
});

describe("F-88 observation and choices nobody made", () => {
  const LEVELS: readonly string[] = [...OBSERVATION_LEVELS, OBSERVATION_NOT_RECORDED];

  // D-175 item 3 and D-181 item 14: a level is a recorded one or "not recorded", never anything else.
  it("holds only a recorded level or not recorded on every stay and journey", () => {
    expect(
      breaches((state) => [
        ...state.admissions.filter((a) => !LEVELS.includes(a.observation.level)).map((a) => a.id),
        ...state.movements.filter((m) => !LEVELS.includes(m.observation.level)).map((m) => m.id),
      ]),
    ).toEqual({});
  });

  // D-175 item 3 (RC 3.5): a stay the app makes from a seeded booking holds "not recorded" until a
  // person records a level; a missing level is never shown as General. Replayed through the app's own
  // conversion, since no seeded booking is converted yet.
  it("gives a stay made from each seeded booking no observation level, never General", () => {
    const found: string[] = [];
    let converted = 0;
    for (const day of DAYS) {
      for (const booking of day.state.plannedAdmissions.filter((each) => each.state === "booked")) {
        const after = wardFlowReducer(day.state, {
          type: "CONVERT_PLANNED_ADMISSION",
          role: "coordinator",
          now: NOW,
          unitId: booking.unitId,
          plannedAdmissionId: booking.id,
        });
        const made = after.admissions.find(
          (admission) => !day.state.admissions.some((before) => before.id === admission.id),
        );
        if (!made) continue;
        converted += 1;
        if (made.observation.level !== OBSERVATION_NOT_RECORDED) found.push(`${day.label} ${booking.id}`);
      }
    }
    expect(converted, "no seeded booking could be converted, so this check tested nothing").toBeGreaterThan(0);
    expect(found).toEqual([]);
  });

  // D-179 item 2: no clinical choice starts selected. A stay that has not left holds no discharge
  // destination (it is chosen when the person leaves), and no leave record holds a return before it began.
  it("pre-selects no discharge destination on a stay still in its bed", () => {
    expect(
      breaches((state) =>
        state.admissions
          .filter((admission) => isLive(admission) && admission.leavingDestination !== null)
          .map((admission) => admission.id),
      ),
    ).toEqual({});
  });
});

describe("F-88 names", () => {
  // F-148 (D-191 item 13) and A16-01: every person on file has a full synthetic name, never initials.
  it("gives every person a full given and family name", () => {
    const initials = /^[A-Z]\.?$|^[A-Z]{2,3}$/u;
    expect(
      breaches((state) =>
        state.patients
          .filter(
            (patient) =>
              patient.givenName.trim().length < 2 ||
              patient.familyName.trim().length < 2 ||
              initials.test(patient.givenName.trim()) ||
              initials.test(patient.familyName.trim()),
          )
          .map((patient) => patient.id),
      ),
    ).toEqual({});
  });

  // A16-20 ("no two people share a hospital number, ID or full name", checked and fine): keep it so.
  it("gives no two people the same UMRN or patient id", () => {
    expect(
      breaches((state) => {
        const dupes = (values: string[]) => values.filter((value, index) => values.indexOf(value) !== index);
        return [...dupes(state.patients.map((p) => p.umrn)), ...dupes(state.patients.map((p) => p.id))];
      }),
    ).toEqual({});
  });
});

describe("F-88 staff and family names", () => {
  // A16-02 (D-175 item 1): "no clinician, GP or next of kin has the full name of a patient".
  it("gives no staff member, GP or next of kin the full name of a person on file", () => {
    const fold = (text: string) => text.toLowerCase().replace(/[^a-z]/gu, "");
    const staff = ALL_STAFF.map((member) => fold(`${member.given} ${member.family}`));
    expect(
      breaches((state) => {
        const people = new Map(state.patients.map((p) => [fold(`${p.givenName} ${p.familyName}`), p.id]));
        return [
          ...staff.filter((name) => people.has(name)).map((name) => `staff=${people.get(name)!}`),
          ...state.patients
            .filter((p) => p.nextOfKinName !== undefined && people.has(fold(p.nextOfKinName)))
            .map((p) => `${p.id} next of kin=${people.get(fold(p.nextOfKinName!))!}`),
        ];
      }),
    ).toEqual({});
  });
});

describe("F-88 journeys read true", () => {
  // A16-18 (D-175 item 1): the reason for waiting follows the stage. Nobody accepted, pulled, on the
  // road or arrived is still awaiting a destination response.
  it("never leaves a person past acceptance awaiting a destination response", () => {
    expect(
      breaches((state) =>
        state.movements
          .filter(
            (m) =>
              m.stage !== "placement_requested" &&
              m.stage !== "destination_review" &&
              m.blocker === "Awaiting destination response",
          )
          .map((m) => m.id),
      ),
    ).toEqual({});
  });

  // A16-18 (D-175 item 1): an arrival closes the journey as arrived, and only an arrival does.
  it("closes a journey as arrived exactly when it reached the arrived stage", () => {
    expect(
      breaches((state) =>
        state.movements
          .filter(
            (m) =>
              (m.closure?.outcome === "arrived" && m.stage !== "arrived") ||
              (m.stage === "arrived" && m.closure !== undefined && m.closure.outcome !== "arrived"),
          )
          .map((m) => m.id),
      ),
    ).toEqual({});
  });

  // A16-17 (D-175 item 1, approved system fix): "no open referral to a closed ward".
  it("asks no ward that is closed to admissions", () => {
    expect(
      breaches((state) => {
        const closed = new Set(state.units.filter((unit) => unit.isClosed).map((unit) => unit.id));
        return [
          ...state.referrals
            .filter((r) =>
              r.destinations.some(
                (e) =>
                  e.state === "queued" &&
                  e.destination.kind === "psychiatric_ward" &&
                  closed.has(e.destination.unitId ?? ""),
              ),
            )
            .map((r) => r.id),
          ...state.movements
            .filter(
              (m) =>
                (m.stage === "placement_requested" || m.stage === "destination_review") &&
                m.referredUnitIds.some((unitId) => closed.has(unitId)),
            )
            .map((m) => m.id),
        ];
      }),
    ).toEqual({});
  });

  // A16-20 (D-175 item 1, approved system fix): "the builders place planned moves and community
  // referrals inside working hours, and the check enforces it". Working hours as A16-20 used them.
  it("plans every move, and raises every GP and community referral, between 08:00 and 17:00", () => {
    const minuteOfDay = (at: number) => ((at % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const outside = (at: number) => minuteOfDay(at) < 8 * 60 || minuteOfDay(at) > 17 * 60;
    expect(
      breaches((state) => [
        ...state.movements
          .filter((m) => m.plannedMoveAt !== undefined && (outside(m.plannedMoveAt) || m.plannedMoveAt <= NOW))
          .map((m) => m.id),
        ...state.referrals
          .filter((r) => (r.source === "gp" || r.source === "community") && outside(r.raisedAt))
          .map((r) => r.id),
      ]),
    ).toEqual({});
  });

  // A16-06 and D-181 item 6 (lists signed as drafted): an empty bed can only be "Awaiting clean"; an
  // occupied bed takes every other reason. Every seeded hold-up fits the bed it is on.
  it("puts every hold-up reason on a bed it fits", () => {
    expect(
      breaches((state) => [
        ...state.admissions
          .filter(
            (a) => a.blockReason !== null && !(a.state === "occupied" && holdUpReasonFits(a.blockReason, "occupied")),
          )
          .map((a) => a.id),
        ...state.bedReleases
          .filter((release) => {
            if (release.blocker === null) return false;
            const bed = release.state === "discharged" ? "empty" : "occupied";
            return !holdUpReasonFits(release.blocker, bed);
          })
          .map((release) => release.id),
      ]),
    ).toEqual({});
  });
});

describe("F-88 travel with no checked bands (D-193)", () => {
  // D-193 items 1 and 2 (and D-181 item 7, A16-04): with no checked travel times, every pair reads as
  // not checked and the Out of area list places nobody far from home. Tests the honest state.
  it("places nobody far from home and leaves every stay's band not recorded", () => {
    expect(CHECKED_TRAVEL_BANDS).toEqual([]);
    expect(
      breaches((state) => {
        const ledger = outOfAreaLedger(state.admissions, state.units, NOW);
        const banded = [
          ...state.admissions
            .filter(isLive)
            .filter((a) => {
              const unit = state.units.find((each) => each.id === a.unitId);
              return (
                unit !== undefined && a.homeRegion !== null && travelBand(a.homeRegion, unit.siteCode) !== undefined
              );
            })
            .map((a) => a.id),
          ...state.referrals
            .filter((r) => state.units.some((unit) => travelBand(r.homeRegion, unit.siteCode) !== undefined))
            .map((r) => r.id),
        ];
        return [...ledger.entries.map((entry) => `far:${entry.admission.id}`), ...banded];
      }),
    ).toEqual({});
  });
});
