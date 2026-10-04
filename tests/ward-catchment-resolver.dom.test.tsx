// tests/ward-catchment-resolver.test.ts
//
// Tests for the WA Suburb-to-Catchment Resolver:
// 1. Suburb search (exact and case-insensitive)
// 2. Postcode search
// 3. Health service and hospital mapping (NMHS, EMHS, SMHS, WACHS)
// 4. Contested suburb handling
// 5. Non-existent query handling
// 6. UI component interactions, quick-picks, clear button, and clipboard formatting.

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WardCatchmentResolver,
  resolveCatchmentQuery,
  resolveSuburb,
  mapClinicToServiceAndHospital,
  formatCatchmentSummary,
  QUICK_PICK_SUBURBS,
} from "@/components/ward-management/tools/ward-catchment-resolver";

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
    expect(morleyRes.status).toBe("Reviewed direct match");

    // 2. Alexander Heights (NMHS)
    const alex = resolveCatchmentQuery("Alexander Heights");
    expect(alex.type).toBe("suburb");
    const alexRes = alex.results[0];
    expect(alexRes.suburb).toBe("Alexander Heights");
    expect(alexRes.postcodes).toContain("6064");
    expect(alexRes.healthService.code).toBe("NMHS");
    expect(alexRes.communityClinic).toBe("Mirrabooka");
    expect(alexRes.primaryHospital).toContain("Graylands");
    expect(alexRes.status).toBe("Reviewed direct match");

    // 3. Fremantle (SMHS)
    const freo = resolveCatchmentQuery("Fremantle");
    expect(freo.type).toBe("suburb");
    const freoRes = freo.results[0];
    expect(freoRes.suburb).toBe("Fremantle");
    expect(freoRes.postcodes).toContain("6160");
    expect(freoRes.healthService.code).toBe("SMHS");
    expect(freoRes.primaryHospital).toContain("Fiona Stanley");
    expect(freoRes.communityClinic).toBe("Alma Street (Fremantle)");
    expect(freoRes.status).toBe("Reviewed direct match");

    // 4. Armadale (EMHS)
    const armadale = resolveCatchmentQuery("Armadale");
    expect(armadale.type).toBe("suburb");
    const armRes = armadale.results[0];
    expect(armRes.suburb).toBe("Armadale");
    expect(armRes.postcodes).toContain("6112");
    expect(armRes.healthService.code).toBe("EMHS");
    expect(armRes.primaryHospital).toContain("Armadale");
    expect(armRes.communityClinic).toContain("Mead Centre");
    expect(armRes.status).toBe("Reviewed direct match");

    // 5. Joondalup (NMHS)
    const jhc = resolveCatchmentQuery("Joondalup");
    expect(jhc.type).toBe("suburb");
    const jhcRes = jhc.results[0];
    expect(jhcRes.suburb).toBe("Joondalup");
    expect(jhcRes.postcodes).toContain("6027");
    expect(jhcRes.healthService.code).toBe("NMHS");
    expect(jhcRes.primaryHospital).toContain("Joondalup");
    expect(jhcRes.communityClinic).toBe("Joondalup");
    expect(jhcRes.status).toBe("Reviewed direct match");

    // 6. Rockingham (SMHS)
    const rgh = resolveCatchmentQuery("Rockingham");
    expect(rgh.type).toBe("suburb");
    const rghRes = rgh.results[0];
    expect(rghRes.suburb).toBe("Rockingham");
    expect(rghRes.postcodes).toContain("6168");
    expect(rghRes.healthService.code).toBe("SMHS");
    expect(rghRes.primaryHospital).toContain("Rockingham");
    expect(rghRes.communityClinic).toBe("Rockingham");
    expect(rghRes.status).toBe("Reviewed direct match");
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
    expect(summary).toContain("Suburb: Morley");
    expect(summary).toContain("Postcode: 6062");
    expect(summary).toContain("Health Service: East Metropolitan Health Service (EMHS)");
    expect(summary).toContain("Primary Admitting Hospital: Royal Perth Hospital");
    expect(summary).toContain("Follow-up Community Clinic: Inner City");
    expect(summary).toContain("Catchment Status: Reviewed direct match");
  });

  it("includes discrepancy details for contested suburb", () => {
    const hallsHead = resolveSuburb("Halls Head");
    expect(hallsHead).not.toBeNull();
    const summary = formatCatchmentSummary(hallsHead!);

    expect(summary).toContain("Suburb: Halls Head");
    expect(summary).toContain("Catchment Status: Contested / split");
    expect(summary).toContain("Caveats / Notes:");
    expect(summary).toContain("Discrepancy Details:");
  });
});

