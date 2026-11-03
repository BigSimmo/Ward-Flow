// tests/ward-catchment-resolver.dom.test.tsx
//
// Tests for the WA suburb-to-catchment lookup:
// 1. Suburb search (exact and case-insensitive)
// 2. Postcode search
// 3. Health service and hospital mapping (NMHS, EMHS, SMHS, WACHS)
// 4. Contested suburb handling
// 5. Non-existent query handling
// 6. The one Suburb lookup card (D-91): quick picks, postcodes, contested and not-found answers, Clear.
//
// The old Tools resolver view (`WardCatchmentResolver`) went with the Tools overhaul (#1316); Tools now
// draws the shared SuburbLookupCard, so its UI cases are re-pointed at that card. The engine still
// lives in ward-catchment-query.ts. Synthetic catchment data only.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveCatchmentQuery,
  resolveSuburb,
  formatCatchmentSummary,
} from "@/components/ward-management/tools/ward-catchment-query";
import { mapClinicToServiceAndHospital } from "@/components/ward-management/tools/ward-catchment-mapping";
import { SuburbLookupCard } from "@/components/ward-management/community/community-suburb-lookup-card";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("resolveCatchmentQuery & resolveSuburb - Suburb Search", () => {
  it("resolves exact suburb names correctly", () => {
    // 1. Morley (EMHS)
    const morley = resolveCatchmentQuery("Morley");
    expect(morley.type).toBe("suburb");
    expect(morley.results).toHaveLength(1);
    const morleyRes = morley.results[0];
    expect(morleyRes.suburb).toBe("Morley");
    expect(morleyRes.postcodes).toContain("6062");
    expect(morleyRes.healthService.code).toBe("EMHS");
    expect(morleyRes.healthService.name).toContain("East Metropolitan");
    expect(morleyRes.primaryHospital).toContain("Royal Perth Hospital");
    expect(morleyRes.communityClinic).toBe("Inner City");
    expect(morleyRes.status).toBe("Reviewed clinic match");

    // 2. Alexander Heights (NMHS)
    const alex = resolveCatchmentQuery("Alexander Heights");
    expect(alex.type).toBe("suburb");
    const alexRes = alex.results[0];
    expect(alexRes.suburb).toBe("Alexander Heights");
    expect(alexRes.postcodes).toContain("6064");
    expect(alexRes.healthService.code).toBe("NMHS");
    expect(alexRes.communityClinic).toBe("Mirrabooka");
    expect(alexRes.primaryHospital).toContain("Graylands");
    expect(alexRes.status).toBe("Reviewed clinic match");

    // 3. Fremantle (SMHS)
    const freo = resolveCatchmentQuery("Fremantle");
    expect(freo.type).toBe("suburb");
    const freoRes = freo.results[0];
    expect(freoRes.suburb).toBe("Fremantle");
    expect(freoRes.postcodes).toContain("6160");
    expect(freoRes.healthService.code).toBe("SMHS");
    expect(freoRes.primaryHospital).toContain("Fiona Stanley");
    expect(freoRes.communityClinic).toBe("Alma Street (Fremantle)");
    expect(freoRes.status).toBe("Reviewed clinic match");

    // 4. Armadale (EMHS)
    const armadale = resolveCatchmentQuery("Armadale");
    expect(armadale.type).toBe("suburb");
    const armRes = armadale.results[0];
    expect(armRes.suburb).toBe("Armadale");
    expect(armRes.postcodes).toContain("6112");
    expect(armRes.healthService.code).toBe("EMHS");
    expect(armRes.primaryHospital).toContain("Armadale");
    expect(armRes.communityClinic).toContain("Mead Centre");
    expect(armRes.status).toBe("Reviewed clinic match");

    // 5. Joondalup (NMHS)
    const jhc = resolveCatchmentQuery("Joondalup");
    expect(jhc.type).toBe("suburb");
    const jhcRes = jhc.results[0];
    expect(jhcRes.suburb).toBe("Joondalup");
    expect(jhcRes.postcodes).toContain("6027");
    expect(jhcRes.healthService.code).toBe("NMHS");
    expect(jhcRes.primaryHospital).toContain("Joondalup");
    expect(jhcRes.communityClinic).toBe("Joondalup");
    expect(jhcRes.status).toBe("Reviewed clinic match");

    // 6. Rockingham (SMHS)
    const rgh = resolveCatchmentQuery("Rockingham");
    expect(rgh.type).toBe("suburb");
    const rghRes = rgh.results[0];
    expect(rghRes.suburb).toBe("Rockingham");
    expect(rghRes.postcodes).toContain("6168");
    expect(rghRes.healthService.code).toBe("SMHS");
    expect(rghRes.primaryHospital).toContain("Rockingham");
    expect(rghRes.communityClinic).toBe("Rockingham");
    expect(rghRes.status).toBe("Reviewed clinic match");
  });

  it("resolves suburbs case-insensitively with leading/trailing whitespace", () => {
    const q1 = resolveCatchmentQuery("   morley   ");
    expect(q1.results[0]?.suburb).toBe("Morley");

    const q2 = resolveCatchmentQuery("ALEXANDER HEIGHTS");
    expect(q2.results[0]?.suburb).toBe("Alexander Heights");

    const q3 = resolveCatchmentQuery("fReManTLe");
    expect(q3.results[0]?.suburb).toBe("Fremantle");

    const q4 = resolveCatchmentQuery("  aRmAdAlE  ");
    expect(q4.results[0]?.suburb).toBe("Armadale");
  });

  it("resolves recorded suburb aliases onto canonical names", () => {
    // "Alexander" is aliased to "Alexander Heights"
    const alias1 = resolveCatchmentQuery("Alexander");
    expect(alias1.results[0]?.suburb).toBe("Alexander Heights");

    // "Mt Richan" is aliased to "Mt Richon"
    const alias2 = resolveCatchmentQuery("Mt Richan");
    expect(alias2.results[0]?.suburb).toBe("Mt Richon");

    // "Quinns Rock" is aliased to "Quinns Rocks"
    const alias3 = resolveCatchmentQuery("Quinns Rock");
    expect(alias3.results[0]?.suburb).toBe("Quinns Rocks");
  });
});

