import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReferralNotOpenedTag } from "@/components/ward-management/referrals/referral-no-reply-flag";
import {
  NOT_OPENED_TAG,
  NOT_OPENED_TAG_MINUTES,
  referralNotOpenedUnitIds,
} from "@/components/ward-management/referrals/referral-not-opened";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Item 16 (D-133, Josh 10 Nov 2026): "Not opened yet" on the coordinator's referral list when a ward
 * sent the referral has no "Opened by" receipt after 30 minutes. A prompt only. Synthetic records.
 */
afterEach(() => {
  cleanup();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
});

const SENT = NOW_ANCHOR - 60;

function sent(arms: Partial<ReferralAddressing>[] = [{}]): Referral {
  return {
    id: "RF-SYN-NO",
    raisedAt: SENT,
    urgency: 2,
    destinations: arms.map((arm) => ({
      destination: { kind: "psychiatric_ward", unitId: "rph-adult-secure", sex: "Female" },
      state: "queued",
      referredAt: SENT,
      ...arm,
    })),
  } as unknown as Referral;
}

describe("Not opened yet", () => {
  it("shows at 30 minutes with no opened receipt, and not at 29", () => {
    expect(referralNotOpenedUnitIds(sent(), SENT + 29)).toEqual([]);
    expect(referralNotOpenedUnitIds(sent(), SENT + 30)).toEqual(["rph-adult-secure"]);
  });

  it("goes once the ward opens it, answers it, is withdrawn or puts the person on its waiting list", () => {
    const later = SENT + 120;
    expect(referralNotOpenedUnitIds(sent([{ openedAt: SENT + 5 }]), later)).toEqual([]);
    expect(referralNotOpenedUnitIds(sent([{ state: "declined" }]), later)).toEqual([]);
    expect(referralNotOpenedUnitIds(sent([{ withdrawnAt: SENT + 10 }]), later)).toEqual([]);
    expect(referralNotOpenedUnitIds(sent([{ waitlistedAt: SENT + 10 }]), later)).toEqual([]);
  });

  it("reads only named wards: an ED, a community team or a network-wide request carries no receipt", () => {
    const later = SENT + 120;
    expect(
      referralNotOpenedUnitIds(
        sent([
          { destination: { kind: "emergency_department", edId: "fsh-ed", purpose: "psychiatric_review" } },
          { destination: { kind: "psychiatric_ward", sex: "Female" } as ReferralAddressing["destination"] },
        ]),
        later,
      ),
    ).toEqual([]);
  });

  it("uses the signed 30 minutes, the figure clinical-values.md records under D-133", () => {
    expect(NOT_OPENED_TAG_MINUTES).toBe(30);
    expect(CLINICAL_VALUES.referralNotOpened).toMatchObject({
      value: 30,
      unit: "minutes",
      status: "signed",
      signedBy: "Josh (product owner)",
      signedOn: "2026-11-10",
    });
    const doc = readFileSync(path.join(process.cwd(), "docs/ward-flow/clinical-values.md"), "utf8");
    const row = doc.split("\n").find((line) => line.startsWith("|") && line.includes("`referralNotOpened`"));
    expect(row).toBeDefined();
    const cells = row!.split("|").map((cell) => cell.trim());
    expect(cells[3]).toBe("30 minutes");
    expect(cells[4]).toBe("Signed for the prototype by Josh (product owner), 2026-11-10");
    expect(cells[5]).toMatch(/^D-133 \(Josh, 10 Nov 2026\)/u);
  });

  it("renders a small worded tag on the row at 30 minutes and nothing at 29", () => {
    const { rerender } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralNotOpenedTag referral={sent()} now={SENT + 29} testId="tag" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("tag")).not.toBeInTheDocument();
    rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralNotOpenedTag referral={sent()} now={SENT + 30} testId="tag" />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("tag")).toHaveTextContent(NOT_OPENED_TAG);
  });

  it("shows nothing on a ward desk, whose tag title would name the other wards it went to", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferralNotOpenedTag referral={sent()} now={SENT + 30} testId="tag" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("tag")).not.toBeInTheDocument();
  });
});

describe("Not opened yet in the demo seed (D-141, Josh 11 Nov 2026)", () => {
  it("tags RF-RD06, sent to the SCGH Mental Health Unit and not opened, once the worked examples are on", () => {
    // A16-14 (Josh, 13 Nov 2026): RF-RD06 is a legal-form worked example, off by default and
    // switched on by the presenter, so the tag shows once they are on.
    const tagged = seedWardFlowState("standard", { workedExamples: true }).referrals.flatMap((referral) => {
      const unitIds = referralNotOpenedUnitIds(referral, NOW_ANCHOR);
      return unitIds.length > 0 ? [[referral.id, unitIds]] : [];
    });
    expect(tagged).toEqual([["RF-RD06", ["scgh-adult-open"]]]);
  });
});
