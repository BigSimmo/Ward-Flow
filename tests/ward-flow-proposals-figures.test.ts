import { describe, expect, it } from "vitest";

import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { NETWORK_ON_CALL_ROLES, SERVICE_ON_CALL_ROLES } from "@/components/ward-management/on-call/on-call-roster";
import {
  alertFigures,
  delayFigures,
  onCallFigures,
  roleStatus,
} from "@/components/ward-management/flow-proposals/flow-proposal-figures";

const state = seedWardFlowState();
const now = NOW_ANCHOR;

describe("Delays proposal figures agree with the engine", () => {
  const figures = delayFigures(state.movements, state.units, now);
  const engineWaiting = delayGroups(state.movements, state.units, now).reduce((sum, g) => sum + g.movements.length, 0);

  it("counts every waiting person once, matching delayGroups and the open movements", () => {
    expect(figures.waiting).toBe(engineWaiting);
    expect(figures.waiting).toBe(state.movements.filter(isOpen).length);
  });

  it("owners and catchments each add back up to the waiting total", () => {
    expect(figures.owners.reduce((sum, owner) => sum + owner.count, 0)).toBe(figures.waiting);
    expect(figures.catchments.reduce((sum, entry) => sum + entry.total, 0)).toBe(figures.waiting);
  });

  it("over 24 h is a subset of over 8 h, and attention is a subset of waiting", () => {
    expect(figures.over24).toBeLessThanOrEqual(figures.over8);
    expect(figures.attention.length).toBeLessThanOrEqual(figures.waiting);
    expect(figures.rows[0]?.waitMinutes).toBe(Math.max(...figures.rows.map((row) => row.waitMinutes)));
  });
});

describe("Alerts proposal figures agree with the action inbox", () => {
  const figures = alertFigures(state.movements, state.units, state.referrals, now);
  const inbox = buildActionInbox(state.movements.filter(isOpen), now, state.units);

  it("lists every inbox row exactly once, split between you and other roles", () => {
    expect(figures.total).toBe(inbox.length);
    const ids = [...figures.forYou, ...figures.forOthers].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports every condition it checks, including clear ones", () => {
    expect(figures.conditionsChecked).toBe(figures.conditions.length);
    expect(figures.conditionsFiring).toBeLessThanOrEqual(figures.conditionsChecked);
  });
});

describe("On-call proposal figures", () => {
  it("counts every recorded role and names the services with none", () => {
    const figures = onCallFigures(10 * 60);
    const recorded =
      NETWORK_ON_CALL_ROLES.length + HEALTH_SERVICES.reduce((sum, s) => sum + SERVICE_ON_CALL_ROLES[s].length, 0);
    expect(figures.roles).toBe(recorded);
    expect(figures.servicesWithNone.every((s) => SERVICE_ON_CALL_ROLES[s].length === 0)).toBe(true);
  });

  it("reads overnight windows across midnight from the recorded words", () => {
    expect(roleStatus("Overnight, 20:00 to 08:00", 3 * 60)).toBe("on");
    expect(roleStatus("Overnight, 20:00 to 08:00", 8 * 60)).toBe("later");
    expect(roleStatus("Business hours only, 08:00 to 17:00", 10 * 60)).toBe("on");
    expect(roleStatus("No times recorded", 10 * 60)).toBeUndefined();
  });
});
