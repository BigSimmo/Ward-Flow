import "@testing-library/jest-dom/vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithToasts as render } from "./helpers/with-toasts";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Audit 24-7, CT-09 (notifications pass): the quick "Log team contact" sent a failed save to the
// Community toast, which closed itself after a few seconds, so the refusal could be missed. Every
// Community save failure is now a warning that stays until it is closed. Synthetic records only.
const TEAM_NAME = "Mead Centre (Armadale)";

function RefusingContact({ children }: { children: ReactNode }) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) =>
    event.type === "RECORD_CLINICAL_CONTACT"
      ? { commandId: "synthetic-contact", status: "refused", message: "Synthetic refusal." }
      : flow.dispatch(event);
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

function CreateReferral() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({ type: "REFER_TO_COMMUNITY_TEAM", role: "ed", now, movementId: "WF-003", team: TEAM_NAME })
      }
    >
      Create referral
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("a Community save that did not go through stays on screen (CT-09)", () => {
  it("shows the quick contact refusal as a warning that does not close itself", () => {
    vi.useFakeTimers();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CreateReferral />
        <RefusingContact>
          <CommunityScreen teamId={communityTeamSlug(TEAM_NAME)} />
        </RefusingContact>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Create referral" }));
    fireEvent.click(screen.getByRole("button", { name: "Log team contact" }));
    const toast = screen.getByTestId("community-action-toast");
    expect(toast).toHaveTextContent("Not recorded: Synthetic refusal.");
    expect(toast).toHaveAttribute("data-tone", "warning");
    expect(toast).not.toHaveAttribute("data-auto-dismiss");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("community-action-toast")).toHaveTextContent("Not recorded: Synthetic refusal.");
  });
});
