import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { transportLegalFormNotice } from "@/components/ward-management/ed/ed-blocked-reasons";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import type { LegalStatus, Movement } from "@/components/ward-management/ward-model";
import {
  collectionGaps,
  legalNowTransportStatus,
  movementTransportSiteCodes,
  packForm,
  TRANSPORT_EXCEPTION_GAP_LABELS,
} from "@/components/ward-management/ward-transport-checks";
import {
  TRANSPORT_ORDER_PATTERN,
  TRANSPORT_PAPERWORK,
  transportOrderNeeded,
  transportOrderOnFile,
} from "@/components/ward-management/ward-transport-paperwork";

/**
 * D-186 item 6, D-187 item 7, D-189 items 8(b) and 9(d) (Josh, 13 Nov 2026): one transport
 * paperwork rule. It reads the person's status, their form and both sites; a Form 4C clears the
 * order check whether it is the recorded form or an uploaded one; Form 4B and same-site moves
 * behave as today; and the check says "not signed". Synthetic records only.
 */

const ALL_STATUSES: Record<LegalStatus, true> = {
  Voluntary: true,
  "Referred for psychiatric examination": true,
  "Detained awaiting examination": true,
  "Involuntary inpatient": true,
};
const STATUSES = Object.keys(ALL_STATUSES) as LegalStatus[];

const job = (fields: Partial<Movement>) =>
  ({ referredUnitIds: [], uploadedForms: [], ...fields }) as unknown as Movement;
/** The live wards the paperwork rule reads for the destination's site. */
const UNITS = seedWardFlowState().units;
const upload = (formName: string) =>
  ({ id: formName, formName, fileName: "f.pdf", sizeBytes: 1, uploadedAt: 1 }) as never;

describe("the paperwork table is today's behaviour and not signed", () => {
  it("is labelled not signed, accepts Form 4A and 4C, and every row is today's answer", () => {
    expect(TRANSPORT_PAPERWORK.status).toBe("not signed");
    expect(TRANSPORT_PAPERWORK.acceptedOrderCodes).toEqual(["4A", "4C"]);
    // Josh, 9 Oct 2026: a voluntary transfer needs no forms; anything else, or no status, does.
    for (const row of TRANSPORT_PAPERWORK.rows) expect(row.orderNeeded).toBe(row.requirement !== "not_required");
    expect(TRANSPORT_PAPERWORK.rows).toHaveLength(9);
  });

  it("says rule not signed on the order gap, in D-170 item 5's words", () => {
    expect(TRANSPORT_EXCEPTION_GAP_LABELS.transport_order_missing).toBe(
      "Transport or transfer order not uploaded · rule not signed",
    );
  });
});

describe("a Form 4C clears the order check (D-187 item 7, D-189 item 9(d))", () => {
  const involuntary = { legalStatus: "Involuntary inpatient" as const };

  it("clears on a recorded Form 4C", () => {
    const onFourC = job({ ...involuntary, legalForm: { code: "4C", kind: "transfer" } });
    expect(transportOrderOnFile(onFourC)).toBe(true);
    expect(collectionGaps(onFourC, UNITS)).not.toContain("transport_order_missing");
    expect(transportLegalFormNotice(onFourC, UNITS)).toBeUndefined();
  });

  it("clears on an uploaded Form 4C, and the pack's order slot shows it", () => {
    const uploaded = job({ ...involuntary, uploadedForms: [upload("Form 4C Transfer order")] });
    expect(transportOrderOnFile(uploaded)).toBe(true);
    expect(collectionGaps(uploaded, UNITS)).not.toContain("transport_order_missing");
    expect(packForm(uploaded, "order")?.formName).toBe("Form 4C Transfer order");
  });

  it("still clears on Form 4A, recorded or uploaded, as one rule", () => {
    expect(
      collectionGaps(job({ ...involuntary, uploadedForms: [upload("Form 4A transport order")] }), UNITS),
    ).not.toContain("transport_order_missing");
    expect(transportLegalFormNotice(job({ ...involuntary, legalForm: { code: "4A", kind: "transport" } }), UNITS)).toBe(
      undefined,
    );
  });

  it("does not clear on Form 4B, as today (Form 4B stays open)", () => {
    const fourB = job({ ...involuntary, legalForm: { code: "4B" }, uploadedForms: [upload("Form 4B")] });
    expect(transportOrderOnFile(fourB)).toBe(false);
    expect(collectionGaps(fourB, UNITS)).toContain("transport_order_missing");
    expect(transportLegalFormNotice(fourB, UNITS)).toBe("Transport or transfer order not uploaded · rule not signed.");
  });
});