describe("resolveCatchmentQuery - Postcode Search", () => {
  it("finds all suburbs within a 4-digit postcode (e.g. 6064)", () => {
    const query = resolveCatchmentQuery("6064");
    expect(query.type).toBe("postcode");
    expect(query.results.length).toBeGreaterThanOrEqual(4);

    const suburbNames = query.results.map((r) => r.suburb);
    expect(suburbNames).toContain("Alexander Heights");
    expect(suburbNames).toContain("Girrawheen");
    expect(suburbNames).toContain("Koondoola");
    expect(suburbNames).toContain("Marangaroo");

    // All these suburbs belong to Mirrabooka clinic in NMHS
    for (const r of query.results) {
      expect(r.healthService.code).toBe("NMHS");
      expect(r.primaryHospital).toContain("Graylands");
      expect(r.communityClinic).toBe("Mirrabooka");
    }
  });

  it("finds suburbs in single-suburb postcode (e.g. 6160 -> Fremantle)", () => {
    const query = resolveCatchmentQuery("6160");
    expect(query.type).toBe("postcode");
    expect(query.results).toHaveLength(1);
    expect(query.results[0].suburb).toBe("Fremantle");
    expect(query.results[0].healthService.code).toBe("SMHS");
  });

  it("finds suburbs in multi-suburb postcode 6112 (Armadale area)", () => {
    const query = resolveCatchmentQuery("6112");
    expect(query.type).toBe("postcode");
    expect(query.results.length).toBeGreaterThan(1);
    const names = query.results.map((r) => r.suburb);
    expect(names).toContain("Armadale");
    expect(names).toContain("Bedfordale");
    expect(names).toContain("Forrestdale");
  });

  it("returns not-found for an invalid or out-of-scope postcode", () => {
    const query = resolveCatchmentQuery("9999");
    expect(query.type).toBe("not-found");
    expect(query.results).toHaveLength(0);
    expect(query.notFoundMessage).toContain("No WA catchment records found for postcode");
  });
});

