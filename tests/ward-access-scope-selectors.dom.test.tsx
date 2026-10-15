import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlow, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The role access scope re-provides the app context for a desk. Screens read it field by field
 * (`useWardFlowSelect`), so the scope must reach those readers too, not only whole-value readers,
 * or a ward desk would still see every ward.
 */

const unitId = seedWardFlowState().units[0].id;

function Probe() {
  const { admissions, rejections } = useWardFlowSelect("admissions", "rejections");
  const whole = useWardFlow();
  return (
    <p>
      <span data-testid="field-admissions">{admissions.length}</span>
      <span data-testid="whole-admissions">{whole.admissions.length}</span>
      <span data-testid="field-rejections">{rejections.length}</span>
    </p>
  );
}

function renderScoped() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <Probe />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("role access scope and field readers", () => {
  it("a ward desk's field readers see the same scoped workspace as whole-value readers", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
    });
    renderScoped();
    expect(screen.getByTestId("whole-admissions").textContent).not.toBe(String(seedWardFlowState().admissions.length));
    expect(screen.getByTestId("field-admissions").textContent).toBe(screen.getByTestId("whole-admissions").textContent);
    expect(screen.getByTestId("field-rejections").textContent).toBe("0");
  });

  it("with the flag off every reader sees the whole workspace", () => {
    renderScoped();
    expect(screen.getByTestId("field-admissions").textContent).toBe(String(seedWardFlowState().admissions.length));
    expect(screen.getByTestId("whole-admissions").textContent).toBe(String(seedWardFlowState().admissions.length));
  });
});
