// DA-15 (overall review, 20 Oct 2026): a chosen tab is kept in the web address, fixed ids only.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The address change is announced a microtask later (`ward-url-state.ts`), before the next paint.
const settle = () => act(async () => {});
import { afterEach, describe, expect, it } from "vitest";

import { useAddressTab } from "@/components/ward-management/ward-url-state";

const TABS = ["now", "details", "documents"] as const;

function Tabs() {
  const [tab, setTab] = useAddressTab("tab", TABS, "now");
  return (
    <div>
      <p data-testid="tab">{tab}</p>
      {TABS.map((id) => (
        <button key={id} type="button" onClick={() => setTab(id)}>
          {id}
        </button>
      ))}
    </div>
  );
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("useAddressTab", () => {
  it("writes the chosen tab to the address, keeps other keys, and a reload opens on it", async () => {
    window.history.replaceState(null, "", "/ward-flow/people/x?mode=find");
    render(<Tabs />);
    expect(screen.getByTestId("tab")).toHaveTextContent("now");
    fireEvent.click(screen.getByRole("button", { name: "details" }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("tab")).toBe("details");
    expect(params.get("mode")).toBe("find");
    await settle();
    expect(screen.getByTestId("tab")).toHaveTextContent("details");

    cleanup();
    render(<Tabs />);
    expect(screen.getByTestId("tab")).toHaveTextContent("details");
  });

  it("removes the key when the first tab is chosen, so the plain address stays plain", () => {
    window.history.replaceState(null, "", "/somewhere?tab=documents");
    render(<Tabs />);
    expect(screen.getByTestId("tab")).toHaveTextContent("documents");
    fireEvent.click(screen.getByRole("button", { name: "now" }));
    expect(window.location.search).toBe("");
  });

  it("ignores a value it does not know rather than guessing", () => {
    window.history.replaceState(null, "", "/somewhere?tab=Smith");
    render(<Tabs />);
    expect(screen.getByTestId("tab")).toHaveTextContent("now");
  });

  it("follows a change to the address made elsewhere (Back, Forward, a link)", async () => {
    window.history.replaceState(null, "", "/somewhere");
    render(<Tabs />);
    window.history.replaceState(null, "", "/somewhere?tab=documents");
    await settle();
    expect(screen.getByTestId("tab")).toHaveTextContent("documents");
  });
});