describe("Health Service & Hospital Mapping", () => {
  it("maps North Metro (NMHS) clinics and hospitals accurately", () => {
    // Joondalup
    const jhc = mapClinicToServiceAndHospital("Joondalup");
    expect(jhc.code).toBe("NMHS");
    expect(jhc.hospital).toBe("Joondalup Health Campus");

    // Clarkson
    const clarkson = mapClinicToServiceAndHospital("Clarkson");
    expect(clarkson.code).toBe("NMHS");
    expect(clarkson.hospital).toBe("Joondalup Health Campus");

    // Mirrabooka
    const mirrabooka = mapClinicToServiceAndHospital("Mirrabooka");
    expect(mirrabooka.code).toBe("NMHS");
    expect(mirrabooka.hospital).toContain("Graylands");

    // Osborne Park / Osborne
    const osborne = mapClinicToServiceAndHospital("Osborne");
    expect(osborne.code).toBe("NMHS");
    expect(osborne.hospital).toContain("Graylands");

    // Subiaco
    const subiaco = mapClinicToServiceAndHospital("Subiaco");
    expect(subiaco.code).toBe("NMHS");
    expect(subiaco.hospital).toContain("Graylands");
  });

  it("maps East Metro (EMHS) clinics and hospitals accurately", () => {
    // Armadale / Mead Centre
    const arm = mapClinicToServiceAndHospital("Mead Centre (Armadale)");
    expect(arm.code).toBe("EMHS");
    expect(arm.hospital).toContain("Armadale Health Service");

    // Bentley / Mills Street
    const bentley = mapClinicToServiceAndHospital("Bentley");
    expect(bentley.code).toBe("EMHS");
    expect(bentley.hospital).toContain("Bentley Hospital");

    // Midland / Swan
    const midland = mapClinicToServiceAndHospital("Midland");
    expect(midland.code).toBe("EMHS");
    expect(midland.hospital).toContain("St John of God Midland");

    // Inner City / ICC
    const inner = mapClinicToServiceAndHospital("Inner City");
    expect(inner.code).toBe("EMHS");
    expect(inner.hospital).toContain("Royal Perth Hospital");
  });

  it("maps South Metro (SMHS) clinics and hospitals accurately", () => {
    // Alma Street / Fremantle
    const alma = mapClinicToServiceAndHospital("Alma Street (Cockburn)");
    expect(alma.code).toBe("SMHS");
    expect(alma.hospital).toContain("Fiona Stanley Hospital");

    // Rockingham
    const rgh = mapClinicToServiceAndHospital("Rockingham");
    expect(rgh.code).toBe("SMHS");
    expect(rgh.hospital).toBe("Rockingham General Hospital");

    // Peel
    const peel = mapClinicToServiceAndHospital("Peel");
    expect(peel.code).toBe("SMHS");
    expect(peel.hospital).toContain("Peel Health Campus");
  });

  it("maps WACHS (Country Health) regions and regional hospitals accurately", () => {
    // Bunbury
    const bun = mapClinicToServiceAndHospital("Bunbury");
    expect(bun.code).toBe("WACHS");
    expect(bun.hospital).toBe("Bunbury Hospital");

    // Albany
    const alb = mapClinicToServiceAndHospital("Lower Great Southern");
    expect(alb.code).toBe("WACHS");
    expect(alb.hospital).toBe("Albany Health Campus");

    // Northam / Wheatbelt
    const northam = mapClinicToServiceAndHospital("Northam");
    expect(northam.code).toBe("WACHS");
    expect(northam.hospital).toContain("Northam Hospital");

    // Geraldton / Midwest
    const ger = mapClinicToServiceAndHospital("Geraldton HS");
    expect(ger.code).toBe("WACHS");
    expect(ger.hospital).toBe("Geraldton Hospital (Metro receiving: SCGH)");

    // Kalgoorlie / Goldfields
    const kal = mapClinicToServiceAndHospital("Nth Goldfield HS");
    expect(kal.code).toBe("WACHS");
    expect(kal.hospital).toContain("Kalgoorlie Health Campus");

    // Broome / Kimberley
    const brm = mapClinicToServiceAndHospital("Kimberley HS");
    expect(brm.code).toBe("WACHS");
    expect(brm.hospital).toContain("Broome Hospital");

    // Pilbara / North West
    const pilb = mapClinicToServiceAndHospital("North West");
    expect(pilb.code).toBe("WACHS");
    expect(pilb.hospital).toContain("Hedland Health Campus");
  });
});

