import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/** D18: typed override drafts stay in memory; legacy browser caches are purged, never restored. */
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

describe("shortlist override drafts respect browser privacy", () => {
  it("has two distinct open movements, or every assertion below is vacuous", () => {
    expect(FIRST).toBeDefined();
    expect(SECOND).toBeDefined();
    expect(FIRST.id).not.toBe(SECOND.id);
  });

  it("purges legacy drafts while switching movements", () => {
    sessionStorage.setItem(KEY(FIRST.id), "Draft for first movement");
    sessionStorage.setItem(KEY(SECOND.id), "Draft for second movement");
    const tree = (selectedId: string) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness selectedId={selectedId} />
      </WardFlowProvider>
    );
    const { rerender } = render(tree(FIRST.id));
    expect(screen.queryByText(/Select a movement from the priority queue/)).toBeNull();
    expect(sessionStorage.getItem(KEY(FIRST.id))).toBeNull();

    rerender(tree(SECOND.id));
    expect(sessionStorage.getItem(KEY(SECOND.id))).toBeNull();
    expect(sessionStorage.getItem(KEY(FIRST.id))).toBeNull();

    rerender(tree(FIRST.id));
    expect(sessionStorage.getItem(KEY(FIRST.id))).toBeNull();
    expect(sessionStorage.getItem(KEY(SECOND.id))).toBeNull();
  });
});
