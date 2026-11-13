import { describe, expect, it } from "vitest";
import {
  TRAVEL_BANDS,
  SYNTHETIC_TRAVEL_BANDS,
  TRAVEL_BANDS_ARE_INVENTED,
} from "@/components/ward-management/ward-travel-bands";
import { EXTRA_TRAVEL_HOLD_MINUTES } from "@/components/ward-management/ward-model";
import { createTestJourney } from "../helpers/test-harness";

describe("Tier 1 - Feature 08: WA Travel Bands & Aeromedical Transit Hold", () => {
  it("defines all four standard Western Australian travel bands including air_transport_only", () => {
    expect(TRAVEL_BANDS).toEqual([
      "under_an_hour",
      "one_to_three_hours",
      "three_hours_or_more",
      "air_transport_only",
    ]);
  });

  it("verifies TRAVEL_BANDS_ARE_INVENTED is false under realistic WA Health model", () => {
    expect(TRAVEL_BANDS_ARE_INVENTED).toBe(false);
  });

  it("correctly models Perth Metropolitan hospitals as under_an_hour from metropolitan catchments", () => {
    const metroBands = SYNTHETIC_TRAVEL_BANDS["Perth Metropolitan"];
    expect(metroBands).toBeDefined();
    expect(metroBands?.RPH).toBe("under_an_hour");
    expect(metroBands?.SCGH).toBe("under_an_hour");
    expect(metroBands?.FSH).toBe("under_an_hour");
    expect(metroBands?.ARM).toBe("under_an_hour");
    expect(metroBands?.FRE).toBe("under_an_hour");
  });

  it("correctly models remote northern regions (Pilbara & Kimberley) as requiring air transport to Perth tertiary sites", () => {
    const pilbara = SYNTHETIC_TRAVEL_BANDS["Pilbara"];
    expect(pilbara?.RPH).toBe("air_transport_only");
    expect(pilbara?.SCGH).toBe("air_transport_only");
    expect(pilbara?.FSH).toBe("air_transport_only");

    const kimberley = SYNTHETIC_TRAVEL_BANDS["Kimberley"];
    expect(kimberley?.BRM).toBe("under_an_hour"); // Local Broome Hospital
    expect(kimberley?.RPH).toBe("air_transport_only");
  });

  it("verifies EXTRA_TRAVEL_HOLD_MINUTES equals 60 and extends bed pull hold for remote transit", () => {
    expect(EXTRA_TRAVEL_HOLD_MINUTES).toBe(60);

    const standardJourney = createTestJourney({ extendedHold: false });
    const standardExpiresAt = standardJourney.currentMovement().pullExpiresAt!;

    const extendedJourney = createTestJourney({ extendedHold: true });
    const extendedExpiresAt = extendedJourney.currentMovement().pullExpiresAt!;

    expect(extendedExpiresAt).toBe(standardExpiresAt + EXTRA_TRAVEL_HOLD_MINUTES);
  });
});
