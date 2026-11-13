import { SHOWN_TRAVEL_BANDS, type TravelBandTable } from "@/components/ward-management/ward-travel-bands";

/**
 * TESTS ONLY. An invented travel band table the tests use instead of the app's shown table
 * (A16-04, root cause R7; Josh approved 13 Nov 2026).
 *
 * The app shows only bands someone has checked (`CHECKED_TRAVEL_BANDS` in `ward-travel-bands.ts`),
 * and today nobody has, so every pair on screen reads as not recorded. Tests that need bands to
 * exercise a mechanism (the out-of-area ledger, grouping by band, the four band headings) swap
 * this table in by importing this module (`import "./helpers/ward-test-travel-bands";`), so no test
 * ever needs a value on screen to be wrong. Each test file loads its own copy of the app's modules,
 * so the swap reaches only the file that imports this helper.
 *
 * Every band here is invented and was picked by list position, never by geography. It is never
 * shown to anyone, and nothing here may be copied into `CHECKED_TRAVEL_BANDS`. Its shape is what
 * the mechanism tests need: every band used, a whole home region unrecorded that a seeded referral
 * uses, a site unrecorded inside a recorded region, two units sharing a band, and one recorded
 * out-of-area pair at an FSH unit for the out-of-area ledger tests.
 */
export const TEST_TRAVEL_BANDS: TravelBandTable = {
  "Perth Metropolitan": {
    RPH: "under_an_hour",
    SCGH: "under_an_hour",
    FSH: "three_hours_or_more",
    ARM: "under_an_hour",
    FRE: "under_an_hour",
  },
  "South West": {
    RPH: "three_hours_or_more",
    SCGH: "air_transport_only",
    BUN: "three_hours_or_more",
  },
  "Great Southern": {
    ALB: "three_hours_or_more",
  },
  "Mid West": {
    FSH: "under_an_hour",
    GER: "under_an_hour",
  },
  Pilbara: {
    SCGH: "one_to_three_hours",
  },
  Kimberley: {
    RPH: "one_to_three_hours",
    BRM: "three_hours_or_more",
  },
};

/**
 * Why a fill and not `vi.mock`: the shared setup file loads the app's reducer, and with it
 * `ward-distance.ts`, before a test file's own mocks are registered, so a mock of
 * `ward-travel-bands.ts` never reaches the lookup. Filling the one shown table object does.
 */
function installTestTravelBands(): void {
  const shown = SHOWN_TRAVEL_BANDS as Record<string, unknown>;
  for (const key of Object.keys(shown)) delete shown[key];
  Object.assign(shown, TEST_TRAVEL_BANDS);
}

installTestTravelBands();
