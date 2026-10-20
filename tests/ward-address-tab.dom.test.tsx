// DA-15 (overall review, 20 Oct 2026): a chosen tab is kept in the web address, fixed ids only.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// The address change is announced a microtask later (`ward-url-state.ts`), before the next paint.
const settle = () => act(async () => {});
import { afterEach, describe, expect, it } from "vitest";

import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
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
    window.history.replaceState(null, "", "/ward-flow/people/x?view=governed");
    render(<Tabs />);
    expect(screen.getByTestId("tab")).toHaveTextContent("now");
    fireEvent.click(screen.getByRole("button", { name: "details" }));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("tab")).toBe("details");
    expect(params.get("view")).toBe("governed");
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

describe("the patient record (governed view) keeps its tab on reload", () => {
  const someone = seedWardFlowState().patients[0]!;
  const renderPerson = () =>
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PersonScreen patientId={someone.id} />
      </WardFlowProvider>,
    );

  it("puts the chosen tab id, never a name, in the address", () => {
    window.history.replaceState(null, "", "/ward-flow/people/coded?view=governed");
    renderPerson();
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    expect(window.location.search).toBe("?view=governed&tab=details");
    expect(window.location.href).not.toContain(someone.familyName);

    cleanup();
    renderPerson();
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  });
});
