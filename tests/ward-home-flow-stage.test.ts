// Home flow (Q340, Q345, 3 Nov 2026): a movement sits in the Flow stage its recorded stage names.
import { describe, expect, it } from "vitest";
import { flowStageOf } from "@/components/ward-management/coordinator/priority-queue";

type Movement = Parameters<typeof flowStageOf>[0];
const at = (stage: Movement["stage"], extra: Partial<Movement> = {}) => ({ stage, ...extra }) as Movement;

describe("Home flow stages", () => {
  it("files each recorded movement stage under its Flow stage", () => {
    expect(flowStageOf(at("placement_requested"))).toBe("bed");
    expect(flowStageOf(at("destination_review"))).toBe("bed");
    expect(flowStageOf(at("accepted_awaiting_bed"))).toBe("agreed");
    expect(flowStageOf(at("pulled"))).toBe("agreed");
    expect(flowStageOf(at("handover_ready"))).toBe("ready");
    expect(flowStageOf(at("moving"))).toBe("moving");
  });

  it("keeps a patient with an arrival plan in their own stage until they are moving", () => {
    // SET_ARRIVAL_DETAILS can record a plan before collection and leaves the stage unchanged.
    const plan = { arrivalDetails: {} } as Partial<Movement>;
    expect(flowStageOf(at("pulled", plan))).toBe("agreed");
    expect(flowStageOf(at("handover_ready", plan))).toBe("ready");
  });
});
