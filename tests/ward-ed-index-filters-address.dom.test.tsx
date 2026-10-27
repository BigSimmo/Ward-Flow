// DA-15: the All EDs status and service filters live in the web address, so a reload keeps them.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const settle = () => act(async () => {});

function renderIndex() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdIndex />
    </WardFlowProvider>,
  );
}

/** The checked choice's label, without its count ("South2" reads "South"). */
const checked = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"]')].map((element) =>
    (element.textContent ?? "").replace(/\d+$/u, ""),
  );

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("All EDs filters in the address (DA-15)", () => {
  it("opens on the status and service filters the address names", async () => {
    window.history.replaceState(null, "", "/ward-flow/ed?status=past-target&service=South+Metro");
    const { container } = renderIndex();
    await settle();
    expect(checked(container)).toEqual(expect.arrayContaining(["Past target", "South"]));
  });

  it("ignores a value it does not know rather than guessing", async () => {
    window.history.replaceState(null, "", "/ward-flow/ed?status=Smith");
    const { container } = renderIndex();
    await settle();
    expect(checked(container)).toEqual(expect.arrayContaining(["All EDs", "All"]));
  });
});
