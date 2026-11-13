import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
} from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { TYPED_TEXT_NOT_KEPT, typedTextOf } from "@/components/ward-management/ward-flow-typed-text-ledger";
import { redactTypedTextForDevice } from "@/components/ward-management/ward-flow-typed-text-scrub";
import { involuntaryBedNeededForLegalStatus } from "@/components/ward-management/ward-eligibility";
import { LEGAL_STATUS_NOT_YET_RECORDED } from "@/components/ward-management/referrals/referral-send-warnings";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { TYPED_TEXT_FIXTURES } from "./helpers/ward-typed-text-fixtures";

/*
 * F-66 (RC 5.4, approved by Josh 13 Nov 2026): the demo's device copy replaced a new referral's
 * legal status with "Typed text not kept on this device". The status is picked from a list, and only
 * the exact word "Voluntary" clears the involuntary-capable bed rule, so after a reload a Voluntary
 * referral read as needing an involuntary-capable bed. A picked value is now kept; any other value
 * in the field is still replaced. Synthetic data only.
 */

const worlds = (offsetMinutes = 0) => WARD_SCENARIOS.map((scenario) => seedWardFlowStateAt(offsetMinutes, scenario));
const referralFixture = TYPED_TEXT_FIXTURES.find((fixture) => fixture.type === "RECEIVE_REFERRAL")!;

function deviceCopyWithLegalStatus(legalStatus: string) {
  const { before, event } = referralFixture.build(seedWardFlowState());
  const referral = event as Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }>;
  const picked = { ...referral, intake: { ...referral.intake!, legalStatus } } as WardFlowEvent;
  const after = wardFlowReducer(before, picked);
  const created = after.referrals.find((entry) => !before.referrals.some((old) => old.id === entry.id));
  expect(created?.intake?.legalStatus).toBe(legalStatus);
  const copy = redactTypedTextForDevice(after, typedTextOf(picked) ?? [], worlds);
  expect(copy).not.toBeNull();
  return copy!.referrals.find((entry) => entry.id === created!.id)!.intake!.legalStatus;
}

describe("F-66: a picked legal status survives the device copy", () => {
  it.each(["Voluntary", "Form 1A", "Form 3B", LEGAL_STATUS_NOT_YET_RECORDED])("keeps %s", (status) => {
    expect(deviceCopyWithLegalStatus(status)).toBe(status);
  });

  it("so a Voluntary referral still reads as voluntary after a reload", () => {
    expect(involuntaryBedNeededForLegalStatus(deviceCopyWithLegalStatus("Voluntary"))).toBe(false);
  });

  it("still replaces anything in the field that is not on the list", () => {
    expect(deviceCopyWithLegalStatus("Synthetic-free-text-legal-7c1a")).toBe(TYPED_TEXT_NOT_KEPT);
  });
});