describe("Contested & Inconsistent Suburb Handling", () => {
  it("handles Halls Head as contested with discrepancy details and caveats", () => {
    const res = resolveCatchmentQuery("Halls Head");
    expect(res.results).toHaveLength(1);
    const item = res.results[0];
    expect(item.suburb).toBe("Halls Head");
    expect(item.status).toBe("Contested / split");
    expect(item.caveats).toBeDefined();
    expect(item.caveats).toContain("Peel versus Rockingham");
    expect(item.contestedAnswers).toHaveLength(2);

    const docIds = item.contestedAnswers?.map((a) => a.documentId);
    expect(docIds).toContain("S2015");
    expect(docIds).toContain("S2023");
  });

  it("handles Calista as contested between Peel/Rockingham and Rockingham Kwinana", () => {
    const res = resolveCatchmentQuery("Calista");
    expect(res.results).toHaveLength(1);
    const item = res.results[0];
    expect(item.suburb).toBe("Calista");
    expect(item.status).toBe("Contested / split");
    expect(item.caveats).toBeDefined();
  });

  it("handles Woodbridge which is split within one document (6168 vs 6056)", () => {
    const res = resolveCatchmentQuery("Woodbridge");
    expect(res.results).toHaveLength(1);
    const item = res.results[0];
    expect(item.suburb).toBe("Woodbridge");
    expect(item.status).toBe("Contested / split");
    expect(item.postcodes).toContain("6168");
    expect(item.postcodes).toContain("6056");
    expect(item.contestedAnswers).toHaveLength(2);
  });

  it("handles Belmont as unreviewed with internal inconsistency notes", () => {
    const res = resolveCatchmentQuery("Belmont");
    expect(res.results).toHaveLength(1);
    const item = res.results[0];
    expect(item.suburb).toBe("Belmont");
    expect(item.status).toBe("Unreviewed");
    expect(item.caveats).toContain("Mills Street");
  });
});

describe("Non-existent & Empty Queries", () => {
  it("handles empty query strings cleanly", () => {
    const empty1 = resolveCatchmentQuery("");
    expect(empty1.type).toBe("empty");
    expect(empty1.results).toHaveLength(0);

    const empty2 = resolveCatchmentQuery("   ");
    expect(empty2.type).toBe("empty");
    expect(empty2.results).toHaveLength(0);
  });

  it("handles non-existent suburb gracefully with suggestions", () => {
    const res = resolveCatchmentQuery("Narnia Nowhere");
    expect(res.type).toBe("not-found");
    expect(res.results).toHaveLength(0);
    expect(res.notFoundMessage).toContain("No WA catchment records found matching");
  });
});

describe("formatCatchmentSummary", () => {
  it("formats a clean copyable clinical summary for reviewed suburb", () => {
    const morley = resolveSuburb("Morley");
    expect(morley).not.toBeNull();
    const summary = formatCatchmentSummary(morley!);

    expect(summary).toContain("WA Mental Health Catchment Summary");
    expect(summary).toContain("not a verified referral destination");
    expect(summary).toContain("Clinic sources:");
    expect(summary).toContain("Hospital and service mappings are not verified by these clinic sources");
    expect(summary).toContain("Suburb: Morley");
    expect(summary).toContain("Postcode: 6062");
    expect(summary).toContain("Health Service (unverified prototype mapping): East Metropolitan Health Service (EMHS)");
    expect(summary).toContain("Hospital (unverified prototype mapping): Royal Perth Hospital");
    expect(summary).toContain("Follow-up Community Clinic: Inner City");
    expect(summary).toContain("Clinic Match Status: Reviewed clinic match");
  });

  it("includes discrepancy details for contested suburb", () => {
    const hallsHead = resolveSuburb("Halls Head");
    expect(hallsHead).not.toBeNull();
    const summary = formatCatchmentSummary(hallsHead!);

    expect(summary).toContain("Suburb: Halls Head");
    expect(summary).toContain("Clinic Match Status: Contested / split");
    expect(summary).toContain("Caveats / Notes:");
    expect(summary).toContain("Discrepancy details:");
  });
});

