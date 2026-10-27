import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * H-0111 (Josh, 27 Oct 2026): with role access on, the first page sent and the browser's first pass
 * over it hold the page area back until the device's own desk is known, so no desk sees a page
 * outside its role for an instant. Pages opened later are drawn at once.
 */

async function loadHold() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_WARD_ENVIRONMENT", "demo");
  return (await import("@/components/ward-management/shell/ward-access-hold")).WardAccessFirstPaintHold;
}

const fallback = <p data-testid="held">Loading page</p>;
const page = <p data-testid="page">Coordinator page</p>;

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
});

describe("H-0111 first paint waits for the desk", () => {
  it("sends the holding page, never the page itself, from the server", async () => {
    const Hold = await loadHold();
    const html = renderToString(<Hold fallback={fallback}>{page}</Hold>);
    expect(html).toContain('data-testid="held"');
    expect(html).not.toContain("Coordinator page");
  });

  it("draws the page once the browser has taken over", async () => {
    const Hold = await loadHold();
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Hold fallback={fallback}>{page}</Hold>);
    document.body.appendChild(container);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Hold fallback={fallback}>{page}</Hold>);
    });
    expect(container.querySelector('[data-testid="page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="held"]')).toBeNull();
    act(() => root?.unmount());
  });

  it("draws a page opened inside the app at once", async () => {
    const Hold = await loadHold();
    render(<Hold fallback={fallback}>{page}</Hold>);
    expect(screen.getByTestId("page")).toBeTruthy();
    expect(screen.queryByTestId("held")).toBeNull();
  });
});
