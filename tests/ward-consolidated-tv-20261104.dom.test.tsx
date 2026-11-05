import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TvLockControl, lockTv, TV_LOCK_STORAGE_KEY } from "@/components/ward-management/bed-meeting/tv-lock";
import { StepUpReauthContext } from "@/components/ward-management/shell/ward-step-up-context";
import { WardAuthError } from "@/components/ward-management/ward-auth-link";

afterEach(() => window.localStorage.clear());
describe("TV unlock failure wording", () => {
  it.each(["credentials", "unavailable", "session"] as const)(
    "reports %s accurately while retaining the lock",
    async (kind) => {
      act(() => lockTv("/ward-flow/bed-meeting"));
      render(
        <StepUpReauthContext.Provider
          value={async () => {
            throw new WardAuthError(kind, "Synthetic failure");
          }}
        >
          <TvLockControl href="/ward-flow/bed-meeting" className="" shared />
        </StepUpReauthContext.Provider>,
      );
      fireEvent.click(screen.getByTestId("tv-unlock"));
      const dialog = screen.getByTestId("tv-unlock-dialog");
      fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "synthetic-password" } });
      await act(async () => {
        fireEvent.click(within(dialog).getByRole("button", { name: "Sign in and unlock" }));
      });
      expect(dialog.textContent?.includes("password was not accepted")).toBe(kind === "credentials");
      expect(window.localStorage.getItem(TV_LOCK_STORAGE_KEY)).toBe("/ward-flow/bed-meeting");
    },
  );
});
