import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  useWardFlow,
  WARD_FLOW_DEMO_STORAGE_KEY,
} from "@/components/ward-management/ward-flow-provider";
afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});
it("restores a saved care transport arrangement without resetting the world", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
  sessionStorage.clear();
  sessionStorage.setItem("wf-draft:legacy-audit", "Synthetic stale typed draft");
  const wrapper = ({ children }: { children: ReactNode }) => <WardFlowProvider>{children}</WardFlowProvider>;
  let hook = renderHook(() => useWardFlow(), { wrapper });
  expect(sessionStorage.getItem("wf-draft:legacy-audit")).toBeNull();
  const a = hook.result.current.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  act(() =>
    hook.result.current.dispatch({
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now: hook.result.current.now,
      admissionId: a.id,
      patientId: a.patientId!,
      expectedGeneration: hook.result.current.worldGeneration,
      expectedRevision: 0,
      change: {
        kind: "transport",
        mode: "taxi",
        region: "metro",
        riskDocument: true,
        authority: "none",
        escortSuitable: true,
        leastRestrictiveReviewed: true,
        regionalServiceConfirmed: true,
      },
    }),
  );
  expect(hook.result.current.admissions.find((row) => row.id === a.id)?.careJourney?.transport).toBeDefined();
  expect(sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).not.toBeNull();
  hook.unmount();
  hook = renderHook(() => useWardFlow(), { wrapper });
  expect(hook.result.current.admissions.find((row) => row.id === a.id)?.careJourney?.transport?.mode).toBe("taxi");
  hook.unmount();
});
