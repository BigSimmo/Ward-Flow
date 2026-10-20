import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WardBarBack } from "@/components/ward-management/shell/ward-bar-controls";
import { noteWardRoute, resetWardRouteHistory } from "@/components/ward-management/shell/ward-back";

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

function setCanGoBack(value: boolean) {
  Object.defineProperty(window, "navigation", { configurable: true, value: { canGoBack: value } });
}

beforeEach(() => {
  router.back.mockReset();
  router.replace.mockReset();
  resetWardRouteHistory();
  setCanGoBack(true);
});

describe("the header's Back control", () => {
  it("is a named link to the parent page, with a visible word on desktop", () => {
    render(<WardBarBack parentHref="/ward-flow/movements" phone={false} />);
    const back = screen.getByTestId("ward-bar-back");
    expect(back).toHaveAccessibleName("Back");
    expect(back).toHaveAttribute("href", "/ward-flow/movements");
    expect(back).toHaveTextContent("Back");
  });

  it("goes to the parent page when the tab has not moved within Ward Flow (opened from a link)", () => {
    noteWardRoute("/ward-flow/people/PX-1a2b");
    render(<WardBarBack parentHref="/ward-flow/movements" phone />);
    fireEvent.click(screen.getByTestId("ward-bar-phone-back"));
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/ward-flow/movements");
  });

  it("returns to the previous Ward Flow screen once the tab has moved within the app", () => {
    noteWardRoute("/ward-flow/waiting");
    noteWardRoute("/ward-flow/people/PX-1a2b");
    render(<WardBarBack parentHref="/ward-flow/movements" phone />);
    fireEvent.click(screen.getByTestId("ward-bar-phone-back"));
    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
