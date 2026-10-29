import { afterEach, describe, expect, it, vi } from "vitest";
import { draftFingerprint } from "@/components/ward-management/referrals/referral-draft-cache";

afterEach(() => vi.restoreAllMocks());

describe("referral attachment fingerprints (WF-026 cache subcase)", () => {
  it("keeps the existing fingerprint value and ordinary recorded fields", () => {
    expect(draftFingerprint({ pending: true, chart: { base64: "QUJDRA==" } })).toBe(
      '{"pending":true,"chart":{"base64":"8:1ki7eoq"}}',
    );
    const withoutCharts = { pending: false, choices: [1, null, "synthetic"] };
    expect(draftFingerprint(withoutCharts)).toBe(JSON.stringify(withoutCharts));
  });

  it("detects changed bytes on the same attachment object and restores the original fingerprint", () => {
    const attachment = { name: "synthetic.txt", size: 4, base64: "QUJDRA==" };
    const draft = { documentation: { charts: [attachment] } };
    const original = draftFingerprint(draft);
    attachment.base64 = "QUJDRQ==";
    expect(draftFingerprint(draft)).not.toBe(original);
    attachment.base64 = "QUJDRA==";
    expect(draftFingerprint(draft)).toBe(original);
  });

  it("hashes a retained attachment once across new draft objects while other fields change", () => {
    const content = "U1lOVEhFVElDX1JFV0VSSVRFX01FTU8=";
    const attachment = { base64: content };
    const charAt = String.prototype.charCodeAt;
    let reads = 0;
    vi.spyOn(String.prototype, "charCodeAt").mockImplementation(function (this: string, index) {
      if (String(this) === content) reads += 1;
      return charAt.call(this, index);
    });
    const first = draftFingerprint({ callback: 30, charts: [attachment] });
    const second = draftFingerprint({ callback: 60, charts: [attachment] });
    expect(second).not.toBe(first);
    expect(reads).toBe(content.length);
  });

  it("does not place complete attachment text in a strongly keyed Map", () => {
    const content = "U1lOVEhFVElDX1NDT1BFRF9SRVRFTlRJT05fUFJPQkU=";
    const set = Map.prototype.set;
    let contentKeys = 0;
    vi.spyOn(Map.prototype, "set").mockImplementation(function (this: Map<unknown, unknown>, key, value) {
      if (key === content) contentKeys += 1;
      return set.call(this, key, value);
    });
    draftFingerprint({ charts: [{ base64: content }] });
    expect(contentKeys).toBe(0);
  });
});
