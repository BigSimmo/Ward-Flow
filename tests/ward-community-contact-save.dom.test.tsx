import { createRef, useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";
import { CommunityScreenNoteModal } from "@/components/ward-management/community/community-screen-modals";
import {
  SharedWorkspaceClient,
  type SharedView,
  type SharedSnapshot,
} from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { useCommunityContactSave } from "@/components/ward-management/community/use-community-contact-save";

vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useOptionalWardFlowSelect: () => undefined,
}));

const at = 640 as Instant;
const ready = { enabled: true, status: "ready" as const, error: null };
const unavailable = { enabled: true, status: "unavailable" as const, error: "Save is not confirmed." };
const answer = (status: WardCommandOutcome["status"], message?: string): WardCommandOutcome => ({
  commandId: "synthetic-contact-command",
  status,
  message,
});
function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<WardCommandOutcome>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function unconfirmed(
  confirmation: Promise<WardCommandOutcome>,
  extra: Partial<WardCommandOutcome> = {},
): WardCommandOutcome {
  const outcome = { ...answer("failed"), confirmation, ...extra };
  return outcome;
}

type HarnessProps = {
  dispatch: WardCommandDispatch;
  shared?: WardFlowContextValue["shared"];
  teamId?: string;
  generation?: number;
  onAccepted?: (source: string) => void;
};
function Harness({ dispatch, shared = ready, teamId = "synthetic-team", generation = 1, onAccepted }: HarnessProps) {
  const [modal, setModal] = useState<"contact" | null>("contact");
  const [quick, setQuick] = useState("");
  const save = useCommunityContactSave({
    dispatch,
    now: at,
    teamId,
    generation,
    shared,
    onAccepted: (source) => {
      onAccepted?.(source);
      if (source === "modal") setModal(null);
      else setQuick("Team contact logged.");
    },
    onQuickMessage: setQuick,
  });
  const view = {
    now: at,
    team: { name: "Synthetic team" },
    teamConfig: { name: "Synthetic team" },
    activeModalType: modal,
    setActiveModalType: setModal,
    contactRecord: save.contactRecord,
    contactSaveMessage: save.contactSaveMessage,
    contactSaveDisabled: save.contactSaveDisabled,
    handleSaveClinicalContact: () => save.saveContact("modal"),
    noteModalRef: createRef<HTMLDivElement>(),
    noteModalOverlayRef: createRef<HTMLDivElement>(),
    waitingReferrals: [],
    caseloadRows: [],
    recordedCtoCount: 0,
  } as unknown as CommunityScreenView;
  return (
    <>
      <CommunityScreenNoteModal view={view} />
      <button onClick={() => save.saveContact("quick")}>Contacted quick action</button>
      <span data-testid="confirmed-contact">{save.contactRecord ? "recorded" : "not recorded"}</span>
      <p data-testid="quick-feedback">{quick}</p>
    </>
  );
}
const saveButton = () => screen.getByTestId("ward-community-contact-save");
const confirmed = () => screen.getByTestId("confirmed-contact");

