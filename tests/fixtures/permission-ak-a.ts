/**
 * **AK-A AS A SIGNED TABLE — the access rules of the answer key, keyed by change (R-STRUCT-1, D-223).**
 *
 * Source: `run/prep/answer-key.md`, section 5, rows AK-A-01 to AK-A-09 (14 Nov 2026). Each row's
 * "may" and "must be refused" phrases are mapped here to the change types they name, with the phrase
 * beside each group. D-223 (Josh, 14 Nov 2026): AK-A becomes this test table, and any row where AK-A
 * and the app disagree is listed for his yes or no rather than silently picked.
 *
 * `tests/ward-permit-ak-a.test.ts` asks `permit()` and the shared server (`deskCommand` then
 * `commandRefusal`, then the reducer's role check) for every cell, and holds both to AK-A, except the
 * cells in `AK_A_DISAGREEMENTS`, where both are held to what the app does TODAY so a change to either
 * side fails until the list is updated.
 *
 * ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ ROWS WHERE AK-A AND THE APP DISAGREE (for Josh, D-223) — mirrored in AK_A_DISAGREEMENTS below  │
 * ├───────────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 1. AK-A-01 statewide coordinator, "every action": UNDO_SITE_HANDOVER_SIGN_OFF is the site bed   │
 * │    manager's alone (EVENT_ROLE), so the reducer refuses the coordinator. AK-A allow, app never. │
 * │ 2. AK-A-02 service coordinator, "as statewide inside its service": RECORD_SITE_HANDOVER_SIGN_OFF│
 * │    for a site in its service is refused (Q61: only the site's own bed manager). AK-A allow      │
 * │    (implied), app never.                                                                         │
 * │ 3. AK-A-02 service coordinator: SET_CONFIGURATION (global settings) is refused ("Only the       │
 * │    statewide coordinator may change global settings."). AK-A does not list it either way.      │
 * │ 4-6. AK-A-07 transport officer, "everything else" refused: the app lets the officer             │
 * │    MARK_NOTICE_READ, RECORD_DIRECTORY_CHECK and ACKNOWLEDGE_BROADCAST_ALERT. AK-A never, app    │
 * │    allow.                                                                                         │
 * │ 7. AK-A-09 access admin "its own scope" may switch a site feature: the app lets only the        │
 * │    STATEWIDE access admin (D-142). A service-scoped admin is refused. AK-A allow, app never.    │
 * └───────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Mapping choices to sign with the table (not disagreements):
 * - AK-A-03 "blockers" is read as discharge blockers on stays and bed-release blocks
 *   (`RECORD_STAY_DISCHARGE_BLOCKER`, `BLOCK_BED_RELEASE`); movement blockers are not the bed
 *   manager's in `EVENT_ROLE`. "read-only Referrals" is read as: no referral write at all.
 * - AK-A-04 "legal records" is read as form receipt and continuation. A written
 *   form (`RECORD_LEGAL_FORM_WRITTEN`) is the ward's only for a person in one of its own beds (WT-03),
 *   which the seed has none of, so it is pinned in `tests/ward-permit-place-rules.test.ts` instead;
 *   "arrival" as `PATIENT_ARRIVED` and the arrival plan
 *   `SET_ARRIVAL_DETAILS` (X1b-6, pinned allowed).
 * - AK-A-06 "follow-up" is read as the team's reply (`RECORD_FOLLOW_UP_REPLY`).
 * - Break glass, access grants and reading screens are not changes, so they have no cell here.
 *
 * Synthetic places only: every id comes from the seeded demonstration workspace.
 */
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import type { HealthService } from "@/components/ward-management/ward-model";

/** Places picked from the seeded workspace by the test. */
export type AkAPlaces = {
  readonly unitId: string;
  /** The ward's site and health service. */
  readonly siteCode: string;
  readonly service: HealthService;
  /** An ED and the site it belongs to. */
  readonly edId: string;
  readonly edSiteCode: string;
  readonly teamName: string;
};

export type AkAAnswer = "allow" | "never";

export type AkACell = {
  readonly type: WardFlowEventType;
  /** Fields that keep the change inside the desk's own place. */
  readonly fields?: (places: AkAPlaces) => Readonly<Record<string, unknown>>;
};

export type AkAGroup = {
  /** The AK-A phrase, word for word. */
  readonly phrase: string;
  /** "not stated" groups exist only to test what the app does where AK-A is silent; each cell is a disagreement row. */
  readonly answer: AkAAnswer | "not stated";
  readonly cells: readonly (WardFlowEventType | AkACell)[];
};

