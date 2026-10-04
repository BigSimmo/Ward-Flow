import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * Shortlist override drafts are kept per movement. Switching the selected movement from A to B used
 * to run a render-time `clearOverrideDraft()` that, because the draft guard had already been keyed
 * to B, deleted B's saved draft and left A's. The persisted draft of the movement being arrived at
 * must survive a selection change, and the one being left must be kept for when the user returns.
 */
const KEY = (id: string) => `wf-draft:shortlist-override-${id}`;
const open = seedWardFlowState().movements.filter((movement) => isOpen(movement));
const [FIRST, SECOND] = open;

function Harness({ selectedId }: { selectedId: string }) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === selectedId);
  return (
    <ShortlistPanel
      movement={movement}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("shortlist override draft survives a movement switch", () => {
  it("has two distinct open movements, or every assertion below is vacuous", () => {
    expect(FIRST).toBeDefined();
    expect(SECOND).toBeDefined();
    expect(FIRST.id).not.toBe(SECOND.id);
  });

  it("keeps the arrived-at movement's draft and the departed movement's draft", () => {
    sessionStorage.setItem(KEY(FIRST.id), "Draft for first movement");
    sessionStorage.setItem(KEY(SECOND.id), "Draft for second movement");
    const tree = (selectedId: string) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness selectedId={selectedId} />
      </WardFlowProvider>
    );
    const { rerender } = render(tree(FIRST.id));
    expect(screen.queryByText(/Select a movement from the priority queue/)).toBeNull();
    expect(sessionStorage.getItem(KEY(FIRST.id))).toBe("Draft for first movement");

    rerender(tree(SECOND.id));
    expect(sessionStorage.getItem(KEY(SECOND.id))).toBe("Draft for second movement");
    expect(sessionStorage.getItem(KEY(FIRST.id))).toBe("Draft for first movement");

    rerender(tree(FIRST.id));
    expect(sessionStorage.getItem(KEY(FIRST.id))).toBe("Draft for first movement");
    expect(sessionStorage.getItem(KEY(SECOND.id))).toBe("Draft for second movement");
  });
});
