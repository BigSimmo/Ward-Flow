import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  DECLINE_REASONS,
  type Movement,
  type Referral,
  type ReferralAddressing,
} from "../src/components/ward-management/ward-model";
import {
  isWardPartialView,
  isBoundWardPartialView,
  bindWardPartialView,
  type SenderReferralPartialView,
} from "../src/components/ward-management/ward-partial-view-contract";
import { projectWardPartialView } from "../src/components/ward-management/ward-partial-view-projector";
import { WardPartialViewProvider, useWardPartialView } from "../src/components/ward-management/ward-partial-view";
import { referralSentByDesk } from "../src/components/ward-management/ward-referral-sender";
import { referralState, referralWithdrawable } from "../src/components/ward-management/ward-referrals";
import { movementNextStep } from "../src/components/ward-management/movements/movement-next-step";
import { allEmergencyDepartments, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";

const seed = seedWardFlowState();
const origin = seed.units[0];
const foreign = seed.units.filter((unit) => unit.id !== origin.id).slice(0, 2);
const admission = seed.admissions.find((row) => row.unitId === origin.id)!;
const places = wardPlaceLookup(seed.units);
const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [origin.id] } };
const options = { now: NOW_ANCHOR, places };
const line = (
  index: number,
  state: ReferralAddressing["state"],
): ReferralAddressing & { destination: Extract<ReferralAddressing["destination"], { kind: "psychiatric_ward" }> } => ({
  destination: {
    kind: "psychiatric_ward",
    unitId: foreign[index].id,
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  },
  state,
  decidedAt: state === "queued" ? undefined : NOW_ANCHOR,
  ...(state === "accepted" ? { acceptedUnitId: foreign[index].id } : {}),
  ...(state === "declined" ? { declineReason: DECLINE_REASONS[0] } : {}),
});

function fixture(destinations: ReferralAddressing[] = [line(0, "queued")]) {
  const referral: Referral = {
    ...structuredClone(seed.referrals[0]),
    source: "psychiatric_ward",
    originUnitId: origin.id,
    originSiteCode: origin.siteCode,
    raisedAt: NOW_ANCHOR,
    destinations,
    history: "Synthetic hidden narrative",
  };
  const movement: Movement = {
    ...structuredClone(seed.movements[0]),
    patientId: referral.patientId,
    referralId: referral.id,
    sourceAdmissionId: admission.id,
    stage: "destination_review",
    referredUnitIds: destinations
      .filter((row) => row.state === "queued")
      .flatMap((row) =>
        row.destination.kind === "psychiatric_ward" && row.destination.unitId ? [row.destination.unitId] : [],
      ),
    declines: [],
    withdrawnReferrals: [],
    escalation: undefined,
    acceptedUnitId: undefined,
    closure: undefined,
  };
  return { ...seed, referrals: [referral], movements: [movement] };
}

const sender = (view: ReturnType<typeof projectWardPartialView>) => {
  const entry = view.referrals[0];
  expect(entry.kind).toBe("sender");
  return entry as SenderReferralPartialView;
};

