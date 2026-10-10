import { describe, expect, it } from "vitest";

import {
  broadcastDraftBaseline,
  isBroadcastDraftDirty,
  parseBroadcastDraft,
  serialiseBroadcastDraft,
} from "@/components/ward-management/alerts/broadcast-draft";
import { WA_BROADCAST_TEMPLATES } from "@/components/ward-management/alerts/ward-broadcast-model";

const TEMPLATE_ID = WA_BROADCAST_TEMPLATES[0]!.id;

describe("broadcast draft: whole-form dirtiness", () => {
  it("is clean for an untouched template and for an untouched custom form", () => {
    expect(isBroadcastDraftDirty(broadcastDraftBaseline(TEMPLATE_ID))).toBe(false);
    expect(isBroadcastDraftDirty(broadcastDraftBaseline("custom"))).toBe(false);
  });

  it.each([
    ["title", { title: "Edited headline" }],
    ["message", { message: "Edited body" }],
    ["severity", { severity: "advisory" as const }],
    ["scope", { scope: "forensic" as const }],
    ["duration", { durationMinutes: 60 }],
    ["category", { category: "ed_surge" as const }],
  ])("is dirty when only the %s changes", (_name, change) => {
    const base = broadcastDraftBaseline("custom");
    const draft = { ...base, ...change };
    expect(isBroadcastDraftDirty(draft)).toBe(true);
  });

  it("treats a custom-template title-only edit as dirty (the old message-only check missed it)", () => {
    expect(isBroadcastDraftDirty({ ...broadcastDraftBaseline("custom"), title: "Only a title" })).toBe(true);
  });
});

describe("broadcast draft: round trip", () => {
  it("restores every field exactly", () => {
    const draft = {
      ...broadcastDraftBaseline(TEMPLATE_ID),
      title: "T",
      message: "M",
      severity: "warning" as const,
      scope: "adolescent" as const,
      durationMinutes: 480,
    };
    expect(parseBroadcastDraft(serialiseBroadcastDraft(draft))).toEqual(draft);
  });

  it.each([
    ["not json", "{"],
    ["not an object", "42"],
    ["missing fields", JSON.stringify({ title: "x", message: "y" })],
    ["unknown severity", JSON.stringify({ ...broadcastDraftBaseline("custom"), severity: "loud" })],
    ["unknown scope", JSON.stringify({ ...broadcastDraftBaseline("custom"), scope: "everywhere" })],
    ["unknown template", JSON.stringify({ ...broadcastDraftBaseline("custom"), templateId: "nope" })],
    ["bad duration", JSON.stringify({ ...broadcastDraftBaseline("custom"), durationMinutes: -5 })],
  ])("rejects a malformed draft instead of restoring part of it: %s", (_name, raw) => {
    expect(parseBroadcastDraft(raw)).toBeUndefined();
  });

  it("counts a changed alert type as unsaved and restores it (global alerts, 10 Oct 2026)", () => {
    const bedCall = { ...broadcastDraftBaseline(TEMPLATE_ID), kind: "bed_call" as const };
    expect(isBroadcastDraftDirty(bedCall)).toBe(true);
    expect(parseBroadcastDraft(serialiseBroadcastDraft(bedCall))?.kind).toBe("bed_call");
    expect(parseBroadcastDraft(JSON.stringify({ ...bedCall, kind: "pull_now" }))).toBeUndefined();
  });
});
