import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/settings",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { ToastProvider } from "@/components/wf";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { resetLocalAccessAdminForTests } from "@/components/ward-management/shell/ward-access-admin-store";
import {
  StepUpReauthContext,
  forgetStepUp,
  useStepUp,
  type StepUpResult,
} from "@/components/ward-management/shell/ward-step-up";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { sharedMembership } from "@/components/ward-management/settings/access-shared-source";
import { membershipStatus } from "@/components/ward-management/ward-access-admin";

/**
 * The Settings Access tab (role access plan, later pass): an Access admin desk gives and
 * removes roles, a nurse in charge gives cover, and each change asks to confirm it is you first.
 * Made-up demonstration staff only.
 */
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
    resetLocalAccessAdminForTests();
  });
  forgetStepUp();
});

function settings() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SettingsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function AdvanceClock() {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 120 })}
    >
      advance clock
    </button>
  );
}

function sharedSettings(api: SharedAccessApi, reauthenticate: (password: string) => Promise<void>) {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdvanceClock />
        <StepUpReauthContext.Provider value={reauthenticate}>
          <SharedAccessContext.Provider value={{ api, actorId: "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4" }}>
            <SettingsScreen />
          </SharedAccessContext.Provider>
        </StepUpReauthContext.Provider>
      </WardFlowProvider>
    </ToastProvider>,
  );
}

function confirmStepUp() {
  const dialog = screen.getByTestId("ward-step-up");
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm and carry on" }));
}

