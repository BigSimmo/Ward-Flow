import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/ward/rph-adult-secure" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { useDesk } from "@/components/ward-management/shell/use-desk";

/** D-222, D-223: the shell's desk, the one session source for permits and the History stamp. */
describe("useDesk", () => {
  it("keeps the coordinator's route lens, records the coordinator, and lets it switch desk", () => {
    navigation.pathname = "/ward/rph-adult-secure";
    const { result } = renderHook(() => useDesk());
    expect(result.current).toMatchObject({ role: "coordinator", actsAs: "ward", canSwitch: true });
    expect(result.current.access.role).toBe("coordinator");
  });

  it("acts as the coordinator on the coordinator's own routes", () => {
    navigation.pathname = "/capacity";
    const { result } = renderHook(() => useDesk());
    expect(result.current).toMatchObject({ role: "coordinator", actsAs: "coordinator" });
  });
});
