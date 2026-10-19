import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardPracticeMode } from "@/components/ward-management/demo-reset/ward-practice-mode";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Shows practice when `shown`, as the Tools sheet does when open, under a chosen scenario and world generation. */
function Harness({ shown, scenario, generation }: { shown: boolean; scenario?: string; generation?: number }) {
  const value = useWardFlow();
  const next = {
    ...value,
    ...(scenario === undefined ? {} : { scenario: scenario as typeof value.scenario }),
    ...(generation === undefined ? {} : { worldGeneration: generation }),
  };
  return <WardFlowOverride value={next}>{shown ? <WardPracticeMode /> : null}</WardFlowOverride>;
}

function renderPractice() {
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness shown />
    </WardFlowProvider>,
  );
  const show = (shown: boolean, scenario?: string, generation?: number) =>
    view.rerender(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Harness shown={shown} scenario={scenario} generation={generation} />
      </WardFlowProvider>,
    );
  return { show };
}

afterEach(() => {
  const stop = screen.queryByTestId("ward-practice-stop");
  if (stop) act(() => fireEvent.click(stop));
});

describe("practice mode session", () => {
  it("keeps running when Tools closes and opens again", () => {
    const { show } = renderPractice();
    fireEvent.click(screen.getByTestId("ward-practice-start"));
    expect(screen.getByTestId("ward-practice-steps")).toBeInTheDocument();
    show(false);
    expect(screen.queryByTestId("ward-practice-mode")).toBeNull();
    show(true);
    expect(screen.getByTestId("ward-practice-steps")).toBeInTheDocument();
  });

  it("ends when the scenario changes, so another scenario's requests are not taken as the learner's", () => {
    const { show } = renderPractice();
    fireEvent.click(screen.getByTestId("ward-practice-start"));
    show(true, "another-scenario");
    expect(screen.queryByTestId("ward-practice-steps")).toBeNull();
    expect(screen.getByTestId("ward-practice-start")).toBeInTheDocument();
    show(true); // back to the first world, so the clean-up below can stop the session
  });

  it("ends when the world is reseeded under the same scenario, such as a loaded scenario file", () => {
    const { show } = renderPractice();
    fireEvent.click(screen.getByTestId("ward-practice-start"));
    show(true, undefined, 999);
    expect(screen.queryByTestId("ward-practice-steps")).toBeNull();
    expect(screen.getByTestId("ward-practice-start")).toBeInTheDocument();
    show(true);
  });
});