describe("the Access tab", () => {
  it("is not offered with the role-access flag off", () => {
    settings();
    expect(screen.queryByRole("radio", { name: /^Access/ })).not.toBeInTheDocument();
  });

  it("gives a statewide coordinator both cover and the roles lists", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "coordinator", scope: { kind: "statewide" } });
    });
    settings();
    fireEvent.click(screen.getByRole("radio", { name: /^Access/ }));
    expect(screen.getByTestId("ward-access-cover")).toBeInTheDocument();
    expect(screen.getByTestId("ward-access-roles")).toBeInTheDocument();
    expect(screen.getByText(/As a statewide coordinator you also give and remove roles/u)).toBeInTheDocument();
  });

  it("opens an Access admin desk on the roles list, and gives a role after a fresh confirm", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    settings();
    expect(screen.getByRole("radio", { name: /^Access/ })).toBeChecked();
    expect(screen.getByTestId("ward-access-requests")).toHaveTextContent("2 open requests");
    expect(screen.queryByTestId("ward-access-waiting")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve$/u })).not.toBeInTheDocument();
    const formerPending = screen
      .getAllByTestId("ward-access-role-row")
      .find((row) => row.textContent?.includes("Demo staff D"));
    expect(formerPending).toHaveTextContent("Active");

    fireEvent.click(screen.getByTestId("ward-access-grant-submit"));
    await act(async () => confirmStepUp());
    expect(await screen.findByTestId("ward-access-result")).toHaveTextContent("Given: Demo access admin 2");

    expect(screen.queryByTestId("ward-step-up")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-access-waiting")).not.toBeInTheDocument();
  });

  const sharedRow = (approved: boolean, kind: "role" | "cover" = "role") => ({
    id: "membership-admin",
    actorId: "synthetic-admin",
    role: "admin",
    scope: { kind: "statewide" },
    kind,
    grantedBy: "synthetic-coordinator",
    approved,
    approvedBy: null,
    minutes: { granted: -60, expires: 1440, lastUsed: null },
  });

  it("shows a grant with empty approval fields as active without inventing an approver", () => {
    const membership = sharedMembership(sharedRow(true), NOW_ANCHOR);
    expect(membership).not.toBeNull();
    expect(membership!.approvedBy).toBeNull();
    expect(membershipStatus(membership!, NOW_ANCHOR)).toBe("active");
  });

  it("shows a role an older backend still holds back as inactive, never Active", () => {
    const membership = sharedMembership(sharedRow(false), NOW_ANCHOR);
    expect(membership).not.toBeNull();
    expect(membership!.approvedBy).toBeNull();
    expect(membershipStatus(membership!, NOW_ANCHOR)).toBe("inactive");
    expect(membershipStatus(sharedMembership(sharedRow(false, "cover"), NOW_ANCHOR)!, NOW_ANCHOR)).toBe("active");
  });

  it("changes nothing when the confirm is cancelled", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    settings();
    const rows = screen.getAllByTestId("ward-access-role-row").length;
    fireEvent.click(screen.getByTestId("ward-access-grant-submit"));
    await act(async () =>
      fireEvent.click(within(screen.getByTestId("ward-step-up")).getByRole("button", { name: "Cancel" })),
    );
    expect(screen.getByTestId("ward-access-result")).toHaveTextContent("Cancelled. Nothing was changed.");
    expect(screen.getAllByTestId("ward-access-role-row")).toHaveLength(rows);
  });

  it("lets a nurse in charge give cover of their own ward, and end it", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } });
    });
    settings();
    fireEvent.click(screen.getByRole("radio", { name: /^Access/ }));
    fireEvent.click(screen.getByTestId("ward-access-cover-submit"));
    await act(async () => confirmStepUp());
    expect(screen.getByTestId("ward-access-result")).toHaveTextContent("Cover given");
    expect(readWardAccessSnapshot().covers).toHaveLength(1);
    const list = screen.getByTestId("ward-access-cover-list");
    // A statewide coordinator sees cover given by a ward inside its place, and may end it.
    act(() => setWardAccess({ role: "coordinator", scope: { kind: "statewide" } }));
    expect(
      within(screen.getByTestId("ward-access-cover-list")).getByRole("button", { name: "End cover" }),
    ).toBeInTheDocument();
    act(() => setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } }));
    // Ending it goes through the same confirm, still fresh here, so it asks nothing more.
    await act(async () => fireEvent.click(within(list).getByRole("button", { name: "End cover" })));
    expect(screen.queryByTestId("ward-step-up")).not.toBeInTheDocument();
    expect(readWardAccessSnapshot().covers).toHaveLength(0);
    expect(screen.getByTestId("ward-access-result")).toHaveTextContent("Cover ended.");
  });

  it("in the shared workspace reads roles from the server and asks for the password when it says step-up", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    const grants = ["step-up", null];
    const api: SharedAccessApi = {
      listAccess: vi.fn(async () => ({
        memberships: [
          {
            id: "3f1c9a52-8d4e-4b7a-9c2d-1e5f6a7b8c9d",
            actorId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
            role: "executive",
            scope: { kind: "statewide" },
            kind: "role" as const,
            grantedBy: "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4",
            approved: true,
            approvedBy: null,
            minutes: { granted: -60, expires: 1440, lastUsed: -5 },
          },
        ],
        requests: [],
      })),
      listCovers: vi.fn(async () => []),
      listRecordViews: vi.fn(async () => []),
      grantAccess: vi.fn(async () => grants.shift() ?? null),
      revokeAccess: vi.fn(async () => null),
      giveCover: vi.fn(async () => null),
      decideRequest: vi.fn(async () => null),
      breakGlass: vi.fn(async () => null),
    };
    const reauthenticate = vi.fn(async () => {});
    sharedSettings(api, reauthenticate);
    const roles = await screen.findByTestId("ward-access-role-row");
    expect(roles).toHaveTextContent("Account 1a2b3c4d");
    expect(roles).toHaveTextContent("Ends in 1 day. Last used 5 minutes ago.");
    // The server's times are placed once, when the list arrives, so they age with the demo clock.
    act(() => fireEvent.click(screen.getByTestId("test-advance-clock")));
    expect(screen.getByTestId("ward-access-role-row")).not.toHaveTextContent("Last used 5 minutes ago.");
    const grant = screen.getByTestId("ward-access-grant");
    fireEvent.change(within(grant).getByLabelText("Account id"), {
      target: { value: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" },
    });
    fireEvent.click(screen.getByTestId("ward-access-grant-submit"));
    const dialog = await screen.findByTestId("ward-step-up");
    // Form-friction 258: the password box takes focus, and Enter signs in.
    const password = within(dialog).getByLabelText("Password");
    await waitFor(() => expect(password).toHaveFocus());
    fireEvent.change(password, { target: { value: "synthetic-password" } });
    await act(async () => {
      fireEvent.keyDown(password, { key: "Enter" });
    });
    expect(reauthenticate).toHaveBeenCalledWith("synthetic-password");
    expect(api.grantAccess).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId("ward-access-result")).toHaveTextContent("Given: Account 1a2b3c4d");
    // A change reads the list again.
    expect(api.listAccess).toHaveBeenCalledTimes(2);
  });

  it("makes no change when the password dialog is cancelled while the sign-in is still running", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    const api: SharedAccessApi = {
      listAccess: vi.fn(async () => ({ memberships: [], requests: [] })),
      listCovers: vi.fn(async () => []),
      listRecordViews: vi.fn(async () => []),
      grantAccess: vi.fn(async () => "step-up" as const),
      revokeAccess: vi.fn(async () => null),
      giveCover: vi.fn(async () => null),
      decideRequest: vi.fn(async () => null),
      breakGlass: vi.fn(async () => null),
    };
    let signedIn = () => {};
    const reauthenticate = vi.fn(() => new Promise<void>((resolve) => (signedIn = resolve)));
    sharedSettings(api, reauthenticate);
    const grant = await screen.findByTestId("ward-access-grant");
    fireEvent.change(within(grant).getByLabelText("Account id"), {
      target: { value: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" },
    });
    fireEvent.click(screen.getByTestId("ward-access-grant-submit"));
    const dialog = await screen.findByTestId("ward-step-up");
    fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "synthetic-password" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Sign in and carry on" }));
    });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" })));
    await act(async () => signedIn());
    expect(api.grantAccess).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ward-access-result")).toHaveTextContent("Cancelled. Nothing was changed.");
  });

  it("shows the access admin a demo access log, said to be made up, and filters it in the page", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    settings();
    const log = screen.getByTestId("ward-access-log");
    expect(log).toHaveTextContent("Demo only: made-up openings by the demo staff");
    const rows = within(log).getAllByTestId("ward-access-log-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveTextContent("Demo staff A, Nurse in charge, FSH Adult Secure. 12 minutes ago.");
    fireEvent.change(within(log).getByLabelText("Find a record id or account"), { target: { value: "staff b" } });
    const left = within(log).getAllByTestId("ward-access-log-row");
    expect(left.length).toBeGreaterThan(0);
    for (const row of left) expect(row).toHaveTextContent("Demo staff B");
    fireEvent.change(within(log).getByLabelText("Find a record id or account"), { target: { value: "nobody" } });
    expect(log).toHaveTextContent("No opening matches.");
  });

  it("does not show the access log to a nurse in charge", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } });
    });
    settings();
    fireEvent.click(screen.getByRole("radio", { name: /^Access/ }));
    expect(screen.queryByTestId("ward-access-log")).not.toBeInTheDocument();
  });

  it("in the shared workspace lists the server's record openings by record id, desk and time", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    const api: SharedAccessApi = {
      listAccess: vi.fn(async () => ({ memberships: [], requests: [] })),
      listCovers: vi.fn(async () => []),
      listRecordViews: vi.fn(async () => [
        {
          id: 7,
          actor_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
          actor_role: "ed",
          actor_scope: { kind: "ed", edId: "fsh-ed" },
          patient_id: "PT-1001",
          surface: "referral",
          minutes: -90,
        },
        {
          id: 6,
          actor_id: "9e8d7c6b-5a49-4382-a1b0-c9d8e7f6a5b4",
          actor_role: "coordinator",
          actor_scope: { kind: "statewide" },
          patient_id: "PT-2002",
          surface: "patient",
          minutes: -3,
        },
        {
          id: 5,
          actor_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
          actor_role: "ed",
          actor_scope: { kind: "ed", edId: "fsh-ed" },
          patient_id: "*",
          surface: "tv",
          minutes: -2,
        },
      ]),
      grantAccess: vi.fn(async () => null),
      revokeAccess: vi.fn(async () => null),
      giveCover: vi.fn(async () => null),
      decideRequest: vi.fn(async () => null),
      breakGlass: vi.fn(async () => null),
    };
    sharedSettings(
      api,
      vi.fn(async () => {}),
    );
    const log = screen.getByTestId("ward-access-log");
    const rows = await within(log).findAllByTestId("ward-access-log-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("PT-1001, Referral detail");
    expect(rows[0]).toHaveTextContent("Account 1a2b3c4d, ED clinician");
    expect(rows[0]).toHaveTextContent("2 hours ago.");
    expect(rows[1]).toHaveTextContent("PT-2002, Patient record");
    expect(rows[1]).toHaveTextContent("You, Bed coordinator, Statewide. 3 minutes ago.");
    // H-0731: a read the server logged itself names no record.
    expect(rows[2]).toHaveTextContent("TV board sent to this desk");
    expect(rows[2]).not.toHaveTextContent("*");
    expect(log).not.toHaveTextContent("Demo only");
    expect(api.listRecordViews).toHaveBeenCalledTimes(1);
  });

  it("says plainly when the server would not give the access log", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "admin", scope: { kind: "statewide" } });
    });
    const api: SharedAccessApi = {
      listAccess: vi.fn(async () => ({ memberships: [], requests: [] })),
      listCovers: vi.fn(async () => []),
      listRecordViews: vi.fn(async () => {
        throw new Error("The record access log is not part of your role");
      }),
      grantAccess: vi.fn(async () => null),
      revokeAccess: vi.fn(async () => null),
      giveCover: vi.fn(async () => null),
      decideRequest: vi.fn(async () => null),
      breakGlass: vi.fn(async () => null),
    };
    sharedSettings(
      api,
      vi.fn(async () => {}),
    );
    const log = screen.getByTestId("ward-access-log");
    expect(await within(log).findByRole("alert")).toHaveTextContent(
      "The access log could not be read from the server.",
    );
    expect(within(log).queryByTestId("ward-access-log-row")).not.toBeInTheDocument();
  });

  it("tells a step waiting for the password that it was cancelled when a second step asks", async () => {
    const results: StepUpResult[] = [];
    function TwoSteps() {
      const { guard, dialog } = useStepUp();
      const ask = (name: string) => () =>
        void guard(async () => "step-up" as const).then((result) => results.push(`${name}: ${result}`));
      return (
        <>
          <button type="button" onClick={ask("first")}>
            first
          </button>
          <button type="button" onClick={ask("second")}>
            second
          </button>
          {dialog}
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StepUpReauthContext.Provider value={async () => {}}>
          <TwoSteps />
        </StepUpReauthContext.Provider>
      </WardFlowProvider>,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "first" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "second" })));
    expect(results).toEqual(["first: Cancelled. Nothing was changed."]);
    expect(screen.getByTestId("ward-step-up")).toBeInTheDocument();
  });
});

