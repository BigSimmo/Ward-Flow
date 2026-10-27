import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyCommand, seedWorld, storableCommand } from "../backend/ward-flow/engine";
import { REFERRAL_HISTORY_LIMITS } from "../src/components/ward-management/ward-model-referral-parts";
import {
  cleanReferralFields,
  cleanReferralText,
} from "../src/components/ward-management/referrals/referral-text-clean";
import { RECEIVE_REFERRAL_CANDIDATE } from "./helpers/ward-legal-figure-sweep";

const at = new Date("2026-10-19T10:00:00Z");
const DIRTY = "  \u202Eabc\u2066 def\u0007\u0000\tline\nnext \u2069 ";

describe("P148 cleanReferralText", () => {
  it("strips bidi and C0 controls, keeps newlines and inner text, trims outer spaces", () => {
    expect(cleanReferralText(DIRTY)).toBe("abc defline\nnext");
    for (const code of [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x1f, 0x0d]) {
      expect(cleanReferralText(`a${String.fromCharCode(code)}b`)).toBe("ab");
    }
    expect(cleanReferralText("one  two\n\nthree")).toBe("one  two\n\nthree");
  });
  it("leaves a value of only invisible characters empty", () => {
    expect(cleanReferralText(" \u202E\u0001\u2069 ")).toBe("");
  });
  it("cleans only referral text fields, never codes, ids or times", () => {
    const out = cleanReferralFields({
      history: " h\u202E ",
      sendingTeamName: " T ",
      tentativeDiagnosis: " code ",
      originSiteCode: " SCGH ",
      intake: {
        reasonForReferral: "\u0001r ",
        legalStatus: " Voluntary ",
        catchment: { teamName: " team\u2066 ", confirmed: true },
        referrer: { name: " n ", email: " e ", phone: " p ", role: " r ", location: " l " },
        medicalClearance: { cleared: false, expectedAt: " t ", contactName: " c ", contactPhone: " 1 " },
        arrival: { transport: " car ", reference: " ref\u202A " },
      },
    });
    expect(out).toEqual({
      history: "h",
      sendingTeamName: "T",
      tentativeDiagnosis: " code ",
      originSiteCode: " SCGH ",
      intake: {
        reasonForReferral: "r",
        legalStatus: " Voluntary ",
        catchment: { teamName: "team", confirmed: true },
        referrer: { name: "n", email: "e", phone: "p", role: "r", location: "l" },
        medicalClearance: { cleared: false, expectedAt: " t ", contactName: "c", contactPhone: "1" },
        arrival: { transport: " car ", reference: "ref" },
      },
    });
  });
});

describe("P148 server stores new referral text cleaned, never rejects", () => {
  const command = (history: string) => ({
    ...RECEIVE_REFERRAL_CANDIDATE,
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: 642,
    history,
  });

  it("accepts and stores a referral with invisible characters, cleaned", () => {
    const stored = storableCommand({ ...command(DIRTY), sendingTeamName: " \u202ETeam A " }) as Record<string, unknown>;
    expect(stored.history).toBe("abc defline\nnext");
    expect(stored.sendingTeamName).toBe("Team A");
    const result = applyCommand(seedWorld(at), command(DIRTY), at);
    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") throw new Error("refused");
    expect(result.world.state.referrals.at(-1)?.history).toBe("abc defline\nnext");
  });
  it("measures the length limit on the cleaned value and still refuses a genuinely long one", () => {
    const limit = REFERRAL_HISTORY_LIMITS.history;
    const fits = command("x".repeat(limit) + "\u202E".repeat(10));
    expect(applyCommand(seedWorld(at), fits, at).outcome).toBe("accepted");
    expect(applyCommand(seedWorld(at), command("x".repeat(limit + 1)), at).outcome).not.toBe("accepted");
  });
  it("does not rewrite an already-stored record", () => {
    const world = seedWorld(at);
    const first = applyCommand(world, command("plain"), at);
    if (first.outcome !== "accepted") throw new Error("refused");
    const old = first.world.state.referrals.at(-1)!;
    old.history = " old\u202E text ";
    const next = applyCommand(first.world, command("new"), at);
    if (next.outcome !== "accepted") throw new Error("refused");
    expect(next.world.state.referrals.find((referral) => referral.id === old.id)?.history).toBe(" old\u202E text ");
  });
});

describe("P148 client cleans the built command", () => {
  it("cleans the intake, history and sending team before submitting", () => {
    const source = readFileSync("src/components/ward-management/referrals/use-ward-referral-drawer-state.ts", "utf8");
    expect(source).toContain("const intake: ReferralIntakeDetails = cleanReferralFields({");
    expect(source).toContain("history: cleanReferralText(unidentifiedHistory),");
    expect(source).toContain("needsSendingTeam ? cleanReferralText(sendingTeam) : undefined");
  });
});
