import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { pushSheet, popSheet } from "@/components/wf/sheet-focus";
import { showEveryoneWaiting } from "./helpers/ward-home-queue";
vi.mock("@/components/ward-management/coordinator/home-layout", () => ({ useHomeLayout: () => "phone" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
afterEach(() => {
  popSheet("audit-guide");
  document.querySelector("[data-audit-guide]")?.remove();
  cleanup();
});
it("leaves the Home selected work open when an overlay owns Escape", async () => {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
  // Home flow (Q340/Q345, main 3 Nov 2026): the rows are under Flow, which replaced the Open filter.
  showEveryoneWaiting();
  const rows = screen.getAllByTestId(/^ward-queue-row-/);
  expect(rows.length).toBeGreaterThan(0);
  fireEvent.click(rows[0]!);
  await waitFor(() => expect(screen.queryByTestId("ward-home-placement")).not.toBeNull());
  const guide = document.createElement("div");
  guide.dataset.auditGuide = "";
  document.body.append(guide);
  pushSheet("audit-guide", guide);
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByTestId("ward-home-placement")).not.toBeNull();
  popSheet("audit-guide");
  guide.remove();
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByTestId("ward-home-placement")).toBeNull();
});