export type AkARow = {
  readonly id: string;
  /** The AK-A "role (membership)" and "scope" columns. */
  readonly membership: string;
  readonly access: (places: AkAPlaces) => WardAccess;
  readonly groups: readonly AkAGroup[];
  /** AK-A's answer for every change the groups do not name ("every action", "everything else"). */
  readonly rest?: AkAAnswer;
};

export type AkADisagreement = {
  readonly row: string;
  readonly type: WardFlowEventType;
  /** AK-A's answer, or "not stated" when AK-A is silent and the app decides. */
  readonly akA: AkAAnswer | "not stated";
  /** What the app does today (permit and the server agree). */
  readonly app: AkAAnswer;
  readonly note: string;
};

const ownWard = (p: AkAPlaces) => ({ unitId: p.unitId, actingUnitId: p.unitId });

export const AK_A_ROWS: readonly AkARow[] = [
  {
    id: "AK-A-01",
    membership: "Bed coordinator, statewide (coordinator), whole network",
    access: () => ({ role: "coordinator", scope: { kind: "statewide" } }),
    groups: [
      {
        phrase: "the only desk for demo clock, Reset, Load scenario, outage record",
        answer: "allow",
        cells: ["ADVANCE_CLOCK", "RESET_SCENARIO", "SET_SCENARIO", "RECORD_OUTAGE_WINDOW"],
      },
    ],
    rest: "allow",
  },
  {
    id: "AK-A-02",
    membership: "Bed coordinator, one service (coordinator), its health service",
    access: (p) => ({ role: "coordinator", scope: { kind: "service", service: p.service } }),
    groups: [
      {
        phrase: "as statewide inside its service",
        answer: "allow",
        cells: [
          { type: "CONFIRM_CAPACITY", fields: ownWard },
          { type: "REFER_TO_UNITS", fields: (p) => ({ unitIds: [p.unitId] }) },
          { type: "CLOSE_WARD_TO_ADMISSIONS", fields: (p) => ({ unitId: p.unitId }) },
          { type: "RECORD_SITE_HANDOVER_SIGN_OFF", fields: (p) => ({ siteCode: p.siteCode }) },
        ],
      },
      { phrase: "(not stated) global settings", answer: "not stated", cells: ["SET_CONFIGURATION"] },
      {
        phrase: "Advance clock, Reset, Set scenario, outage record, site feature switch",
        answer: "never",
        cells: [
          "ADVANCE_CLOCK",
          "RESET_SCENARIO",
          "SET_SCENARIO",
          "RECORD_OUTAGE_WINDOW",
          { type: "SET_SITE_FEATURE_SWITCH", fields: (p) => ({ siteCode: p.siteCode }) },
        ],
      },
    ],
  },
  {
    id: "AK-A-03",
    membership: "Site bed manager (bed_manager), its site",
    access: (p) => ({ role: "bed_manager", scope: { kind: "site", siteCode: p.siteCode } }),
    groups: [
      { phrase: "confirm beds", answer: "allow", cells: [{ type: "CONFIRM_CAPACITY", fields: ownWard }] },
      {
        phrase: "releases",
        answer: "allow",
        cells: ["FLAG_BED_RELEASE", "CONFIRM_BED_RELEASE", "REVERT_BED_RELEASE", "SET_BED_PREPARATION"],
      },
      {
        phrase: "blockers",
        answer: "allow",
        cells: [
          "BLOCK_BED_RELEASE",
          "CLEAR_BED_RELEASE_BLOCK",
          "RECORD_STAY_DISCHARGE_BLOCKER",
          "CLEAR_STAY_DISCHARGE_BLOCKER",
        ],
      },
      {
        phrase: "close/reopen ward",
        answer: "allow",
        cells: [
          { type: "CLOSE_WARD_TO_ADMISSIONS", fields: (p) => ({ unitId: p.unitId }) },
          { type: "REOPEN_WARD_TO_ADMISSIONS", fields: (p) => ({ unitId: p.unitId }) },
        ],
      },
      {
        phrase: "bed calls (dispatch, extend, stand down)",
        answer: "allow",
        cells: [
          {
            type: "DISPATCH_BROADCAST_ALERT",
            fields: (p) => ({ kind: "bed_call", targetScope: "all", targetUnitIds: [p.unitId] }),
          },
          "EXTEND_BROADCAST_ALERT",
          "STAND_DOWN_BROADCAST_ALERT",
        ],
      },
      {
        phrase: "site handover sign-off",
        answer: "allow",
        cells: [{ type: "RECORD_SITE_HANDOVER_SIGN_OFF", fields: (p) => ({ siteCode: p.siteCode }) }],
      },
      { phrase: "seclusion view and room status", answer: "allow", cells: ["SET_SECLUSION_ROOM_STATUS"] },
      {
        phrase: "accept, pull, place, discharge, referral decisions",
        answer: "never",
        cells: [
          "ACCEPT_IN_PRINCIPLE",
          "PULL_PATIENT",
          "PLACE_IN_BED",
          "RECORD_PATIENT_DISCHARGE",
          "ACCEPT_REFERRAL",
          "DECLINE_REFERRAL",
          "DECLINE",
        ],
      },
      {
        phrase: "read-only Referrals for its site",
        answer: "never",
        cells: ["RAISE_REFERRAL", "MARK_REFERRAL_OPENED", "REQUEST_REFERRAL_INFORMATION"],
      },
      {
        phrase: "marking bed meeting actions done (D-80 later change)",
        answer: "never",
        cells: ["COMPLETE_BED_MEETING_ACTION"],
      },
    ],
  },
  {
    id: "AK-A-04",
    membership: "Nurse in charge (ward), its ward",
    access: (p) => ({ role: "ward", scope: { kind: "ward", unitIds: [p.unitId] } }),
    groups: [
      { phrase: "accept", answer: "allow", cells: ["ACCEPT_IN_PRINCIPLE", "ACCEPT_REFERRAL"] },
      { phrase: "decline", answer: "allow", cells: ["DECLINE", "DECLINE_REFERRAL"] },
      { phrase: "pull, place", answer: "allow", cells: ["PULL_PATIENT", "PLACE_IN_BED"] },
      {
        phrase: "arrival",
        answer: "allow",
        cells: ["PATIENT_ARRIVED", { type: "SET_ARRIVAL_DETAILS", fields: (p) => ({ actingUnitId: p.unitId }) }],
      },
      { phrase: "discharge", answer: "allow", cells: ["RECORD_PATIENT_DISCHARGE"] },
      {
        phrase: "legal records",
        answer: "allow",
        cells: ["RECORD_LEGAL_FORM_RECEIVED", "RECORD_LEGAL_FORM_CONTINUATION"],
      },
      { phrase: "Extend and release pull", answer: "allow", cells: ["EXTEND_PULL", "RELEASE_PULL"] },
      {
        phrase: "Withdraw acceptance, Raise Pull now, Ask more wards, dispatch bed calls, Settings",
        answer: "never",
        cells: [
          "WITHDRAW_ACCEPTANCE",
          "RAISE_PULL_NOW",
          "ASK_MORE_WARDS",
          "DISPATCH_BROADCAST_ALERT",
          "SET_CONFIGURATION",
        ],
      },
    ],
  },
  {
    id: "AK-A-05",
    membership: "ED clinician (ed), its ED",
    access: (p) => ({ role: "ed", scope: { kind: "ed", edId: p.edId } }),
    groups: [
      { phrase: "ED presentation", answer: "allow", cells: ["RECORD_ED_PRESENTATION"] },
      {
        phrase: "clearance",
        answer: "allow",
        cells: ["RECORD_MEDICAL_CLEARANCE", "RECORD_MOVEMENT_MEDICAL_CLEARANCE"],
      },
      { phrase: "examination", answer: "allow", cells: ["RECORD_EXAMINATION"] },
      { phrase: "transport booking", answer: "allow", cells: ["BOOK_TRANSPORT", "RECORD_TRANSPORT_NEED"] },
      {
        phrase: "referrals",
        answer: "allow",
        cells: [
          "RAISE_REFERRAL",
          { type: "RECEIVE_REFERRAL", fields: (p) => ({ source: "ed_medical", originSiteCode: p.edSiteCode }) },
        ],
      },
      // X1b-6 (pinned allowed): the ED saves an arrival plan.
      { phrase: "(X1b-6) arrival plan", answer: "allow", cells: ["SET_ARRIVAL_DETAILS"] },
      {
        phrase: "pull, place, accept-in-principle, Settings",
        answer: "never",
        cells: ["PULL_PATIENT", "PLACE_IN_BED", "ACCEPT_IN_PRINCIPLE", "SET_CONFIGURATION"],
      },
    ],
  },
  {
    id: "AK-A-06",
    membership: "Community team (community), its team",
    access: (p) => ({ role: "community", scope: { kind: "team", teamName: p.teamName } }),
    groups: [
      { phrase: "own referrals", answer: "allow", cells: ["RAISE_REFERRAL", "RECEIVE_REFERRAL", "WITHDRAW_REFERRAL"] },
      {
        phrase: "CTO records",
        answer: "allow",
        cells: ["RECORD_COMMUNITY_TREATMENT_ORDER", "END_COMMUNITY_TREATMENT_ORDER"],
      },
      { phrase: "tribunal", answer: "allow", cells: ["RECORD_TRIBUNAL_HEARING", "RECORD_TRIBUNAL_OUTCOME"] },
      { phrase: "follow-up", answer: "allow", cells: ["RECORD_FOLLOW_UP_REPLY"] },
      { phrase: "Movements for own journeys", answer: "allow", cells: ["HANDOVER_READY", "BOOK_TRANSPORT"] },
      { phrase: "pull, place", answer: "never", cells: ["PULL_PATIENT", "PLACE_IN_BED"] },
    ],
  },
  {
    id: "AK-A-07",
    membership: "Transport officer (officer), its service's jobs",
    access: (p) => ({ role: "officer", scope: { kind: "jobs", service: p.service } }),
    groups: [
      { phrase: "accept job", answer: "allow", cells: ["TRANSPORT_ACCEPTED"] },
      {
        phrase: "en route, collected, arrived",
        answer: "allow",
        cells: ["TRANSPORT_EN_ROUTE", "PATIENT_COLLECTED", "PATIENT_ARRIVED"],
      },
      { phrase: "CAD number", answer: "allow", cells: ["RECORD_TRANSPORT_CAD"] },
      { phrase: "movement blockers", answer: "allow", cells: ["RECORD_MOVEMENT_BLOCKER", "CLEAR_MOVEMENT_BLOCKER"] },
      { phrase: "diversion", answer: "allow", cells: ["RECORD_DIVERSION"] },
      { phrase: "upload a form", answer: "allow", cells: ["UPLOAD_PATIENT_FORM"] },
      { phrase: "Undo a transport step", answer: "allow", cells: ["UNDO_TRANSPORT_STEP"] },
      { phrase: "(crew times are the ED's)", answer: "never", cells: ["RECORD_CREW_TIMES"] },
    ],
    rest: "never",
  },
  {
    id: "AK-A-08",
    membership: "Executive (executive), statewide, counts only",
    access: () => ({ role: "executive", scope: { kind: "statewide" } }),
    groups: [],
    rest: "never",
  },
  {
    id: "AK-A-09",
    membership: "Access admin (admin), statewide",
    access: () => ({ role: "admin", scope: { kind: "statewide" } }),
    groups: [
      {
        phrase: "site feature switch",
        answer: "allow",
        cells: [{ type: "SET_SITE_FEATURE_SWITCH", fields: (p) => ({ siteCode: p.siteCode }) }],
      },
    ],
    rest: "never",
  },
  {
    id: "AK-A-09 (service)",
    membership: "Access admin (admin), one health service ('its own scope')",
    access: (p) => ({ role: "admin", scope: { kind: "service", service: p.service } }),
    groups: [
      {
        phrase: "site feature switch",
        answer: "allow",
        cells: [{ type: "SET_SITE_FEATURE_SWITCH", fields: (p) => ({ siteCode: p.siteCode }) }],
      },
    ],
    rest: "never",
  },
];