describe("Suburb lookup card (the Tools sheet's Suburb lookup, D-91)", () => {
  function field() {
    return screen.getByRole("searchbox", { name: "Suburb or postcode" }) as HTMLInputElement;
  }

  it("opens empty, and a quick pick fills the box and answers with that suburb's team", () => {
    render(<SuburbLookupCard picks={["Morley", "Fremantle"]} />);
    expect(field().value).toBe("");
    expect(screen.getByText("Type a suburb or a 4-digit postcode.")).toBeDefined();
    const morley = screen.getByRole("button", { name: "Morley" });
    expect(morley).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(morley);
    expect(field().value).toBe("Morley");
    expect(morley).toHaveAttribute("aria-pressed", "true");
    const answer = screen.getByRole("region", { name: "Morley" });
    expect(answer.textContent).toContain("6062");
    expect(within(answer).getByText("Reviewed")).toBeDefined();
    expect(within(answer).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("lists every suburb filed under a postcode, each answering on its own", () => {
    render(<SuburbLookupCard />);
    fireEvent.change(field(), { target: { value: "6064" } });
    expect(screen.getByText(/suburbs filed under 6064/u).textContent).toMatch(/^4 suburbs/u);
    // The first three answer, then Show more brings in the rest.
    expect(screen.getByRole("region", { name: "Alexander Heights" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Girrawheen" }).textContent).toContain("Mirrabooka");
    expect(screen.getAllByRole("region", { name: /Alexander Heights|Girrawheen|Koondoola|Marangaroo/u })).toHaveLength(
      3,
    );
    fireEvent.click(screen.getByRole("button", { name: /Show 1 more suburbs/u }));
    for (const suburb of ["Alexander Heights", "Girrawheen", "Koondoola", "Marangaroo"]) {
      expect(screen.getByRole("region", { name: suburb })).toBeDefined();
    }
  });

  it("names no single team for a contested suburb, and shows its note and every reading", () => {
    render(<SuburbLookupCard teamActions={() => <button type="button">Refer to this team</button>} />);
    fireEvent.change(field(), { target: { value: "Halls Head" } });
    const answer = screen.getByRole("region", { name: "Halls Head" });
    expect(within(answer).getByText("Contested")).toBeDefined();
    expect(answer.textContent).toContain("Peel versus Rockingham");
    expect(within(answer).getByRole("list", { name: "Readings for Halls Head" })).toBeDefined();
    // A team's own actions are never drawn for a contested suburb.
    expect(within(answer).queryByRole("button", { name: "Refer to this team" })).toBeNull();
  });

  it("says Not found for a suburb with no catchment record, and an unfiled postcode in words", () => {
    render(<SuburbLookupCard />);
    fireEvent.change(field(), { target: { value: "Atlantis" } });
    expect(within(screen.getByRole("region", { name: "Atlantis" })).getByText("Not found")).toBeDefined();
    fireEvent.change(field(), { target: { value: "0001" } });
    expect(screen.getByText("No suburb is filed under postcode 0001 in the catchment documents.")).toBeDefined();
  });

  it("clears the box with Clear and returns to the empty prompt", () => {
    render(<SuburbLookupCard />);
    fireEvent.change(field(), { target: { value: "Fremantle" } });
    expect(screen.getByRole("region", { name: "Fremantle" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(field().value).toBe("");
    expect(screen.getByText("Type a suburb or a 4-digit postcode.")).toBeDefined();
  });
});
