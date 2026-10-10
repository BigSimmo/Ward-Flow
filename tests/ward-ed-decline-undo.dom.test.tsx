import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToastProvider } from "@/components/wf";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * ED page, v10 pass 3: a decline recorded from the ED inbox shows a toast with Undo, and Undo puts
 * the referral back in the inbox (UNDO_REFERRAL_DECISION, the ED's own decision).
 */
function renderEd(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <EdScreen edId={edId} />
      </ToastProvider>
    </WardFlowProvider>,
  );
}

function firstEdWithInbox(): string | undefined {
  for (const ed of allEmergencyDepartments()) {
    renderEd(ed.id);
    const found = screen.queryAllByTestId(/^ward-ed-inbox-decline-[^p]/u).length > 0;
    cleanup();
    if (found) return ed.id;
  }
  return undefined;
}

describe("ED page — decline with Undo", () => {
  it("declines from the inbox, then Undo puts the referral back", () => {
    const edId = firstEdWithInbox();
    expect(edId).toBeDefined();
    renderEd(edId!);
    const button = screen.getAllByTestId(/^ward-ed-inbox-decline-[^p]/u)[0];
    const referralId = button.getAttribute("data-testid")!.replace("ward-ed-inbox-decline-", "");
    fireEvent.click(button);
    const reason = screen.getByTestId(`ward-ed-inbox-decline-reason-${referralId}`) as HTMLSelectElement;
    const option = Array.from(reason.options).find((candidate) => candidate.value !== "");
    fireEvent.change(reason, { target: { value: option!.value } });
    fireEvent.click(screen.getByTestId(`ward-ed-inbox-decline-confirm-${referralId}`));

    expect(screen.queryByTestId(`ward-ed-inbox-decline-${referralId}`)).toBeNull();
    const toast = screen.getByText("Referral declined").closest("[role='status'], [role='alert'], div")!;
    fireEvent.click(within(toast.parentElement as HTMLElement).getByRole("button", { name: /Undo/u }));
    expect(screen.getByTestId(`ward-ed-inbox-decline-${referralId}`)).toBeInTheDocument();
    expect(screen.getByText("Decline undone")).toBeInTheDocument();
  });
});
