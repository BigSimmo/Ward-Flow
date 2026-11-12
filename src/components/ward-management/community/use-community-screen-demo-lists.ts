/*
 * The community team screen's demonstration cohort lists, filtered by the same chips the desktop
 * lists show. Used only when the page is in demonstration mode.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { useCallback, useMemo, useState } from "react";
import {
  DEMO_COMMUNITY_REFERRALS,
  DEMO_COMMUNITY_INPATIENTS,
  DEMO_COMMUNITY_EGRESS,
  DEMO_COMMUNITY_CASELOAD,
} from "./community-demo-cohort";
import { originIsEdOrCrisis } from "./community-screen-helpers";
import type { CaseloadFilter, TriageFilter, InpatientFilter, EgressFilter } from "./community-screen-helpers";

export function useCommunityScreenDemoLists({
  teamId,
  triageFilter,
  inpatientFilter,
  egressFilter,
  caseloadFilter,
}: {
  teamId: string;
  triageFilter: TriageFilter;
  inpatientFilter: InpatientFilter;
  egressFilter: EgressFilter;
  caseloadFilter: CaseloadFilter;
}) {
  // Review finding 3 (12 Nov 2026): Accept or Decline on a sample row takes it off this page's
  // sample list (with Undo), so the row and every count follow. Nothing is saved anywhere.
  const [answeredDemoIds, setAnsweredDemoIds] = useState<ReadonlySet<string>>(() => new Set());
  const answerDemoReferral = useCallback((id: string) => {
    setAnsweredDemoIds((current) => new Set(current).add(id));
  }, []);
  const restoreDemoReferral = useCallback((id: string) => {
    setAnsweredDemoIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const demoTeamReferrals = useMemo(() => {
    return DEMO_COMMUNITY_REFERRALS.filter((r) => {
      if (answeredDemoIds.has(r.id)) return false;
      if (r.team && r.team !== teamId && (teamId !== "alma-street-fremantle" || r.team !== "fremantle")) return false;
      return true;
    });
  }, [teamId, answeredDemoIds]);

  const demoVisibleReferrals = useMemo(() => {
    return demoTeamReferrals.filter((r) => {
      if (triageFilter === "p1") return r.urgency === 1;
      if (triageFilter === "p2") return r.urgency === 2;
      if (triageFilter === "p3") return r.urgency === 3;
      if (triageFilter === "ed") {
        return originIsEdOrCrisis(r.origin, true);
      }
      return true;
    });
  }, [demoTeamReferrals, triageFilter]);

  const demoVisibleInpatients = DEMO_COMMUNITY_INPATIENTS.filter((i) => {
    if (inpatientFilter === "all") return true;
    return i.category === inpatientFilter;
  });

  const demoVisibleEgress = DEMO_COMMUNITY_EGRESS.filter((e) => {
    if (egressFilter === "all") return true;
    return e.status === egressFilter;
  });

  const demoVisibleCaseload = DEMO_COMMUNITY_CASELOAD.filter((c) => {
    if (caseloadFilter === "all") return true;
    if (caseloadFilter === "5A") return c.statutoryStatus.includes("5A");
    if (caseloadFilter === "5B") return c.statutoryStatus.includes("5B");
    if (caseloadFilter === "cto") return c.category.includes("cto");
    if (caseloadFilter === "high") return c.category.includes("high");
    if (caseloadFilter === "depot") return c.category.includes("depot");
    return true;
  });

  return {
    demoTeamReferrals,
    demoVisibleReferrals,
    demoVisibleInpatients,
    demoVisibleEgress,
    demoVisibleCaseload,
    answerDemoReferral,
    restoreDemoReferral,
  };
}