describe("WardCatchmentResolver React Component UI", () => {
  it("renders search input, empty state, and quick-pick buttons", () => {
    render(React.createElement(WardCatchmentResolver));

    expect(screen.getByRole("heading", { name: "WA Suburb-to-Catchment Resolver" })).toBeDefined();
    expect(screen.getByLabelText("Search by Suburb or Postcode")).toBeDefined();
    expect(screen.getByTestId("catchment-empty-state")).toBeDefined();

    for (const suburb of QUICK_PICK_SUBURBS) {
      expect(screen.getByRole("button", { name: suburb })).toBeDefined();
    }
  });

  it("clicking a quick-pick button immediately displays the result card", () => {
    render(React.createElement(WardCatchmentResolver));

    const morleyButton = screen.getByRole("button", { name: "Morley" });
    fireEvent.click(morleyButton);

    const input = screen.getByLabelText("Search by Suburb or Postcode") as HTMLInputElement;
    expect(input.value).toBe("Morley");

    expect(screen.getByTestId("catchment-result-card")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Morley" })).toBeDefined();
    expect(screen.getByText(/Postcode: 6062/)).toBeDefined();
    expect(screen.getByTestId("health-service-pill").textContent).toContain("EMHS");
    expect(screen.getByTestId("primary-hospital-value").textContent).toContain("Royal Perth Hospital");
    expect(screen.getByTestId("community-clinic-value").textContent).toContain("Inner City");
    expect(screen.getByTestId("catchment-status-badge").textContent).toContain("Reviewed direct match");
  });

  it("searching by postcode displays multiple suburb tabs and updates active card", () => {
    render(React.createElement(WardCatchmentResolver, { initialQuery: "6064" }));

    expect(screen.getByText(/4 suburbs in postcode 6064/)).toBeDefined();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(4);

    // Initial card is Alexander Heights
    expect(screen.getByRole("heading", { name: "Alexander Heights" })).toBeDefined();

    // Click Girrawheen tab
    const girrawheenTab = screen.getByRole("tab", { name: "Girrawheen" });
    fireEvent.click(girrawheenTab);

    // Now active card is Girrawheen
    expect(screen.getByRole("heading", { name: "Girrawheen" })).toBeDefined();
    expect(screen.getByTestId("community-clinic-value").textContent).toBe("Mirrabooka");
  });

  it("displays contested caveats when searching contested suburb", () => {
    render(React.createElement(WardCatchmentResolver, { initialQuery: "Halls Head" }));

    expect(screen.getByRole("heading", { name: "Halls Head" })).toBeDefined();
    expect(screen.getByTestId("catchment-status-badge").textContent).toContain("Contested / split");
    const caveats = screen.getByTestId("catchment-caveats-box");
    expect(caveats.textContent).toContain("Peel versus Rockingham");
  });

  it("displays not-found state when query has no matches", () => {
    render(React.createElement(WardCatchmentResolver, { initialQuery: "Atlantis" }));

    expect(screen.getByTestId("catchment-not-found")).toBeDefined();
    expect(screen.getByText(/No WA catchment records found matching "Atlantis"/)).toBeDefined();
  });

  it("clears search input and returns to empty state when clear button is clicked", () => {
    render(React.createElement(WardCatchmentResolver, { initialQuery: "Fremantle" }));

    expect(screen.getByRole("heading", { name: "Fremantle" })).toBeDefined();
    const clearBtn = screen.getByRole("button", { name: "Clear search query" });
    fireEvent.click(clearBtn);

    const input = screen.getByLabelText("Search by Suburb or Postcode") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.getByTestId("catchment-empty-state")).toBeDefined();
  });

  it("copies summary to clipboard and shows visual feedback 'Copied!'", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(React.createElement(WardCatchmentResolver, { initialQuery: "Armadale" }));

    const copyBtn = screen.getByTestId("copy-summary-button");
    expect(copyBtn.textContent).toContain("Copy summary");

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      expect(copyBtn.textContent).toContain("Copied!");
    });

    const copiedCall = writeTextMock.mock.calls[0][0];
    expect(copiedCall).toContain("Suburb: Armadale");
    expect(copiedCall).toContain("East Metropolitan Health Service (EMHS)");
  });
});
