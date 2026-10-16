import { act, fireEvent, render, screen } from "@testing-library/react";
import { memo } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardAccessScope, useSmallNumber } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  WardFlowProvider,
  useWardFlow,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
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

const renders = { lists: 0 };

/** Reads two scoped lists: one the scope always empties, one it filters to the desk's wards. */
const ListReader = memo(function ListReader() {
  const { rejections, bedReleases } = useWardFlowSelect("rejections", "bedReleases");
  // eslint-disable-next-line react-hooks/immutability -- counts this reader's renders for the test
  renders.lists += 1;
  return <span>{rejections.length + bedReleases.length}</span>;
});

/** Outside the scope: sends an event the reducer refuses, which changes only the rejection log. */
function RefusedDriver() {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  const now = useWardFlowClock();
  return (
    <button
      type="button"
      data-testid="refused"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "ward", now, minutes: 15 })}
    >
      <span data-testid="refusals">{rejections.length}</span>
    </button>
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

  it("a scoped desk's list readers do not re-render for an unrelated change", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RefusedDriver />
        <WardAccessScope>
          <ListReader />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    const before = renders.lists;
    fireEvent.click(screen.getByTestId("refused"));
    expect(screen.getByTestId("refusals").textContent).toBe("1");
    expect(renders.lists).toBe(before);
  });

  it("words an executive's small headline counts as fewer than five, and no other desk's", () => {
    function Count() {
      const small = useSmallNumber();
      return (
        <span data-testid="counts">
          {small(3)},{small(0)},{small(12)}
        </span>
      );
    }
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    const { unmount } = render(<Count />);
    expect(screen.getByTestId("counts").textContent).toBe("fewer than 5,0,12");
    unmount();
    act(() => setWardAccess({ role: "coordinator", scope: { kind: "statewide" } }));
    render(<Count />);
    expect(screen.getByTestId("counts").textContent).toBe("3,0,12");
  });
});
