// Q93 (Josh approved, 1 Nov 2026): no referral is accepted in one tap without naming the person. The
// Ward home tab's Accept in principle, on the waiting card and in the full referral, opens the same
// named accept dialog as the answer view, with its pull time limit, and nothing is raised until the
// ward confirms. Synthetic seed data only.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// A seeded referral waiting for this ward's answer.
const WARD = unitById("gry-older-adult")!;
const TARGET = "WF-013";

/** Record each event the screen raises, then let the real provider apply it. */
function Recorder({ events, children }: { events: WardFlowEvent[]; children: ReactNode }) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => {
    events.push(event);
    return flow.dispatch(event);
  };
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

function mount(events: WardFlowEvent[]) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Recorder events={events}>
        <WardScreen unitId={WARD.id} />
      </Recorder>
    </WardFlowProvider>,
  );
}

const accepts = (events: WardFlowEvent[]) => events.filter((event) => event.type === "ACCEPT_IN_PRINCIPLE");

/** The open accept dialog, with the person's name it shows (surname first). */
function acceptDialog() {
  const dialog = screen.getByTestId("ward-accept-dialog");
  const name = dialog.querySelector("#ward-answer-allocating-movement strong")?.textContent ?? "";
  return { dialog, name };
}

afterEach(() => {
  cleanup();
});

describe("the Ward home tab's Accept in principle (Q93)", () => {
  it("opens the named dialog from the card, and Cancel accepts nothing", async () => {
    const events: WardFlowEvent[] = [];
    mount(events);
    const accept = await screen.findByTestId(`ward-accept-${TARGET}`);
    expect(accept).toHaveAttribute("data-placement-action");

    fireEvent.click(accept);
    // One tap never accepts: the dialog names the person first.
    expect(accepts(events)).toHaveLength(0);
    const { dialog, name } = acceptDialog();
    expect(name).toMatch(/^[^,]+, [^,]+$/u);
    expect(within(dialog).getByRole("group", { name: "Pull time limit" })).toBeInTheDocument();
    expect(within(dialog).getByText(WARD.name)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-accept-dialog")).toBeNull();
    expect(accepts(events)).toHaveLength(0);
  });

  it("records the accept, with the chosen pull time limit, only once it is confirmed", async () => {
    const events: WardFlowEvent[] = [];
    mount(events);
    fireEvent.click(await screen.findByTestId(`ward-accept-${TARGET}`));
    const { dialog } = acceptDialog();

    // Confirm waits for a pull time limit.
    const confirm = within(dialog).getByRole("button", { name: "Confirm acceptance" });
    fireEvent.click(confirm);
    expect(accepts(events)).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("radio", { name: /extra travel/u }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm acceptance" }));
      await Promise.resolve();
    });

    expect(screen.queryByTestId("ward-accept-dialog")).toBeNull();
    expect(accepts(events)).toHaveLength(1);
    expect(accepts(events)[0]).toMatchObject({
      type: "ACCEPT_IN_PRINCIPLE",
      movementId: TARGET,
      unitId: WARD.id,
      actingUnitId: WARD.id,
      extendedHold: true,
    });
  });

  it("opens the same named dialog from the full referral", async () => {
    const events: WardFlowEvent[] = [];
    mount(events);
    fireEvent.click(await screen.findByTestId(`ward-incoming-open-${TARGET}`));
    const drawer = await screen.findByTestId("ward-referral-detail-drawer");

    fireEvent.click(within(drawer).getByTestId(`ward-referral-detail-accept-${TARGET}`));
    await waitFor(() => expect(screen.queryByTestId(`ward-referral-detail-${TARGET}`)).toBeNull());
    expect(accepts(events)).toHaveLength(0);
    const { dialog, name } = acceptDialog();
    expect(name).toMatch(/^[^,]+, [^,]+$/u);

    fireEvent.click(within(dialog).getAllByRole("radio")[0]!);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm acceptance" }));
      await Promise.resolve();
    });
    expect(accepts(events)).toHaveLength(1);
    expect(accepts(events)[0]).toMatchObject({ movementId: TARGET, unitId: WARD.id });
  });
});
