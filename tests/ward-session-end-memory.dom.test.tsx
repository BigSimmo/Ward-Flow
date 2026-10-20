import { afterEach, describe, expect, it } from "vitest";

import { referralDraftMemory } from "@/components/ward-management/referrals/referral-draft-lifecycle";
import {
  forgetDowntimePack,
  lastDowntimePack,
  rememberDowntimePack,
  type DowntimePack,
} from "@/components/ward-management/reports/downtime-pack";
import {
  handOffPatientSearchText,
  handOffTypedPatientQuery,
  takeHandedOffPatientQuery,
  takeHandedOffPatientSearchText,
} from "@/components/ward-management/search/patient-query-handoff";
import {
  breakGlass,
  giveCover,
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  startAccessPreview,
} from "@/components/ward-management/shell/ward-access-store";
import { endWardFlowBrowserSession } from "@/components/ward-management/ward-browser-data";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * Codex review on PR #487: clearing Web Storage at the end of a signed-in session is not enough,
 * because per-account memory held at module level outlives a sign-out in the same tab. Every such
 * store registers a reset that the session-end handler runs.
 */
const WARD_DESK: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } };
const OTHER_WARD: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } };

afterEach(() => {
  resetWardAccessStoreForTests();
  forgetDowntimePack();
  window.sessionStorage.clear();
});

describe("a signed-in session ending forgets per-account memory", () => {
  it("drops break glass records (with typed reasons), cover and previews without widening the desk", () => {
    // A coordinator breaks glass with a typed reason, gives a ward cover, then previews that ward.
    expect(
      breakGlass({
        patientId: "PT-synthetic",
        now: 100,
        windowMinutes: 30,
        reason: "other",
        otherText: "Synthetic typed reason",
        placeLabel: "Synthetic ward",
      }),
    ).not.toBeNull();
    expect(giveCover({ recipient: WARD_DESK, scope: OTHER_WARD.scope, now: 100, until: 200 })).not.toBeNull();
    startAccessPreview(WARD_DESK);
    expect(readWardAccessSnapshot().records).toHaveLength(1);
    expect(readWardAccessSnapshot().covers).toHaveLength(1);
    expect(readWardAccessSnapshot().previewOf).not.toBeNull();

    endWardFlowBrowserSession();

    const after = readWardAccessSnapshot();
    expect(after.records).toEqual([]);
    expect(after.covers).toEqual([]);
    expect(after.previewOf).toBeNull();
    // Never widened back to the statewide view: the narrower desk stays until the server says otherwise.
    expect(after.access).toEqual(WARD_DESK);
  });

  it("forgets handed-off typed text, the downtime pack and the kept referral draft", () => {
    handOffTypedPatientQuery("Synthetic Name", "given-name");
    handOffPatientSearchText("0000000");
    rememberDowntimePack({} as DowntimePack);
    referralDraftMemory.lastReferrer = { name: "Synthetic referrer" };
    expect(lastDowntimePack()).not.toBeNull();

    endWardFlowBrowserSession();

    expect(takeHandedOffPatientQuery()).toBeUndefined();
    expect(takeHandedOffPatientSearchText()).toBeUndefined();
    expect(lastDowntimePack()).toBeNull();
    expect(referralDraftMemory.lastReferrer).toBeNull();
  });

  it("clears Ward Flow storage as part of the same step", () => {
    window.sessionStorage.setItem("wardflow:access-desk-v1", JSON.stringify(WARD_DESK));
    window.sessionStorage.setItem("ward-flow-coordinator-last-look", "{}");
    endWardFlowBrowserSession();
    expect(window.sessionStorage.getItem("wardflow:access-desk-v1")).toBeNull();
    expect(window.sessionStorage.getItem("ward-flow-coordinator-last-look")).toBeNull();
  });
});
