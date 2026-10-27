import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import {
  clearReferralDraftSession,
  readKeptReferralDraft,
} from "@/components/ward-management/referrals/referral-draft-store";
import { referralDraftKeptOnScreen } from "@/components/ward-management/referrals/referral-draft-kept-check";
import { sessionDraftKey } from "@/components/ward-management/ward-session-drafts";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/waiting",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

const key = () => sessionDraftKey("standard/0", "referral", "PT-023");

function unloadPrompts(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function openAndType(text: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer initialPatientId="PT-023" onClose={() => {}} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Referral" }));
  fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: text } });
}

// P158 (Josh, 27 Oct 2026): a reload restores a kept draft, so the browser's own prompt is skipped
// only when the session copy matches the screen exactly and no charts are attached.
describe("referral drawer reload prompt (P158)", () => {
  beforeEach(() => {
    clearReferralDraftSession();
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    clearReferralDraftSession();
    vi.useRealTimers();
  });

  it("does not prompt once the kept copy matches the screen, and prompts again for an unkept edit", () => {
    openAndType("Synthetic unload draft");
    expect(unloadPrompts()).toBe(true); // autosave still pending
    act(() => vi.advanceTimersByTime(500));
    expect(unloadPrompts()).toBe(false);
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic unload draft 2" } });
    expect(unloadPrompts()).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(unloadPrompts()).toBe(false);
  });

  it("still prompts when the session copy differs from the screen", () => {
    openAndType("Synthetic unload draft");
    act(() => vi.advanceTimersByTime(500));
    const envelope = JSON.parse(window.sessionStorage.getItem(key())!);
    envelope.value = JSON.stringify({ ...JSON.parse(envelope.value), doctorNote: "Different synthetic note" });
    window.sessionStorage.setItem(key(), JSON.stringify(envelope));
    expect(unloadPrompts()).toBe(true);
  });

  it("still prompts when the session save failed", () => {
    openAndType("Synthetic quota draft");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => vi.advanceTimersByTime(500));
    expect(unloadPrompts()).toBe(true);
  });

  it("treats attached charts as not recoverable", () => {
    openAndType("Synthetic chart draft");
    act(() => vi.advanceTimersByTime(500));
    const draft = readKeptReferralDraft<{ documentation: { charts: unknown[] } }>(key())!;
    expect(referralDraftKeptOnScreen(key(), draft)).toBe(true);
    const chart = {
      kind: "medication",
      name: "synthetic.pdf",
      mimeType: "application/pdf",
      sizeBytes: 3,
      base64: "AAAA",
    };
    expect(
      referralDraftKeptOnScreen(key(), { ...draft, documentation: { ...draft.documentation, charts: [chart] } }),
    ).toBe(false);
    expect(referralDraftKeptOnScreen(undefined, draft)).toBe(false);
  });
});
