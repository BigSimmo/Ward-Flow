import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFeedMessage } from "@/components/ward-management/integration/hospital-feed";
import { feedSuggestion, simulatedFeedMessages } from "@/components/ward-management/integration/hospital-feed-sim";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFeedInbox } from "@/components/ward-management/tools/ward-feed-inbox";
import {
  receiveFeedMessage,
  resetFeedInboxForTests,
  startFeedScript,
  syncFeedInboxGeneration,
  useFeedInbox,
} from "@/components/ward-management/tools/ward-feed-inbox-store";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/capacity" }));
// Lets a test stand in for a shared save that has not answered yet. Null keeps the real raise.
const heldRaise = vi.hoisted(() => ({ raise: null as null | ((...args: unknown[]) => unknown) }));

vi.mock("@/components/ward-management/ward-flow-raise", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-raise")>();
  return {
    ...actual,
    useWardRaise: (role: Parameters<typeof actual.useWardRaise>[0]) => {
      const real = actual.useWardRaise(role);
      return (heldRaise.raise ?? real) as typeof real;
    },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  route.pathname = "/ward-flow/capacity";
  heldRaise.raise = null;
  act(() => resetFeedInboxForTests());
});

/*
 * Fix plan item 5 (21 Oct 2026): a synthetic hospital feed whose messages a person confirms or
 * rejects. Confirming raises the normal event; refused and duplicate messages change nothing.
 */

const seed = seedWardFlowState();
const messages = simulatedFeedMessages(seed);

describe("simulated hospital feed", () => {
  it("builds readable synthetic messages from the demo's own records, with one refusal and one repeat", () => {
    const read = messages.map(readFeedMessage);
    expect(read.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: "Refused: the record number is not a synthetic UMnnnnnn number." },
    ]);
    const ids = read.flatMap((result) => (result.ok ? [result.message.controlId] : []));
    expect(new Set(ids).size).toBe(ids.length - 1);
    expect(read.some((result) => result.ok && result.message.event === "admitted")).toBe(true);
    expect(read.some((result) => result.ok && result.message.event === "discharged")).toBe(true);
  });

  it("suggests an arrival for an admission and a departure for a discharge, matched by record number", () => {
    const suggestions = messages.flatMap((raw) => {
      const result = readFeedMessage(raw);
      return result.ok ? [feedSuggestion(result.message, seed)] : [];
    });
    expect(suggestions.some((suggestion) => suggestion.kind === "arrival")).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.kind === "departure")).toBe(true);
    expect(suggestions.find((suggestion) => suggestion.kind === "none")).toEqual({
      kind: "none",
      reason: "No person holds UM999901. Nothing to confirm.",
    });
  });

  it("refuses a message received twice, and one with a record number that is not synthetic", () => {
    const first = receiveFeedMessage(messages[0]!);
    expect(first.status).toBe("waiting");
    expect(receiveFeedMessage(messages[0]!)).toMatchObject({
      status: "refused",
      note: `Refused: message ${first.message!.controlId} was already received.`,
    });
    const notSynthetic = messages.find((raw) => !readFeedMessage(raw).ok)!;
    const refused = receiveFeedMessage(notSynthetic);
    expect(refused.status).toBe("refused");
    expect(refused.message).toBeUndefined();
  });
});

function MovementStage({ id }: { id: string }) {
  const { movements } = useWardFlowSelect("movements");
  return <output data-testid="probe-stage">{movements.find((movement) => movement.id === id)?.stage}</output>;
}

function InboxCount() {
  return <output data-testid="probe-count">{useFeedInbox().items.length}</output>;
}

describe("feed script", () => {
  it("keeps the first script until the demo world changes, so closing Tools cannot reshuffle what is to come", () => {
    function Probe() {
      return <output data-testid="probe-script">{JSON.stringify(useFeedInbox().script)}</output>;
    }
    render(<Probe />);
    act(() => syncFeedInboxGeneration(1));
    act(() => startFeedScript(["first"]));
    act(() => startFeedScript(["second"]));
    expect(screen.getByTestId("probe-script")).toHaveTextContent('["first"]');
    act(() => syncFeedInboxGeneration(2));
    expect(screen.getByTestId("probe-script")).toHaveTextContent("null");
  });
});

