import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  discardReferralDraft,
  clearReferralDraftSession,
  forgetReferrerContact,
  keepReferralDraft,
  readKeptReferralDraft,
  readLastReferrerContact,
  rememberReferrerContact,
  REFERRAL_DRAFT_AUTOSAVE_MS,
  useReferralDraftAutosave,
} from "@/components/ward-management/referrals/referral-draft-store";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { useWardSupabaseShared } from "@/components/ward-management/use-ward-supabase-shared";
import { SupabaseWardAuth } from "@/components/ward-management/ward-supabase-auth";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";

// Auth and HTTP are the only stand-ins: the production shared provider, hook, client,
// sign-out/sign-in UI, scope, drawer and autosave effects all run together.
const identity = vi.hoisted(() => ({ actor: "synthetic-account-a", signedOut: 0 }));
vi.mock("@/components/ward-management/ward-supabase-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-supabase-auth")>();
  return {
    ...actual,
    SupabaseWardAuth: class {
      userId: string | null = identity.actor;
      isRecovery = false;
      async restore() {}
      async token() {
        return "synthetic-mocked-token";
      }
      captureAccessTokenForSignOut() {
        return null;
      }
      async signOut() {
        identity.signedOut += 1;
        this.userId = null;
      }
      async signIn(email: string) {
        identity.actor = email;
        this.userId = email;
      }
      async updatePassword() {}
      dispose() {}
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

function Composer({ guardClose = false }: { guardClose?: boolean }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <WardReferralDrawer
      onClose={() => {
        const confirmation = (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean })
          .__wardFlowConfirmNavigation;
        if (guardClose && confirmation?.() === false) return;
        setOpen(false);
      }}
    />
  ) : (
    <button onClick={() => setOpen(true)}>New referral probe</button>
  );
}

function OtherDirtyForm() {
  useDirtyStateGuard(true);
  return null;
}