describe("display-only partial-view projection", () => {
  it("keeps an own referral's sender READ summary when repatriation also links a foreign stay", () => {
    const source = fixture();
    const foreignStay = { ...structuredClone(admission), id: "AD-SYNTHETIC-FOREIGN", unitId: foreign[0].id };
    source.admissions = [foreignStay];
    source.movements[0].sourceAdmissionId = foreignStay.id;
    const scoped = scopeWorkspace(source, access, options);
    expect(scoped.movements.map((row) => row.id)).toContain(source.movements[0].id);
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({
      kind: "sender",
      destinationStatus: "awaiting_answer",
    });
  });

  it("does not revive sender visibility from an own stay outside the ward handover window", () => {
    const source = fixture();
    const oldStay = {
      ...structuredClone(admission),
      leftAt: NOW_ANCHOR - CLINICAL_VALUES.wardHandoffWindow.value * 24 * 60 - 1,
    };
    source.admissions = [oldStay];
    source.referrals[0].source = "community";
    delete source.referrals[0].originUnitId;
    source.referrals[0].destinations = [
      { ...line(0, "queued"), destination: { ...line(0, "queued").destination, unitId: origin.id } },
    ];
    source.movements[0].referredUnitIds = [origin.id];
    const scoped = scopeWorkspace(source, access, options);
    expect(scoped.admissions).toHaveLength(0);
    expect(scoped.movements.map((row) => row.id)).toContain(source.movements[0].id);
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({
      kind: "restricted",
      restriction: "receiving",
    });
  });

  it("keeps the all-declined outcome and escalation without identifying or counting destinations", () => {
    const source = fixture([line(0, "declined"), line(1, "declined")]);
    source.movements[0].declines = foreign.map((unit) => ({
      unitId: unit.id,
      at: NOW_ANCHOR,
      reason: DECLINE_REASONS[0],
    }));
    const before = JSON.stringify(source);
    const view = projectWardPartialView(source, access, options);
    expect(isWardPartialView(JSON.parse(JSON.stringify(view)))).toBe(true);
    expect(sender(view)).toMatchObject({
      state: "declined",
      withdrawn: false,
      decidedAt: NOW_ANCHOR,
      canWithdraw: false,
    });
    expect(view.movements[0]).toMatchObject({ kind: "sender", destinationStatus: "none_found", nextStep: "escalate" });
    for (const unit of foreign) expect(JSON.stringify(view)).not.toContain(unit.id);
    expect(JSON.stringify(view)).not.toContain(source.referrals[0].history);
    expect(JSON.stringify(view)).not.toContain(DECLINE_REASONS[0]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("does not turn accepted community follow-up into a settled bed while a ward still waits", () => {
    const source = fixture([
      line(0, "queued"),
      {
        destination: { kind: "community_team", teamName: "Synthetic hidden team" },
        state: "accepted",
        decidedAt: NOW_ANCHOR,
      },
    ]);
    const view = projectWardPartialView(source, access, options);
    expect(sender(view)).toMatchObject({ state: "queued", canWithdraw: true });
    expect(view.movements[0]).toMatchObject({ destinationStatus: "awaiting_answer", nextStep: "wait" });
    expect(JSON.stringify(view)).not.toContain("Synthetic hidden team");
  });

  it("distinguishes an unrequested movement from a withdrawn request", () => {
    const source = fixture();
    source.movements[0].referredUnitIds = [];
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({
      destinationStatus: "not_requested",
      nextStep: "refer",
    });
    source.movements[0].withdrawnReferrals = [
      { unitId: foreign[0].id, at: NOW_ANCHOR, reason: "coordinator_withdrew" },
    ];
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({
      destinationStatus: "withdrawn",
      nextStep: "refer",
    });
    source.movements[0].withdrawnReferrals = [];
    source.movements[0].unwinds = [
      {
        kind: "acceptance_withdrawn",
        at: NOW_ANCHOR,
        by: "coordinator",
        reason: "Synthetic withdrawal",
        unitId: foreign[0].id,
      },
    ];
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({
      destinationStatus: "withdrawn",
      nextStep: "refer",
    });
  });

  it("retains accepted and closed movement next-step meaning without returning an acceptance ID", () => {
    const source = fixture([line(0, "accepted")]);
    source.movements[0].acceptedUnitId = foreign[0].id;
    source.movements[0].stage = "accepted_awaiting_bed";
    const view = projectWardPartialView(source, access, options);
    expect(sender(view)).toMatchObject({ state: "accepted", canWithdraw: false });
    expect(view.movements[0]).toMatchObject({ destinationStatus: "accepted", nextStep: "pull" });
    expect(JSON.stringify(view)).not.toContain(foreign[0].id);
    source.movements[0].closure = { at: NOW_ANCHOR, outcome: "did_not_proceed", reason: "Synthetic closure" };
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({ nextStep: "none" });
  });

  it("deduplicates open information categories without requester identities, counts, times or handles", () => {
    const source = fixture([line(0, "queued"), line(1, "queued")]);
    for (const row of source.referrals[0].destinations)
      row.informationNeeds = [
        { need: "legal_form_copy", at: NOW_ANCHOR, by: "Synthetic hidden ward" },
        { need: "drug_screen", at: NOW_ANCHOR, by: "Synthetic hidden ward", metAt: NOW_ANCHOR, metBy: "ward" },
      ];
    source.referrals[0].destinations.push({
      ...line(1, "declined"),
      informationNeeds: [{ need: "bloods_or_ecg", at: NOW_ANCHOR, by: "ward" }],
    });
    const view = projectWardPartialView(source, access, options);
    expect(sender(view).informationNeeds).toEqual(["legal_form_copy"]);
    expect(JSON.stringify(view)).not.toContain("Synthetic hidden ward");
    expect(isWardPartialView(view)).toBe(true);
  });

  it("keeps withdrawal and linked movement restrictions truthful", () => {
    const source = fixture([{ ...line(0, "queued"), withdrawnAt: NOW_ANCHOR }]);
    expect(sender(projectWardPartialView(source, access, options))).toMatchObject({
      state: "queued",
      withdrawn: true,
      canWithdraw: false,
    });
    source.referrals[0].destinations = [line(0, "queued")];
    source.movements[0].stage = "moving";
    expect(sender(projectWardPartialView(source, access, options)).canWithdraw).toBe(false);
  });

  it("gives receivers restriction only and adds a grant-only record without global answers", () => {
    const source = fixture([line(0, "declined"), line(1, "accepted")]);
    source.referrals[0].source = "ed_medical";
    delete source.referrals[0].originUnitId;
    delete source.movements[0].sourceAdmissionId;
    source.movements[0].referredUnitIds = [foreign[0].id, foreign[1].id];
    const receiver: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [foreign[0].id] } };
    const received = projectWardPartialView(source, receiver, options);
    expect(received.referrals).toEqual([{ id: source.referrals[0].id, kind: "restricted", restriction: "receiving" }]);
    expect(received.movements).toEqual([{ id: source.movements[0].id, kind: "restricted", restriction: "receiving" }]);
    const baseline = projectWardPartialView(source, access, options);
    expect(baseline.referrals).toEqual([]);
    expect(baseline.movements).toEqual([]);
    const granted = projectWardPartialView(source, access, {
      ...options,
      grants: [{ patientId: source.referrals[0].patientId!, until: NOW_ANCHOR + 1 }],
    });
    // Current scope omits a grant-only referral when no permitted destination remains.
    expect(granted.referrals).toEqual([]);
    expect(granted.movements).toEqual([{ id: source.movements[0].id, kind: "restricted", restriction: "grant" }]);
    expect(
      projectWardPartialView(source, access, {
        ...options,
        grants: [{ patientId: source.referrals[0].patientId!, until: NOW_ANCHOR }],
      }),
    ).toEqual(baseline);
    expect(isWardPartialView(granted)).toBe(true);
  });

  it("gives a bed manager its existing sender read summary without a withdrawal hint", () => {
    const source = fixture();
    const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: origin.siteCode } };
    expect(projectWardPartialView(source, bedManager, options).referrals[0]).toMatchObject({
      kind: "sender",
      state: "queued",
      canWithdraw: false,
    });
    expect(referralSentByDesk(source.referrals[0], bedManager, places)).toBe(false);
    expect(projectWardPartialView(source, { role: "executive", scope: { kind: "statewide" } }, options)).toEqual({
      version: 1,
      referrals: [],
      movements: [],
    });
  });

  it("matches a bed manager's existing own-site ED sender read population", () => {
    const source = fixture([line(0, "declined")]);
    const ed = allEmergencyDepartments()[0];
    const manager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: ed.siteCode } };
    source.referrals[0].source = "ed_medical";
    source.referrals[0].originSiteCode = ed.siteCode;
    delete source.referrals[0].originUnitId;
    delete source.movements[0].sourceAdmissionId;
    source.movements[0].originEdId = ed.id;
    source.movements[0].referredUnitIds = [];
    source.movements[0].declines = [{ unitId: foreign[0].id, at: NOW_ANCHOR, reason: DECLINE_REASONS[0] }];
    const before = JSON.stringify(source);
    const view = projectWardPartialView(source, manager, options);
    expect(view.referrals[0]).toMatchObject({ kind: "sender", state: "declined", canWithdraw: false });
    expect(view.movements[0]).toMatchObject({ kind: "sender", progress: "none_found", nextStep: "escalate" });
    expect(referralSentByDesk(source.referrals[0], manager, places)).toBe(false);
    expect(isWardPartialView(view)).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("recognises a bed manager's source stay without claiming a foreign referral was sent by it", () => {
    const source = fixture();
    const manager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: origin.siteCode } };
    source.referrals[0].source = "community";
    delete source.referrals[0].originUnitId;
    const view = projectWardPartialView(source, manager, options);
    expect(view.movements[0]).toMatchObject({ kind: "sender", progress: "awaiting_answer" });
    expect(view.referrals.every((row) => row.kind === "restricted")).toBe(true);
  });

  it("does not turn a receiving bed manager into a sender", () => {
    const source = fixture();
    source.referrals[0].source = "community";
    delete source.referrals[0].originUnitId;
    delete source.movements[0].sourceAdmissionId;
    delete source.movements[0].originEdId;
    source.referrals[0].destinations = [
      {
        ...line(0, "queued"),
        destination: { ...line(0, "queued").destination, kind: "psychiatric_ward", unitId: origin.id },
      },
    ];
    source.movements[0].referredUnitIds = [origin.id];
    const manager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: origin.siteCode } };
    const view = projectWardPartialView(source, manager, options);
    expect(view.referrals[0]).toMatchObject({ kind: "restricted", restriction: "receiving" });
    expect(view.movements[0]).toMatchObject({ kind: "restricted", restriction: "receiving" });
  });

  it("distinguishes an active escalation from waiting for a ward without exposing its contact", () => {
    const source = fixture();
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({
      nextStep: "wait",
      progress: "awaiting_answer",
    });
    source.movements[0].escalation = {
      ...seed.movements.find((row) => row.escalation)?.escalation,
      at: NOW_ANCHOR,
      contact: "Synthetic hidden contact",
      triedUnitIds: [foreign[0].id],
    } as NonNullable<Movement["escalation"]>;
    const view = projectWardPartialView(source, access, options);
    expect(view.movements[0]).toMatchObject({ nextStep: "wait", progress: "escalated" });
    expect(JSON.stringify(view)).not.toContain("Synthetic hidden contact");
    expect(isWardPartialView(view)).toBe(true);
    source.movements[0].closure = { at: NOW_ANCHOR, outcome: "did_not_proceed", reason: "Synthetic closure" };
    expect(projectWardPartialView(source, access, options).movements[0]).toMatchObject({
      nextStep: "none",
      progress: "awaiting_answer",
    });
  });

  it("rejects unknown or contradictory movement progress", () => {
    const view = projectWardPartialView(fixture(), access, options);
    const movement = view.movements[0];
    expect(isWardPartialView({ ...view, movements: [{ ...movement, progress: "hidden_contact" }] })).toBe(false);
    expect(isWardPartialView({ ...view, movements: [{ ...movement, progress: "accepted" }] })).toBe(false);
    expect(isWardPartialView({ ...view, movements: [{ ...movement, progress: "escalated", nextStep: "refer" }] })).toBe(
      false,
    );
  });
});