describe("feed inbox in Tools", () => {
  it("confirms an arrival only when a person taps Confirm, and rejecting changes nothing", async () => {
    const first = readFeedMessage(messages[0]!);
    if (!first.ok) throw new Error("first simulated message should be readable");
    const suggestion = feedSuggestion(first.message, seed);
    if (suggestion.kind !== "arrival") throw new Error("first simulated message should be an arrival");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFeedInbox />
        <MovementStage id={suggestion.movementId} />
        <InboxCount />
      </WardFlowProvider>,
    );
    const before = screen.getByTestId("probe-stage").textContent;
    fireEvent.click(screen.getByTestId("ward-feed-receive"));
    expect(screen.getByTestId("probe-count")).toHaveTextContent("1");
    expect(screen.getByTestId("probe-stage").textContent).toBe(before);

    fireEvent.click(screen.getByTestId("ward-feed-receive"));
    fireEvent.click(screen.getByTestId("ward-feed-reject-2"));
    expect(screen.getByTestId("ward-feed-item-2")).toHaveTextContent("Rejected, nothing changed");

    fireEvent.click(screen.getByTestId("ward-feed-confirm-1"));
    await waitFor(() => expect(screen.getByTestId("probe-stage")).toHaveTextContent("arrived"));
    expect(within(screen.getByTestId("ward-feed-item-1")).getByText("Confirmed")).toBeInTheDocument();
  });

  it("holds Confirm and Reject while a confirmation is still saving", async () => {
    let answer: (outcome: { status: "accepted" }) => void = () => {};
    const raise = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    heldRaise.raise = raise;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFeedInbox />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-feed-receive"));
    fireEvent.click(screen.getByTestId("ward-feed-confirm-1"));
    expect(screen.getByTestId("ward-feed-pending-1")).toHaveTextContent("Saving this confirmation.");
    const reject = screen.getByTestId("ward-feed-reject-1");
    expect(reject).toHaveAttribute("aria-disabled", "true");
    expect(reject).toHaveAttribute("aria-describedby", "ward-feed-pending-1");

    fireEvent.click(screen.getByTestId("ward-feed-confirm-1"));
    fireEvent.click(reject);
    expect(raise).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-feed-item-1")).toHaveTextContent("Waiting for a person");

    await act(async () => answer({ status: "accepted" }));
    expect(within(screen.getByTestId("ward-feed-item-1")).getByText("Confirmed")).toBeInTheDocument();
  });

  it("ties Record departure to its prompt until a destination is chosen", () => {
    const index = messages.findIndex((raw) => {
      const read = readFeedMessage(raw);
      return read.ok && feedSuggestion(read.message, seed).kind === "departure";
    });
    if (index < 0) throw new Error("the simulated feed should include a departure");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFeedInbox />
      </WardFlowProvider>,
    );
    for (let count = 0; count <= index; count += 1) fireEvent.click(screen.getByTestId("ward-feed-receive"));
    const seq = index + 1;
    const confirm = screen.getByTestId(`ward-feed-confirm-${seq}`);
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).toHaveAttribute("aria-describedby", `ward-feed-note-${seq}`);
    expect(document.getElementById(`ward-feed-note-${seq}`)).toHaveTextContent("Choose where the person went.");
  });

  it("offers no confirmation a desk would be refused, and says why", () => {
    const first = readFeedMessage(messages[0]!);
    if (!first.ok) throw new Error("first simulated message should be readable");
    const suggestion = feedSuggestion(first.message, seed);
    if (suggestion.kind !== "arrival") throw new Error("first simulated message should be an arrival");
    const otherWard = seed.units.find((unit) => unit.id !== suggestion.unitId)!;
    route.pathname = `/ward-flow/ward/${otherWard.id}`;
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFeedInbox />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-feed-receive"));
    expect(screen.getByTestId("ward-feed-confirm-1")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-feed-blocked-1")).toHaveTextContent("Open that ward to confirm it.");
    fireEvent.click(screen.getByTestId("ward-feed-confirm-1"));
    expect(screen.getByTestId("ward-feed-item-1")).toHaveAttribute("data-status", "waiting");
    unmount();
    act(() => resetFeedInboxForTests());

    route.pathname = `/ward-flow/ed/${seed.movements[0]!.originEdId}`;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFeedInbox />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-feed-receive"));
    expect(screen.getByTestId("ward-feed-confirm-1")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-feed-blocked-1")).toHaveTextContent("This desk cannot record this.");
  });
});