beforeEach(() => {
  identity.actor = "synthetic-account-a";
  identity.signedOut = 0;
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_WARD_AUTH_PROVIDER", "supabase");
  vi.stubEnv("NEXT_PUBLIC_WARD_API_BASE_URL", "https://ward-flow.example.invalid");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        actorId: identity.actor,
        access: { role: "coordinator", scope: { kind: "statewide" } },
        snapshot: {
          dataMode: "prototype",
          revision: 1,
          now: NOW_ANCHOR,
          payload: {
            version: 1,
            state: seedWardFlowState(),
            dayZero: "2026-10-15T16:00:00Z",
            startedAt: "2026-10-16T02:42:00Z",
          },
        },
      }),
    ),
  );
  setWardFeatureFlagOnDevice("role-access", true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  discardReferralDraft();
  forgetReferrerContact();
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function openSharedComposer() {
  render(
    <WardFlowProvider>
      <WardAccessScope>
        <Composer />
      </WardAccessScope>
    </WardFlowProvider>,
  );
  await screen.findByRole("button", { name: "New referral probe" });
}

function typeStory() {
  fireEvent.click(screen.getByRole("button", { name: "New referral probe" }));
  fireEvent.click(screen.getByRole("button", { name: "Referral" }));
  fireEvent.change(screen.getByLabelText(/Reason for referral/), {
    target: { value: "Synthetic account A unsent story" },
  });
}

async function signInAsNextPerson() {
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(screen.queryByLabelText(/Reason for referral/)).toBeNull();
  expect(identity.signedOut).toBe(1);
  // Check before B connects: its adoption must not hide an outgoing unmount re-save.
  expect(readKeptReferralDraft()).toBeNull();
  expect(readLastReferrerContact()).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: "Sign in with email" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic-b@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("button", { name: "New referral probe" });
  expect(identity.actor).toBe("synthetic-b@example.invalid");
}

describe("referral memory belongs to the signed-in person", () => {
  it("does not restore discarded content after only changing sections in a blocked drawer", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OtherDirtyForm />
        <Composer guardClose />
      </WardFlowProvider>,
    );
    typeStory();
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Discard$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Patient" }));
    act(() => vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS));
    expect(Boolean(readKeptReferralDraft())).toBe(false);
    view.unmount();
    expect(Boolean(readKeptReferralDraft())).toBe(false);
  });

  it("never discards a kept draft for a sheet that did not write it", () => {
    keepReferralDraft({ synthetic: "kept" });
    expect(discardReferralDraft(null)).toBe(false);
    expect(readKeptReferralDraft()).toEqual({ synthetic: "kept" });
    expect(discardReferralDraft()).toBe(true);
    expect(readKeptReferralDraft()).toBeNull();
  });

  it("keeps a default Send stop permanent even after later content changes", () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ revision }) =>
        useReferralDraftAutosave({
          draft: { revision },
          draftJson: JSON.stringify({ revision }),
          enabled: true,
          dirty: true,
          initialKeptAt: null,
          initialKeptJson: null,
        }),
      { initialProps: { revision: 1 } },
    );
    act(() => result.current.stop());
    rerender({ revision: 2 });
    act(() => vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS));
    expect(Boolean(readKeptReferralDraft())).toBe(false);
    unmount();
    expect(Boolean(readKeptReferralDraft())).toBe(false);
  });

  it.each(["debounce", "unmount"])("saves new edits after another dirty form blocks Discard closing (%s)", (save) => {
    vi.useFakeTimers();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OtherDirtyForm />
        <Composer guardClose />
      </WardFlowProvider>,
    );
    typeStory();
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Discard$/ }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/Reason for referral/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS));
    expect(Boolean(readKeptReferralDraft())).toBe(false);

    fireEvent.change(screen.getByLabelText(/Reason for referral/), {
      target: { value: "Synthetic revised work after cancelled close" },
    });
    if (save === "debounce") act(() => vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS));
    else view.unmount();
    expect(Boolean(readKeptReferralDraft())).toBe(true);
  });

  it("never restores an unchanged discarded revision when a blocked drawer later unmounts", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OtherDirtyForm />
        <Composer guardClose />
      </WardFlowProvider>,
    );
    typeStory();
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Discard$/ }));
    view.unmount();
    expect(Boolean(readKeptReferralDraft())).toBe(false);
  });

  it("keeps the account barrier after a discarded drawer receives new edits", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OtherDirtyForm />
        <Composer guardClose />
      </WardFlowProvider>,
    );
    typeStory();
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: /^Discard$/ }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), {
      target: { value: "Synthetic new work before account transition" },
    });
    clearReferralDraftSession();
    act(() => vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS));
    view.unmount();
    expect(Boolean(readKeptReferralDraft())).toBe(false);
  });

  it("can save a new edit that matches a copy kept before Discard", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ revision }) =>
        useReferralDraftAutosave({
          draft: { revision },
          draftJson: JSON.stringify({ revision }),
          enabled: true,
          dirty: true,
          initialKeptAt: null,
          initialKeptJson: null,
        }),
      { initialProps: { revision: 1 } },
    );
    act(() => vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS));
    expect(Boolean(readKeptReferralDraft())).toBe(true);
    rerender({ revision: 2 });
    act(() => {
      result.current.stop({ resumeOnContentEdit: true });
      discardReferralDraft();
    });
    rerender({ revision: 1 });
    act(() => vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS));
    expect(Boolean(readKeptReferralDraft())).toBe(true);
  });

  it("drops kept text and sender contact before another account opens a referral", async () => {
    await openSharedComposer();
    rememberReferrerContact({
      name: "Synthetic account A sender",
      email: "synthetic-a@example.invalid",
      phone: "0000000000",
      role: "Synthetic role A",
      location: "Synthetic place A",
    });
    typeStory();
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep draft" }));
    await signInAsNextPerson();
    expect(readKeptReferralDraft()).toBeNull();
    expect(readLastReferrerContact()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New referral probe" }));
    fireEvent.click(screen.getByRole("button", { name: "Referral" }));
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Preview letter" }));
    expect(screen.getByTestId("ward-referral-letter-preview")).not.toHaveTextContent("Synthetic account A sender");
  });

  it("cannot resurrect a pending draft when sign-out unmounts its autosave", async () => {
    await openSharedComposer();
    typeStory();
    // No debounce or Keep action has run. The old drawer's unmount must not re-save A's draft.
    await signInAsNextPerson();
    await waitFor(() => expect(readKeptReferralDraft()).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "New referral probe" }));
    fireEvent.click(screen.getByRole("button", { name: "Referral" }));
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("");
  });

  it("still keeps and reopens a draft within the same signed-in account", async () => {
    await openSharedComposer();
    typeStory();
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep draft" }));
    fireEvent.click(screen.getByRole("button", { name: "New referral probe" }));
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("Synthetic account A unsent story");
    expect(identity.signedOut).toBe(0);
  });

  it("retains same-account memory when a password update reconnects its client", async () => {
    const { result } = renderHook(() => useWardSupabaseShared(true));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const draft = { story: "Synthetic same-account draft" };
    const contact = { name: "Synthetic same-account sender" };
    keepReferralDraft(draft);
    rememberReferrerContact(contact);
    await act(async () => {
      await result.current.credentials.updatePassword("synthetic-updated-password");
    });
    expect(readKeptReferralDraft()).toBe(draft);
    expect(readLastReferrerContact()).toBe(contact);
  });

  it("keeps one auth adapter when an inline factory changes identity on every render", async () => {
    let created = 0;
    let disposed = 0;
    const { result, rerender } = renderHook(() =>
      useWardSupabaseShared(true, () => {
        created += 1;
        // The module mock above replaces SupabaseWardAuth with a synthetic adapter.
        const auth = new SupabaseWardAuth({} as ConstructorParameters<typeof SupabaseWardAuth>[0]);
        const dispose = auth.dispose.bind(auth);
        auth.dispose = () => {
          disposed += 1;
          dispose();
        };
        return auth;
      }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender();
    rerender();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(created).toBe(1);
    expect(disposed).toBe(0);
  });
});