function renderStepUpPopup(run: () => Promise<StepUpResult>, reauthenticate: (password: string) => Promise<void>) {
  function Check() {
    const { guard, dialog } = useStepUp();
    return (
      <>
        <button type="button" onClick={() => void guard(run)}>
          Open protected action
        </button>
        {dialog}
      </>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StepUpReauthContext.Provider value={reauthenticate}>
        <Check />
      </StepUpReauthContext.Provider>
    </WardFlowProvider>,
  );
}

it("distinguishes an action error after successful sign-in from a rejected password", async () => {
  const run = vi
    .fn<() => Promise<StepUpResult>>()
    .mockResolvedValueOnce("step-up")
    .mockRejectedValueOnce(new Error("Synthetic action failure"));
  const reauthenticate = vi.fn(async () => {});
  renderStepUpPopup(run, reauthenticate);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open protected action" })));
  const password = screen.getByLabelText("Password");
  fireEvent.change(password, { target: { value: "synthetic-test-password" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign in and carry on" })));
  expect(reauthenticate).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("alert")).toHaveTextContent("The action could not be confirmed");
  expect(password).not.toHaveAttribute("aria-invalid", "true");
  expect(password).toHaveValue("");
  expect(screen.queryByText("That password was not accepted. Try again.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
});

it("keeps a rejected sign-in on the password field and does not run the protected action again", async () => {
  const run = vi.fn<() => Promise<StepUpResult>>().mockResolvedValue("step-up");
  const reauthenticate = vi.fn(async () => {
    throw new Error("Synthetic rejected sign-in");
  });
  renderStepUpPopup(run, reauthenticate);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open protected action" })));
  const password = screen.getByLabelText("Password");
  fireEvent.change(password, { target: { value: "synthetic-test-password" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign in and carry on" })));
  expect(password).toHaveAttribute("aria-invalid", "true");
  expect(password).toHaveAccessibleDescription(/That password was not accepted/);
  expect(run).toHaveBeenCalledTimes(1);
  expect(password).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
});

it("does not show a late action error in a newly opened sign-in dialog", async () => {
  let rejectAction!: (reason: Error) => void;
  const action = new Promise<StepUpResult>((_resolve, reject) => {
    rejectAction = reject;
  });
  const run = vi
    .fn<() => Promise<StepUpResult>>()
    .mockResolvedValueOnce("step-up")
    .mockImplementationOnce(() => action)
    .mockResolvedValue("step-up");
  renderStepUpPopup(run, async () => {});
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open protected action" })));
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-test-password" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign in and carry on" })));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open protected action" })));
  await act(async () => rejectAction(new Error("Synthetic late action error")));
  expect(screen.getByTestId("ward-step-up")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toHaveValue("");
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
});