describe("the rule reads both sites, and a same-site move is treated as today", () => {
  it("gives the same answer for a same-site, a cross-site and an unknown-site move", () => {
    for (const status of STATUSES) {
      const movement = job({ legalStatus: status });
      const same = transportOrderNeeded(movement, "rph", "rph");
      expect(transportOrderNeeded(movement, "rph", "scgh")).toBe(same);
      expect(transportOrderNeeded(movement, undefined, undefined)).toBe(same);
      expect(same).toBe(isNotVoluntary(status));
    }
  });

  it("reads the origin's and the accepted ward's sites from the record", () => {
    const keiraLike = seedWardFlowState().movements.find((movement) => movement.id === "WF-004")!;
    const sites = movementTransportSiteCodes(keiraLike, UNITS);
    expect(typeof sites.origin).toBe("string");
    expect(typeof sites.destination).toBe("string");
  });

  it("reads the destination's site from the live wards it is given, never the fixture", () => {
    const keiraLike = seedWardFlowState().movements.find((movement) => movement.id === "WF-004")!;
    const accepted = UNITS.find((unit) => unit.id === keiraLike.acceptedUnitId)!;
    expect(movementTransportSiteCodes(keiraLike, UNITS).destination).toBe(accepted.siteCode);
    const moved = UNITS.map((unit) => (unit.id === accepted.id ? { ...unit, siteCode: "SYN-SITE" } : unit));
    expect(movementTransportSiteCodes(keiraLike, moved).destination).toBe("SYN-SITE");
    // A ward the caller does not hold leaves the site unknown, and the rule then asks for the order.
    expect(movementTransportSiteCodes(keiraLike, []).destination).toBeUndefined();
  });

  it("asks for an order when no status is recorded anywhere (the warning, not the decision)", () => {
    expect(transportOrderNeeded(job({}), undefined, undefined)).toBe(true);
    expect(transportLegalFormNotice(job({}), UNITS)).toBe(
      "Transport or transfer order not uploaded · rule not signed.",
    );
  });
});

describe("Legal now's transport status uses the named not-voluntary rule (D-186 item 4)", () => {
  it.each(STATUSES)("%s: the same answer as the old hand comparison", (status) => {
    const old = status === "Voluntary" ? "voluntary" : "involuntary";
    expect(legalNowTransportStatus({ legalStatus: status })).toBe(old);
    expect(legalNowTransportStatus({ legalStatus: status }) === "involuntary").toBe(isNotVoluntary(status));
  });

  it("is undefined with no status, as before", () => {
    expect(legalNowTransportStatus({ legalStatus: undefined as never })).toBeUndefined();
  });

  it("a referred person travels involuntarily and is not detained", () => {
    expect(legalNowTransportStatus({ legalStatus: "Referred for psychiatric examination" })).toBe("involuntary");
  });
});

describe("only one order matcher exists in src", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it("matches Form 4A and 4C uploads through TRANSPORT_ORDER_PATTERN, and nothing else writes one", () => {
    expect(TRANSPORT_ORDER_PATTERN.test("Form 4A Transport order")).toBe(true);
    expect(TRANSPORT_ORDER_PATTERN.test("Form 4C Transfer order")).toBe(true);
    expect(TRANSPORT_ORDER_PATTERN.test("Form 4B")).toBe(false);
    // A regex literal naming a 4A or 4C form, or a recorded-code comparison to "4A", outside the rule.
    const matcher = /\/[^/\n]*Form\\s\*\(?4[AC]|legalForm\??\.code\s*===\s*"4A"/;
    // Named exceptions: the rule itself, and D-170 item 4's sample-status rule, which reads a
    // recorded 4A to set a sample person's status and is not an order check.
    const allowed = ["ward-transport-paperwork.ts", "ward-sample-legal-status.ts"];
    const offenders = sourceFiles(join(process.cwd(), "src"))
      .filter((file) => !allowed.some((name) => file.endsWith(name)))
      .filter((file) => matcher.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
