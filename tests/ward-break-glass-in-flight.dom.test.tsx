import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * A2-04 (UI audit, 10 Nov 2026): "Open read only" on the break glass form stays off from the tap
 * until the server replies, so a double tap sends one request, not two. The shared workspace path
 * is the one that sends a request; the fresh sign-in is supplied, so the step runs straight away.
 * Synthetic data only: a made-up record id and no patient details.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/people/synthetic",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../src/components/ward-management/shell/ward-access-context", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/shell/ward-access-context")>();
  return { ...actual, useUnscopedWardFlow: () => ({ now: 0, units: [] }) };
});

import { BreakGlassForm } from "../src/components/ward-management/shell/ward-access";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "../src/components/ward-management/shell/ward-shared-access-context";
import { StepUpReauthContext } from "../src/components/ward-management/shell/ward-step-up";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";

const WARD_DESK: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("break glass while its request is in flight (A2-04)", () => {
  it("sends one request for a double tap and turns the button back on after the reply", async () => {
    let reply: (refusal: string | null) => void = () => {};
    const breakGlass = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          reply = resolve;
        }),
    );
    const api = { breakGlass } as unknown as SharedAccessApi;
    render(
      <StepUpReauthContext.Provider value={async () => {}}>
        <SharedAccessContext.Provider value={{ api, actorId: "synthetic-actor" }}>
          <BreakGlassForm access={WARD_DESK} patientId="PT-SYNTHETIC" />
        </SharedAccessContext.Provider>
      </StepUpReauthContext.Provider>,
    );
    const open = screen.getByTestId("ward-break-glass-open");
    expect(open).toBeDisabled();
    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect(open).toBeEnabled();

    // Two taps in the same moment, before React redraws the button.
    act(() => {
      open.click();
      open.click();
    });
    expect(breakGlass).toHaveBeenCalledTimes(1);
    expect(open).toBeDisabled();
    fireEvent.click(open);
    expect(breakGlass).toHaveBeenCalledTimes(1);

    // The server refuses, so the form stays and the button comes back for another try.
    await act(async () => reply("Not opened."));
    expect(open).toBeEnabled();
    expect(breakGlass).toHaveBeenCalledTimes(1);
  });
});
