// DA-15 (design audit, 19 Oct 2026): a reload or a shared link opens the Delays board as it was left.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { replaceSearchParams } from "@/components/ward-management/ward-url-state";

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

const pressed = (testId: string) => screen.getByTestId(testId).getAttribute("aria-pressed");
const orderButton = (name: "By blocker" | "Longest wait") => screen.getByRole("button", { name });

describe("the Delays board keeps its filters and order in the address", () => {
  it("writes a filter to the address, and a reload opens with it on", () => {
    window.history.replaceState(null, "", "/ward-flow/delays");
    renderBoard();
    fireEvent.click(screen.getByTestId("delays-owner-wards"));
    expect(new URLSearchParams(window.location.search).get("owner")).toBe("wards");

    cleanup();
    renderBoard();
    expect(pressed("delays-owner-wards")).toBe("true");
  });

  it("takes two quick taps in order, so the second is never overruled by the first", () => {
    window.history.replaceState(null, "", "/ward-flow/delays");
    renderBoard();
    fireEvent.click(screen.getByTestId("delays-owner-yours"));
    fireEvent.click(screen.getByTestId("delays-owner-wards"));
    expect(pressed("delays-owner-yours")).toBe("false");
    expect(pressed("delays-owner-wards")).toBe("true");
    expect(new URLSearchParams(window.location.search).get("owner")).toBe("wards");
  });

  it("opens a shared link's order, and writes the viewer's own choice", () => {
    window.history.replaceState(null, "", "/ward-flow/delays?order=blocker");
    renderBoard();
    expect(orderButton("By blocker")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(orderButton("Longest wait"));
    expect(new URLSearchParams(window.location.search).get("order")).toBe("longest");
  });

  it("writes the order with a filter, so a copied link opens in the sender's order", () => {
    window.localStorage.setItem("ward_flow_delays_order", "blocker");
    window.history.replaceState(null, "", "/ward-flow/delays");
    renderBoard();
    expect(window.location.search).toBe("");
    fireEvent.click(screen.getByTestId("delays-owner-wards"));
    expect(new URLSearchParams(window.location.search).get("order")).toBe("blocker");
    expect(orderButton("By blocker")).toHaveAttribute("aria-pressed", "true");
  });

  it("follows the address when it changes underneath (Back, Forward, a link)", async () => {
    window.history.replaceState(null, "", "/ward-flow/delays");
    renderBoard();
    expect(pressed("delays-owner-yours")).toBe("false");
    await act(async () => {
      window.history.replaceState(null, "", "/ward-flow/delays?owner=yours");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(pressed("delays-owner-yours")).toBe("true");
  });

  it("never writes typed search text, and keeps the address's other keys", () => {
    window.history.replaceState(null, "", "/ward-flow/delays?from=queue");
    renderBoard();
    fireEvent.change(screen.getAllByRole("searchbox", { name: "Find a person or ED" })[0]!, {
      target: { value: "Smith" },
    });
    fireEvent.click(screen.getByTestId("delays-owner-wards"));
    expect(window.location.search).not.toMatch(/Smith/u);
    expect(new URLSearchParams(window.location.search).get("from")).toBe("queue");
  });
});

describe("replaceSearchParams", () => {
  it("sets and removes keys in place, keeping the path, the hash and history", () => {
    window.history.replaceState(null, "", "/ward-flow/delays?from=queue&owner=ed#list");
    const before = window.history.length;
    replaceSearchParams({ owner: null, quiet: "1" });
    expect(window.location.pathname).toBe("/ward-flow/delays");
    expect(window.location.search).toBe("?from=queue&quiet=1");
    expect(window.location.hash).toBe("#list");
    expect(window.history.length).toBe(before);
  });
});
