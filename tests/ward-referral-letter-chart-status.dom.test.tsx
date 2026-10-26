import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { EMPTY_DOCUMENTATION } from "@/components/ward-management/referrals/referral-flow-panels";
import {
  useWardReferralDrawerState,
  type WardReferralDrawerState,
} from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import {
  ReferralConfirmation,
  ReferralLetterPreview,
} from "@/components/ward-management/referrals/ward-referral-drawer-letter";

let state: WardReferralDrawerState;
const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

afterEach(() => {
  cleanup();
  discardReferralDraft();
  writeText.mockClear();
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

function setup() {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  function Harness() {
    state = useWardReferralDrawerState({
      onClose: () => {},
      onViewChange: () => {},
      onRestart: () => {},
      view: "new",
      initialPatientId: "PT-023",
    });
    return (
      <>
        <ReferralLetterPreview s={state} />
        <ReferralConfirmation s={state} />
      </>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness />
    </WardFlowProvider>,
  );
}

async function copiedLetter() {
  fireEvent.click(screen.getByTestId("ward-referral-copy-letter"));
  await waitFor(() => expect(writeText).toHaveBeenCalled());
  return writeText.mock.calls.at(-1)![0];
}

describe("chart status through the real drawer text input and copy controls", () => {
  it("previews and copies both charts to follow, including ISBAR notes", async () => {
    setup();
    act(() => state.setDocumentation({ ...EMPTY_DOCUMENTATION, toFollow: ["medication", "observation"] }));
    const pending = ["Medication chart to follow, not attached yet", "Observation chart to follow, not attached yet"];
    for (const words of pending) expect(screen.getByTestId("ward-referral-letter-preview")).toHaveTextContent(words);
    const letter = await copiedLetter();
    for (const words of pending) expect(letter).toContain(words);
    expect(letter).toMatch(/^Synthetic prototype\./u);
    expect(letter).not.toMatch(/UMRN|UM\d{6}/u);
    writeText.mockClear();
    act(() => {
      state.setSentReferralId("RF-SYNTHETIC");
      state.setSentAt(NOW_ANCHOR);
    });
    for (const words of pending) expect(screen.getByTestId("ward-referral-isbar")).toHaveTextContent(words);
    fireEvent.click(screen.getByTestId("ward-referral-copy-notes"));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const notes = writeText.mock.calls.at(-1)![0];
    for (const words of pending) expect(notes).toContain(words);
    expect(notes).toMatch(/^Synthetic prototype\./u);
    expect(notes).not.toMatch(/UMRN|UM\d{6}/u);
  });

  it("carries attached status without copying file bytes or retaining a replaced pending status", async () => {
    setup();
    act(() =>
      state.setDocumentation({
        ...EMPTY_DOCUMENTATION,
        toFollow: ["medication", "observation"],
        charts: [
          {
            kind: "medication",
            name: "synthetic.pdf",
            mimeType: "application/pdf",
            sizeBytes: 4,
            base64: "JVBERg==",
          },
        ],
      }),
    );
    const letter = await copiedLetter();
    expect(letter).toContain("Medication chart attached");
    expect(letter).toContain("Observation chart to follow, not attached yet");
    expect(letter).not.toContain("Medication chart to follow");
    expect(letter).not.toContain("JVBERg==");
    expect(letter).not.toContain("synthetic.pdf");
  });

  it("omits chart status for community referrals and does not invent missing chart answers", async () => {
    setup();
    expect(await copiedLetter()).not.toMatch(/Medication chart|Observation chart/u);
    act(() => {
      state.setDocumentation({ ...EMPTY_DOCUMENTATION, toFollow: ["medication", "observation"] });
      state.chooseDestination("community");
    });
    writeText.mockClear();
    expect(await copiedLetter()).not.toMatch(/Medication chart|Observation chart/u);
    act(() => {
      state.setSentReferralId("RF-SYNTHETIC");
      state.setSentAt(NOW_ANCHOR);
    });
    expect(screen.getByTestId("ward-referral-isbar")).not.toHaveTextContent(/Medication chart|Observation chart/u);
  });
});
