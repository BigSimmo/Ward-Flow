import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useSinceLastLook } from "../src/components/ward-management/coordinator/since-last-look-panel";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "../src/components/ward-management/shell/ward-shared-access-context";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

it("keeps reviewed digest baselines separate for both desk access and the selected ward", () => {
  sessionStorage.clear();
  const state = seedWardFlowStateAt(0);
  function Probe({ ward }: { ward: string }) {
    const { markSeen } = useSinceLastLook(state, 642, { scopeKey: `ward:${ward}`, explicit: true });
    return <button onClick={markSeen}>Mark reviewed</button>;
  }
  const fixture = (scopeKey: string, ward: string) => (
    <SharedAccessContext.Provider value={{ actorId: "synthetic-account", scopeKey, api: {} as SharedAccessApi }}>
      <Probe ward={ward} />
    </SharedAccessContext.Provider>
  );
  const { rerender } = render(fixture("desk-one", state.units[0]!.id));
  fireEvent.click(screen.getByRole("button"));
  const first = Object.keys(sessionStorage);
  rerender(fixture("desk-one", state.units[1]!.id));
  fireEvent.click(screen.getByRole("button"));
  expect(Object.keys(sessionStorage)).toHaveLength(first.length + 1);
  rerender(fixture("desk-two", state.units[1]!.id));
  fireEvent.click(screen.getByRole("button"));
  expect(Object.keys(sessionStorage)).toHaveLength(first.length + 2);
  expect(sessionStorage.getItem(first[0]!)).not.toBeNull();
});
