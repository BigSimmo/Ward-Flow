import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { WardPracticeMode } from "@/components/ward-management/demo-reset/ward-practice-mode";
import { MovementWorkflowActions } from "@/components/ward-management/movements/movement-workflow-actions";
import { WardOfflineBanner } from "@/components/ward-management/shell/ward-offline-banner";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function SharedOn({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride value={{ ...value, shared: { enabled: true, status: "ready", error: null } }}>
      {children}
    </WardFlowOverride>
  );
}

afterEach(() => {
  const stop = screen.queryByTestId("ward-practice-stop");
  if (stop) act(() => fireEvent.click(stop));
  vi.restoreAllMocks();
});

describe("Audit 24-7 (CT-17): practice is marked outside Tools", () => {
  it("shows a status line on every page while practice runs, and none once it stops", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardOfflineBanner />
        <WardPracticeMode />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-practice-line")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-practice-start"));
    const line = screen.getByTestId("ward-practice-line");
    expect(line).toHaveAttribute("role", "status");
    expect(line).toHaveTextContent("Practising: synthetic demo steps are real saves on this device. Stop in Tools.");
    fireEvent.click(screen.getByTestId("ward-practice-stop"));
    expect(screen.queryByTestId("ward-practice-line")).toBeNull();
  });

  it("never shows in the shared workspace, where practice is off", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SharedOn>
          <WardOfflineBanner />
        </SharedOn>
        <WardPracticeMode />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-practice-start"));
    expect(screen.queryByTestId("ward-practice-line")).toBeNull();
  });
});

describe("Audit 24-7 (CT-19): risky final buttons name the patient", () => {
  it("names the patient on Withdraw acceptance", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardPatientWorkspace movementId="WF-003" />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-console-withdraw-acceptance").textContent).toMatch(
      /^Withdraw acceptance for [^,]+, \S+/,
    );
  });

  it("names the patient on Release pulled bed and reopen search", () => {
    function Pulled() {
      const { movements } = useWardFlow();
      const [id] = useState(() => movements.find((m) => !m.closure && m.stage === "pulled")!.id);
      return <MovementWorkflowActions movement={movements.find((m) => m.id === id)!} />;
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Pulled />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("button", { name: /^Release pulled bed for .+ and reopen search$/ })).toBeInTheDocument();
  });

  it("names who the booking is for on Cancel booking", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PlannedAdmissionsPanel now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    fireEvent.click(within(screen.getByTestId("ward-planned-PA-SEED-01")).getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("ward-planned-cancel-confirm").textContent).toMatch(/^Cancel booking for \S/);
  });
});
