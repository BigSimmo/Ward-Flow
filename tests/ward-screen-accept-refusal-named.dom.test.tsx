// D-125 (Josh, 10 Nov 2026; audit M2): an Accept in principle refused at save time is said on the
// ward's own toast, naming the person, in the same words as the other refusals ("Not recorded: ...
// Nothing was changed."). Before, the reason showed only on the row, without the name.
// Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithToasts as render } from "./helpers/with-toasts";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

/** The shared server, stood in for by wrapping the provider's dispatch (as in the toasts-wait test). */
const server = vi.hoisted(() => ({ reply: null as WardCommandOutcome | null }));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  const useWardFlowSelect: typeof actual.useWardFlowSelect = (...keys) => {
    const picked = actual.useWardFlowSelect(...keys);
    if (!("dispatch" in picked)) return picked;
    const real = (picked as { dispatch: WardCommandDispatch }).dispatch;
    const dispatch: WardCommandDispatch = (event) => (server.reply ? Promise.resolve(server.reply) : real(event));
    return { ...picked, dispatch };
  };
  return { ...actual, useWardFlowSelect };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

// A seeded referral waiting for this ward's answer.
const WARD = unitById("gry-older-adult")!;
const TARGET = "WF-013";

beforeEach(() => {
  server.reply = null;
  window.history.replaceState(null, "", `/ward-flow/ward/${WARD.id}`);
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe("a refused Accept in principle on the ward screen (D-125)", () => {
  it("says Not recorded on the toast, naming the person, and that nothing was changed", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={WARD.id} />
      </WardFlowProvider>,
    );
    fireEvent.click(await screen.findByTestId(`ward-accept-${TARGET}`));
    const dialog = screen.getByTestId("ward-accept-dialog");
    const name = dialog.querySelector("#ward-answer-allocating-movement strong")?.textContent ?? "";
    expect(name).toMatch(/^[^,]+, [^,]+$/u);
    fireEvent.click(within(dialog).getAllByRole("radio")[0]!);

    server.reply = {
      commandId: "cmd-accept",
      status: "refused",
      message: "Another ward answered this referral first. Nothing was changed.",
    };
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm acceptance" }));
    });

    const toast = screen.getByTestId("ward-action-toast");
    expect(toast).toHaveTextContent(
      `Not recorded: ${name}: Another ward answered this referral first. Nothing was changed.`,
    );
    // Said once, not twice.
    expect(toast.textContent?.match(/Nothing was changed/gu)).toHaveLength(1);
    expect(screen.queryByText(/Accepted .* in principle\./u)).toBeNull();
  });

  it("names the person on the answer view's refusal toast too", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAnswerView unitId="sjgm-adult-open" />
      </WardFlowProvider>,
    );
    // The answer view's own accept: a READY census square opens the named dialog.
    fireEvent.click(screen.getAllByRole("button", { name: /^Census square \d+: READY$/u })[0]!);
    const dialog = screen.getByRole("dialog", { name: /accept/iu });
    const name = dialog.querySelector("#ward-answer-allocating-movement strong")?.textContent ?? "";
    expect(name).toMatch(/^[^,]+, [^,]+$/u);
    fireEvent.click(within(dialog).getAllByRole("radio")[0]!);

    server.reply = {
      commandId: "cmd-answer",
      status: "refused",
      message: "Another ward answered this referral first.",
    };
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm acceptance" }));
    });

    expect(await screen.findByText(`Not recorded: ${name}: Another ward answered this referral first.`)).toBeVisible();
  });
});