describe("community contact command confirmation", () => {
  it("keeps the real dialog open until acceptance and blocks repeated modal and quick submits", async () => {
    const pending = deferred(),
      dispatch = vi.fn(() => pending.promise);
    render(<Harness dispatch={dispatch} />);
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    fireEvent.click(screen.getByText("Contacted quick action"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    expect(confirmed()).toHaveTextContent("not recorded");
    await act(async () => pending.resolve(answer("accepted")));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(confirmed()).toHaveTextContent(/^recorded$/);
  });

  it.each(["refused", "cancelled"] as const)(
    "retains an editable dialog and no recorded claim for %s",
    async (status) => {
      render(<Harness dispatch={() => Promise.resolve(answer(status, "Synthetic contact was not applied."))} />);
      fireEvent.click(saveButton());
      await waitFor(() => expect(saveButton()).not.toHaveAttribute("aria-disabled", "true"));
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(screen.getByRole("status")).toHaveTextContent("Synthetic contact was not applied.");
      expect(screen.getByTestId("ward-community-contact-save-status")).toHaveAttribute("data-recorded", "false");
    },
  );

  it("retains a failed draft and confirms original-ID Retry without a scoped event log", async () => {
    const terminal = deferred();
    const dispatch = vi.fn(() => Promise.resolve(unconfirmed(terminal.promise)));
    const { rerender } = render(<Harness dispatch={dispatch} />);
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed."));
    rerender(<Harness dispatch={dispatch} shared={unavailable} />);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(saveButton());
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => terminal.resolve(answer("accepted")));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(confirmed()).toHaveTextContent(/^recorded$/);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("does not infer acceptance from a recovered board or another command's confirmation", async () => {
    const own = deferred(),
      other = deferred();
    const dispatch = vi.fn(() => Promise.resolve(unconfirmed(own.promise)));
    const { rerender } = render(<Harness dispatch={dispatch} />);
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed."));
    rerender(<Harness dispatch={dispatch} shared={unavailable} />);
    await act(async () => other.resolve({ ...answer("accepted"), commandId: "another-contact" }));
    rerender(<Harness dispatch={dispatch} />);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(confirmed()).toHaveTextContent("not recorded");
    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    await act(async () => own.resolve(answer("accepted")));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("makes a refused Retry terminal through later polls and other confirmations", async () => {
    const own = deferred(),
      other = deferred();
    const dispatch = vi.fn(() => Promise.resolve(unconfirmed(own.promise)));
    const { rerender } = render(<Harness dispatch={dispatch} />);
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed."));
    await act(async () => own.resolve(answer("refused", "Synthetic contact refusal.")));
    expect(saveButton()).not.toHaveAttribute("aria-disabled", "true");
    await act(async () => other.resolve({ ...answer("accepted"), commandId: "another-contact" }));
    rerender(<Harness dispatch={dispatch} />);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(confirmed()).toHaveTextContent("not recorded");
    expect(screen.getByRole("status")).toHaveTextContent("Synthetic contact refusal.");
  });

  it("keeps a legacy adapter's failed draft until connection recovery without claiming acceptance", async () => {
    const pending = deferred();
    const dispatch = vi.fn(() => pending.promise);
    const { rerender } = render(<Harness dispatch={dispatch} />);
    fireEvent.click(saveButton());
    rerender(<Harness dispatch={dispatch} shared={unavailable} />);
    await act(async () => pending.resolve(answer("failed")));
    expect(saveButton()).toHaveAttribute("aria-disabled", "true");
    rerender(<Harness dispatch={dispatch} />);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(confirmed()).toHaveTextContent("not recorded");
    expect(saveButton()).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed.");
  });

  it("only announces quick-action success after acceptance and reports quick failures", async () => {
    const pending = deferred(),
      onAccepted = vi.fn(),
      dispatch = vi.fn(() => pending.promise);
    render(<Harness dispatch={dispatch} onAccepted={onAccepted} />);
    fireEvent.click(screen.getByText("Contacted quick action"));
    expect(screen.getByTestId("quick-feedback")).toHaveTextContent("Saving contact");
    expect(onAccepted).not.toHaveBeenCalled();
    await act(async () => pending.resolve(answer("refused", "Synthetic refusal")));
    expect(screen.getByTestId("quick-feedback")).toHaveTextContent("Synthetic refusal");
    expect(onAccepted).not.toHaveBeenCalled();
    expect(confirmed()).toHaveTextContent("not recorded");
  });

  it("confirms quick-action success without closing an unrelated contact dialog", async () => {
    const pending = deferred();
    render(<Harness dispatch={() => pending.promise} />);
    fireEvent.click(screen.getByText("Contacted quick action"));
    await act(async () => pending.resolve(answer("accepted")));
    expect(screen.getByTestId("quick-feedback")).toHaveTextContent("Team contact logged.");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(confirmed()).toHaveTextContent(/^recorded$/);
  });

  it.each(["team", "world"] as const)("ignores delayed acceptance after the %s changes", async (changed) => {
    const pending = deferred(),
      onAccepted = vi.fn(),
      dispatch = vi.fn(() => pending.promise);
    const { rerender } = render(<Harness dispatch={dispatch} onAccepted={onAccepted} />);
    fireEvent.click(saveButton());
    rerender(
      <Harness
        dispatch={dispatch}
        onAccepted={onAccepted}
        teamId={changed === "team" ? "other-synthetic-team" : undefined}
        generation={changed === "world" ? 2 : 1}
      />,
    );
    await act(async () => pending.resolve(answer("accepted")));
    expect(onAccepted).not.toHaveBeenCalled();
    expect(confirmed()).toHaveTextContent("not recorded");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("ignores an answer from an ended command lifetime", async () => {
    const pending = deferred(),
      onAccepted = vi.fn();
    render(<Harness dispatch={() => pending.promise} onAccepted={onAccepted} />);
    fireEvent.click(saveButton());
    await act(async () => pending.resolve({ ...answer("accepted"), isCurrent: () => false }));
    expect(onAccepted).not.toHaveBeenCalled();
    expect(confirmed()).toHaveTextContent("not recorded");
    expect(saveButton()).not.toHaveAttribute("aria-disabled", "true");
  });

  it.each(["throw", "reject", "void"] as const)(
    "reports %s dispatch failure without a recorded claim",
    async (kind) => {
      const dispatch: WardCommandDispatch = () => {
        if (kind === "throw") throw new Error("Synthetic failure");
        if (kind === "reject") return Promise.reject(new Error("Synthetic failure"));
        return undefined;
      };
      render(<Harness dispatch={dispatch} shared={{ enabled: false, status: "ready", error: null }} />);
      fireEvent.click(saveButton());
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed."));
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(confirmed()).toHaveTextContent("not recorded");
      expect(saveButton()).not.toHaveAttribute("aria-disabled", "true");
    },
  );

  it.each(["throw", "reject", "void"] as const)(
    "releases a shared %s failure with no command ID so the retained form can be submitted again",
    async (kind) => {
      const dispatch = vi.fn<WardCommandDispatch>(() => {
        if (kind === "throw") throw new Error("Synthetic failure");
        if (kind === "reject") return Promise.reject(new Error("Synthetic failure"));
        return undefined;
      });
      render(<Harness dispatch={dispatch} />);
      fireEvent.click(saveButton());
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed."));
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(confirmed()).toHaveTextContent("not recorded");
      expect(saveButton()).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(saveButton());
      await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    },
  );

  it.each(["failed", "refused"] as const)(
    "keeps the last confirmed contact after a second same-minute contact is %s",
    async (status) => {
      const dispatch = vi
        .fn<WardCommandDispatch>()
        .mockReturnValueOnce(answer("accepted"))
        .mockResolvedValueOnce(answer(status, "Second contact was not applied."));
      render(<Harness dispatch={dispatch} />);
      fireEvent.click(screen.getByText("Contacted quick action"));
      expect(confirmed()).toHaveTextContent(/^recorded$/);
      fireEvent.click(saveButton());
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Second contact was not applied."));
      expect(confirmed()).toHaveTextContent(/^recorded$/);
      const last = screen.getByTestId("ward-community-contact-save-status");
      expect(last).toHaveAttribute("data-recorded", "true");
      expect(last).toHaveTextContent("Last confirmed contact");
      expect(screen.getByRole("dialog")).toBeVisible();
    },
  );

  it("confirms a failed quick action only from its own terminal completion", async () => {
    const terminal = deferred();
    const dispatch = vi.fn(() => Promise.resolve(unconfirmed(terminal.promise)));
    render(<Harness dispatch={dispatch} />);
    fireEvent.click(screen.getByText("Contacted quick action"));
    await waitFor(() => expect(screen.getByTestId("quick-feedback")).toHaveTextContent("Save is not confirmed."));
    fireEvent.click(screen.getByText("Contacted quick action"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => terminal.resolve(answer("accepted")));
    expect(screen.getByTestId("quick-feedback")).toHaveTextContent("Team contact logged.");
    expect(confirmed()).toHaveTextContent(/^recorded$/);
  });

  it("ignores terminal completion after the failed command lifetime ends", async () => {
    let current = true;
    const terminal = deferred();
    const dispatch = vi.fn(() => Promise.resolve(unconfirmed(terminal.promise, { isCurrent: () => current })));
    const onAccepted = vi.fn();
    render(<Harness dispatch={dispatch} onAccepted={onAccepted} />);
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed."));
    current = false;
    await act(async () => terminal.resolve(answer("accepted")));
    expect(onAccepted).not.toHaveBeenCalled();
    expect(confirmed()).toHaveTextContent("not recorded");
  });

  it("does not run acceptance callbacks after unmount", async () => {
    const pending = deferred(),
      onAccepted = vi.fn();
    const { unmount } = render(<Harness dispatch={() => pending.promise} onAccepted={onAccepted} />);
    fireEvent.click(saveButton());
    unmount();
    await act(async () => pending.resolve(answer("accepted")));
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it("integrates a real shared-client Retry while the role-scoped UI has no event log", async () => {
    let snapshot: SharedSnapshot = {
      dataMode: "prototype",
      revision: 1,
      now: at,
      payload: {
        version: 1,
        state: seedWardFlowStateAt(0),
        dayZero: "2026-10-24T00:00:00Z",
        startedAt: "2026-10-24T10:00:00Z",
      },
    };
    let seen: SharedView, notify: ((view: SharedView) => void) | undefined;
    let drop = false;
    const teamId = COMMUNITY_TEAM_PAGES[0]!.id;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic-token",
      changed: (view) => {
        seen = view;
        notify?.(view);
      },
      fetch: async (_url, init) => {
        if (!init?.body) return Response.json({ snapshot });
        if (drop) throw new TypeError("Synthetic lost connection");
        const command = JSON.parse(String(init.body));
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          payload: { ...snapshot.payload, state: wardFlowReducer(snapshot.payload.state, command.event) },
        };
        return Response.json({ outcome: "accepted", snapshot });
      },
    });
    try {
      await client.refresh();
      function ScopedContact() {
        const [view, setView] = useState(seen);
        useEffect(() => {
          notify = setView;
          return () => {
            notify = undefined;
          };
        }, []);
        // WardAccessScope deliberately hides eventLog from community. Recovery must use the
        // exact dispatch completion instead of bypassing that recipient projection.
        return (
          <Harness
            dispatch={client.dispatchConfirmed}
            teamId={teamId}
            shared={{ enabled: true, status: view.status, error: view.error }}
          />
        );
      }
      render(<ScopedContact />);
      drop = true;
      fireEvent.click(saveButton());
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Save is not confirmed."));
      expect(saveButton()).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("dialog")).toBeVisible();
      drop = false;
      await act(async () => client.retry());
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(confirmed()).toHaveTextContent(/^recorded$/);
      expect(seen!.eventLog).toHaveLength(1);
    } finally {
      client.dispose();
    }
  });

  it("does not issue a new command while the shared board is unavailable", () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} shared={unavailable} />);
    fireEvent.click(saveButton());
    fireEvent.click(screen.getByText("Contacted quick action"));
    expect(dispatch).not.toHaveBeenCalled();
    expect(confirmed()).toHaveTextContent("not recorded");
  });
});