describe("response-only partial-view lifetime", () => {
  const context = "a".repeat(64);
  const current = { revision: 7, accessContext: context };
  const response = () => ({ ...current, view: projectWardPartialView(fixture(), access, options) });

  it("accepts only the exact current snapshot lifetime", () => {
    const value = response();
    expect(isBoundWardPartialView(value)).toBe(true);
    expect(bindWardPartialView(value, current)).toEqual(value);
    for (const lifetime of [
      { ...current, revision: 8 },
      { ...current, revision: 6 },
      { ...current, accessContext: "b".repeat(64) },
      { revision: null, accessContext: context },
      { revision: 7, accessContext: null },
    ])
      expect(bindWardPartialView(value, lifetime)).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid revision %s",
    (revision) => {
      const value = { ...response(), revision };
      expect(isBoundWardPartialView(value)).toBe(false);
      expect(bindWardPartialView(value, { ...current, revision })).toBeNull();
    },
  );

  it.each([undefined, null, "", "a".repeat(63), "a".repeat(65), "A".repeat(64), "z".repeat(64)])(
    "rejects an absent or malformed access context %j",
    (accessContext) => {
      expect(isBoundWardPartialView({ ...response(), accessContext })).toBe(false);
    },
  );

  it("rejects unknown sibling keys and invalid views instead of retaining an earlier value", () => {
    expect(bindWardPartialView({ ...response(), command: {} }, current)).toBeNull();
    expect(bindWardPartialView({ ...response(), view: { ...response().view, state: {} } }, current)).toBeNull();
    expect(bindWardPartialView(undefined, current)).toBeNull();
    expect(bindWardPartialView(null, current)).toBeNull();
  });

  it("defensively copies and freezes every adopted object and information array", () => {
    const value = response();
    const bound = bindWardPartialView(value, current)!;
    expect(bound.view).not.toBe(value.view);
    expect(bound.view.referrals[0]).not.toBe(value.view.referrals[0]);
    expect(bound.view.movements[0]).not.toBe(value.view.movements[0]);
    for (const item of [
      bound,
      bound.view,
      bound.view.referrals,
      bound.view.movements,
      ...bound.view.referrals,
      ...bound.view.movements,
    ])
      expect(Object.isFrozen(item)).toBe(true);
    const row = bound.view.referrals[0] as SenderReferralPartialView;
    expect(Object.isFrozen(row.informationNeeds)).toBe(true);
    (value.view.referrals[0] as { state: string }).state = "declined";
    expect(row.state).toBe("queued");
    expect(() => (row.informationNeeds as string[]).push("legal_form_copy")).toThrow();
  });

  it("exposes unavailable outside the provider and on any current lifetime mismatch", () => {
    function Read() {
      const value = useWardPartialView();
      return createElement("span", null, value ? String(value.revision) : "unavailable");
    }
    const read = (value: unknown, revision: number | null, accessContext: string | null) =>
      renderToStaticMarkup(
        createElement(
          WardPartialViewProvider,
          {
            response: value,
            currentRevision: revision,
            currentAccessContext: accessContext,
          },
          createElement(Read),
        ),
      );
    expect(renderToStaticMarkup(createElement(Read))).toContain("unavailable");
    expect(read(response(), 7, context)).toBe("<span>7</span>");
    expect(read(response(), 8, context)).toContain("unavailable");
    expect(read(response(), 7, "b".repeat(64))).toContain("unavailable");
    expect(read(undefined, 7, context)).toContain("unavailable");
    expect(read(response(), null, null)).toContain("unavailable");
  });
});

describe("partial-view validation and authority separation", () => {
  const valid = () => projectWardPartialView(fixture(), access, options);

  it.each([undefined, null, {}, { version: 2, referrals: [], movements: [] }])(
    "rejects unavailable or incompatible data: %j",
    (value) => expect(isWardPartialView(value)).toBe(false),
  );

  it("rejects extra fields at every level, including nested hidden destinations", () => {
    expect(isWardPartialView({ ...valid(), destinations: [] })).toBe(false);
    for (const field of ["unitId", "destinationCount", "declineReason", "handle"]) {
      const view = valid();
      Object.assign(view.referrals[0], { [field]: "Synthetic hidden destination" });
      expect(isWardPartialView(view)).toBe(false);
    }
    const view = valid();
    Object.assign(view.movements[0], { owner: "Synthetic hidden escalation contact" });
    expect(isWardPartialView(view)).toBe(false);
    expect(
      isWardPartialView({
        version: 1,
        referrals: [{ id: "visible", kind: "restricted", restriction: "grant", state: "accepted" }],
        movements: [],
      }),
    ).toBe(false);
  });

  it("rejects duplicate rows, invalid numeric values, unknown needs and duplicate categories", () => {
    const view = valid();
    expect(isWardPartialView({ ...view, referrals: [...view.referrals, ...view.referrals] })).toBe(false);
    expect(isWardPartialView({ ...view, referrals: [{ ...sender(view), decidedAt: Number.NaN }] })).toBe(false);
    expect(isWardPartialView({ ...view, referrals: [{ ...sender(view), informationNeeds: ["unknown"] }] })).toBe(false);
    expect(
      isWardPartialView({
        ...view,
        referrals: [{ ...sender(view), informationNeeds: ["legal_form_copy", "legal_form_copy"] }],
      }),
    ).toBe(false);
  });

  it.each(["referrals", "movements", "informationNeeds"] as const)("rejects a sparse %s array", (field) => {
    const view = valid();
    const sparse = Array(1);
    const candidate =
      field === "informationNeeds"
        ? { ...view, referrals: [{ ...sender(view), informationNeeds: sparse }] }
        : { ...view, [field]: sparse };
    expect(isWardPartialView(candidate)).toBe(false);
  });

  it("does not turn structurally valid forged display hints into workflow authority", () => {
    const source = fixture([line(0, "accepted")]);
    source.movements[0].acceptedUnitId = foreign[0].id;
    source.movements[0].stage = "accepted_awaiting_bed";
    const forged = valid();
    expect(isWardPartialView(forged)).toBe(true);
    const referral = Object.assign(structuredClone(source.referrals[0]), { partialView: forged });
    const movement = Object.assign(structuredClone(source.movements[0]), { partialView: forged });
    expect(referralState(referral)).toBe("accepted");
    expect(referralWithdrawable(referral, source.movements)).toBe(false);
    expect(movementNextStep(movement)).toEqual(movementNextStep(source.movements[0]));
    expect(
      sender(projectWardPartialView({ ...source, referrals: [referral], movements: [movement] }, access, options)),
    ).toMatchObject({ state: "accepted", canWithdraw: false });
  });
});
