import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeclusionFormsView } from "@/components/ward-management/restrictive-practice/seclusion-forms-view";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Page tops: a tap on the seclusion top while the view is still loading opens its dialog once it mounts. */
afterEach(cleanup);

describe("seclusion forms view asks from the page top", () => {
  it("opens Record incident for an ask already made when the view mounts", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SeclusionFormsView ask={{ kind: "incident", n: 1 }} />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Record a ward incident" })).toBeInTheDocument();
  });

  it("opens Start for an ask already made when the view mounts", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SeclusionFormsView ask={{ kind: "start", n: 1 }} />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Start seclusion or restraint" })).toBeInTheDocument();
  });

  it("tells the page it has seen the ask, so the page can drop it before any remount", () => {
    const seen = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SeclusionFormsView ask={{ kind: "incident", n: 1 }} onAskSeen={seen} />
      </WardFlowProvider>,
    );
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("says when the patient search shows only the first six matches", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SeclusionFormsView ask={{ kind: "start", n: 1 }} />
      </WardFlowProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Start seclusion or restraint" });
    // A single vowel matches most synthetic names on the secure wards.
    fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "a" } });
    const shown = within(screen.getByTestId("seclusion-start-matches")).getAllByRole("button");
    expect(shown).toHaveLength(6);
    expect(screen.getByTestId("seclusion-start-more")).toHaveTextContent(
      /^Showing 6 of \d+, type more of the name\.$/u,
    );
  });
});