export const AK_A_DISAGREEMENTS: readonly AkADisagreement[] = [
  {
    row: "AK-A-01",
    type: "UNDO_SITE_HANDOVER_SIGN_OFF",
    akA: "allow",
    app: "never",
    note: "EVENT_ROLE gives taking back a site sign-off to the site bed manager alone; AK-A says the statewide coordinator takes every action.",
  },
  {
    row: "AK-A-02",
    type: "RECORD_SITE_HANDOVER_SIGN_OFF",
    akA: "allow",
    app: "never",
    note: "Q61: only the site's own bed manager (or the whole network) signs off a site; AK-A says 'as statewide inside its service'.",
  },
  {
    row: "AK-A-02",
    type: "SET_CONFIGURATION",
    akA: "not stated",
    app: "never",
    note: "Global settings are the statewide coordinator's; AK-A-02 does not list them either way.",
  },
  {
    row: "AK-A-07",
    type: "MARK_NOTICE_READ",
    akA: "never",
    app: "allow",
    note: "AK-A refuses the officer 'everything else'; the app lets every desk mark its own notice read.",
  },
  {
    row: "AK-A-07",
    type: "RECORD_DIRECTORY_CHECK",
    akA: "never",
    app: "allow",
    note: "AK-A refuses the officer 'everything else'; the app lets every desk record its directory check.",
  },
  {
    row: "AK-A-07",
    type: "ACKNOWLEDGE_BROADCAST_ALERT",
    akA: "never",
    app: "allow",
    note: "AK-A refuses the officer 'everything else'; the app lets every desk acknowledge a bed call it receives.",
  },
  {
    row: "AK-A-09 (service)",
    type: "SET_SITE_FEATURE_SWITCH",
    akA: "allow",
    app: "never",
    note: "D-142 gives the switch to the statewide access admin only; AK-A-09 says an admin of 'its own scope'.",
  },
];
