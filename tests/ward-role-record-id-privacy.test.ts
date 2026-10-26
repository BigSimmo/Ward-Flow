import { describe, expect, it } from "vitest";
import { commandRefusal, seedWorld, validCommand, validWorld, worldNow } from "../backend/ward-flow/engine";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { commandScopeRefusal, scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { syntheticGovernanceAuditEvents } from "../src/components/ward-management/ward-governance-seed";
import { INBOX_CATEGORIES } from "../src/components/ward-management/ward-inbox-reducer";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";

const at = new Date("2026-10-24T00:00:00Z");
const world = seedWorld(at);
const state = world.state;
const places = wardPlaceLookup(state.units);
const ownUnit = state.units[0].id;
const service = places.unitService(ownUnit)!;
const access: WardAccess = { role: "coordinator", scope: { kind: "service", service } };
const options = { now: worldNow(world, at), places };
const scoped = scopeWardFlowState(state, access, options).state;
const refusal = (fields: Record<string, unknown>) =>
  commandScopeRefusal(state, access, { type: "SCOPE_PROBE", role: "coordinator", ...fields }, options);
const outside = "This change names a record outside your role's place.";

const referenceCollections = [
  ["patientId", "patients"],
  ["movementId", "movements"],
  ["admissionId", "admissions"],
  ["referralId", "referrals"],
  ["plannedAdmissionId", "plannedAdmissions"],
  ["releaseId", "bedReleases"],
  ["leaveBedId", "leaveBeds"],
] as const;

describe("shared command record references do not reveal hidden record existence", () => {
  it.each(referenceCollections)(
    "keeps own %s and refuses hidden and absent references equally",
    (field, collection) => {
      const own = scoped[collection][0];
      const hidden = state[collection].find((record) => !scoped[collection].some((shown) => shown.id === record.id));
      expect(own, `${collection} own seed fixture`).toBeDefined();
      expect(hidden, `${collection} hidden seed fixture`).toBeDefined();
      expect(refusal({ [field]: own.id })).toBeNull();
      expect(refusal({ [field]: hidden!.id })).toBe(outside);
      expect(refusal({ [field]: "SYNTHETIC-ABSENT" })).toBe(outside);
    },
  );

  it.each(["noticeId", "alertId", "eventId", "reviewId"])(
    "also refuses absent %s when its collection is empty",
    (field) => {
      expect(refusal({ [field]: "SYNTHETIC-ABSENT" })).toBe(outside);
    },
  );

  it("closes the reproduced oracle through the actual backend command authorisation", () => {
    expect(validWorld(world)).toBe(true);
    const hidden = state.movements.find((movement) => !scoped.movements.some((shown) => shown.id === movement.id))!;
    const command = (movementId: string) => ({
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: options.now,
      movementId,
      urgency: 2,
      reason: "reassessed",
    });
    expect(validCommand(command(hidden.id))).toBe(true);
    expect(validCommand(command("WF-SYNTHETIC-ABSENT"))).toBe(true);
    expect(commandRefusal(world, access, command(hidden.id), at)).toBe(outside);
    expect(commandRefusal(world, access, command("WF-SYNTHETIC-ABSENT"), at)).toBe(outside);
    expect(commandRefusal(world, access, command(scoped.movements[0].id), at)).toBeNull();
  });

  it("does not authorise a pointer merely because another collection contains that id", () => {
    expect(refusal({ movementId: scoped.patients[0].id })).toBe(outside);
  });

  it("keeps break glass records read only, with the same refusal as absent records", () => {
    const hidden = state.admissions.find((admission) => !scoped.admissions.some((shown) => shown.id === admission.id))!;
    const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [ownUnit] } };
    const granted = { ...options, grants: [{ patientId: hidden.patientId!, until: options.now + 60 }] };
    const send = (admissionId: string) =>
      commandScopeRefusal(state, ward, { type: "OPEN_DISCHARGE_RECORD", admissionId }, granted);
    expect(send(hidden.id)).toBe(outside);
    expect(send("AD-SYNTHETIC-ABSENT")).toBe(outside);
  });

  it("checks nested observation targets and bed meeting subjects", () => {
    const hidden = state.movements.find((movement) => !scoped.movements.some((shown) => shown.id === movement.id))!;
    for (const id of [hidden.id, "WF-SYNTHETIC-ABSENT"]) {
      expect(refusal({ type: "RECORD_OBSERVATION_LEVEL", target: { kind: "movement", movementId: id } })).toBe(outside);
      expect(refusal({ type: "COMPLETE_BED_MEETING_ACTION", subject: { kind: "movement", id } })).toBe(outside);
    }
    const id = scoped.movements[0].id;
    expect(refusal({ type: "RECORD_OBSERVATION_LEVEL", target: { kind: "movement", movementId: id } })).toBeNull();
    expect(refusal({ type: "COMPLETE_BED_MEETING_ACTION", subject: { kind: "movement", id } })).toBeNull();
  });

  it("keeps optional existing links optional and checks a link when supplied", () => {
    expect(refusal({ type: "RECEIVE_REFERRAL" })).toBeNull();
    expect(refusal({ type: "BOOK_PLANNED_ADMISSION", patientId: null })).toBeNull();
    expect(refusal({ type: "RAISE_REFERRAL", referralId: undefined })).toBeNull();
    expect(refusal({ type: "RECEIVE_REFERRAL", patientId: scoped.patients[0].id })).toBeNull();
    expect(refusal({ type: "RECEIVE_REFERRAL", patientId: "PT-SYNTHETIC-ABSENT" })).toBe(outside);
  });

  it("preserves creation/correlation values and never looks up arbitrary text", () => {
    const hidden = state.patients.find((patient) => !scoped.patients.some((shown) => shown.id === patient.id))!;
    for (const text of [hidden.id, "PT-SYNTHETIC-ABSENT", "audit-seed-SYNTHETIC-ABSENT"]) {
      expect(refusal({ movementId: scoped.movements[0].id, reason: text, note: { text } })).toBeNull();
      expect(
        refusal({
          type: "ADD_PATIENT",
          registrationScope: { kind: "service", placeId: service },
          created: { id: text },
        }),
      ).toBeNull();
      expect(refusal({ type: "RECEIVE_REFERRAL", submissionId: text, requestNamespace: text })).toBeNull();
      expect(
        refusal({ type: "OPEN_DISCHARGE_RECORD", admissionId: scoped.admissions[0].id, requestId: text }),
      ).toBeNull();
      expect(
        refusal({ type: "ADD_PATIENT", registrationScope: { kind: "service", placeId: service }, umrn: text }),
      ).toBeNull();
    }
  });

  it.each([
    [INBOX_CATEGORIES.legal_timing_breached.idPrefix, "movements"],
    [INBOX_CATEGORIES.support_notification_discharge.idPrefix, "admissions"],
    [INBOX_CATEGORIES.absent_without_leave.idPrefix, "admissions"],
    [INBOX_CATEGORIES.planned_arrival_overdue.idPrefix, "plannedAdmissions"],
    [INBOX_CATEGORIES.duplicate_bed_request.idPrefix, "patients"],
    ["meeting-action-book_transport-movement-", "movements"],
    ["meeting-action-book_transport-admission-", "admissions"],
  ] as const)("checks the record behind inbox prefix %s", (prefix, collection) => {
    const own = scoped[collection][0];
    const hidden = state[collection].find((record) => !scoped[collection].some((shown) => shown.id === record.id))!;
    expect(refusal({ type: "ACKNOWLEDGE_INBOX_ITEM", inboxItemId: `${prefix}${own.id}` })).toBeNull();
    expect(refusal({ type: "ACKNOWLEDGE_INBOX_ITEM", inboxItemId: `${prefix}${hidden.id}` })).toBe(outside);
    expect(refusal({ type: "ACKNOWLEDGE_INBOX_ITEM", inboxItemId: `${prefix}SYNTHETIC-ABSENT` })).toBe(outside);
    expect(refusal({ type: "ACKNOWLEDGE_INBOX_ITEM", inboxItemId: ` ${prefix}${own.id} ` })).toBeNull();
    expect(refusal({ type: "ACKNOWLEDGE_INBOX_ITEM", inboxItemId: ` ${prefix}${hidden.id} ` })).toBe(outside);
    expect(refusal({ type: "ACKNOWLEDGE_INBOX_ITEM", inboxItemId: ` ${prefix}SYNTHETIC-ABSENT ` })).toBe(outside);
  });

  it("keeps the daily check's non-record identity", () => {
    expect(refusal({ type: "COMPLETE_INBOX_ITEM", inboxItemId: "daily-check-day-0" })).toBeNull();
  });

  it("keeps seeded audit entries limited to those the service desk actually shows", () => {
    const shown = syntheticGovernanceAuditEvents(scoped);
    expect(shown.length).toBeGreaterThan(0);
    for (const event of shown) expect(refusal({ type: "REVIEW_AUDIT_EVENT", eventId: event.id })).toBeNull();
    expect(refusal({ type: "REVIEW_AUDIT_EVENT", eventId: "audit-seed-SYNTHETIC-ABSENT" })).toBe(outside);
  });

  it("retains place restrictions and permits external referral destinations", () => {
    const otherUnit = state.units.find((unit) => places.unitService(unit.id) !== service)!.id;
    expect(refusal({ type: "CONFIRM_CAPACITY", unitId: otherUnit })).toBe(outside);
    expect(refusal({ type: "CONFIRM_CAPACITY", unitId: ownUnit, actingUnitId: ownUnit })).toBeNull();
    expect(
      refusal({
        type: "RECEIVE_REFERRAL",
        originUnitId: ownUnit,
        destinations: [{ kind: "psychiatric_ward", unitId: otherUnit }],
      }),
    ).toBeNull();
    expect(refusal({ type: "RECEIVE_REFERRAL", originUnitId: otherUnit })).toBe(outside);
  });

  it("leaves statewide coordinator authority unchanged", () => {
    expect(
      commandScopeRefusal(
        state,
        STATEWIDE_COORDINATOR,
        { type: "CHANGE_URGENCY", movementId: "WF-SYNTHETIC-ABSENT" },
        options,
      ),
    ).toBeNull();
  });
});
