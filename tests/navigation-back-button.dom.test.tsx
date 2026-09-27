import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContextualBackLink } from "@/components/contextual-back-link";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));
const currentSearchParams = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => currentSearchParams.value,
}));

function setCanGoBack(value: boolean | undefined) {
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: value === undefined ? undefined : { canGoBack: value },
  });
}

beforeEach(() => {
  router.back.mockReset();
  router.replace.mockReset();
  currentSearchParams.value = new URLSearchParams();
  setCanGoBack(false);
});

describe("contextual back navigation", () => {
  it("supports keyboard activation on the fallback link", async () => {
    const user = userEvent.setup();
    setCanGoBack(true);
    render(<ContextualBackLink fallbackHref="/services">Back to services</ContextualBackLink>);

    await user.tab();
    await user.keyboard("{Enter}");

    expect(router.back).toHaveBeenCalledOnce();
  });

  it("preserves fallback-link semantics for modified clicks", () => {
    render(<ContextualBackLink fallbackHref="/services">Back to services</ContextualBackLink>);
    const link = screen.getByRole("link", { name: "Back to services" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, button: 0 });
    let preventedByComponent: boolean | undefined;
    window.addEventListener(
      "click",
      (clickEvent) => {
        preventedByComponent = clickEvent.defaultPrevented;
        clickEvent.preventDefault();
      },
      { once: true },
    );

    link.dispatchEvent(event);
    expect(preventedByComponent).toBe(false);
    expect(link).toHaveAttribute("href", "/services");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("runs the dirty-state gate before a modified-click fallback", () => {
    const onBeforeNavigate = vi.fn(() => false);
    render(
      <ContextualBackLink fallbackHref="/services" onBeforeNavigate={onBeforeNavigate}>
        Back to services
      </ContextualBackLink>,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, button: 0 });

    expect(screen.getByRole("link").dispatchEvent(event)).toBe(false);
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
  });
});
