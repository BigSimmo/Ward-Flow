import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FrontDoor, publicDemoUrl } from "../src/components/ward-management/front-door/front-door";
import { SIGNED_OUT_NOTICE, frontDoorNotice } from "../src/components/ward-management/front-door/front-door-notice";
import type { WardCredentialForm } from "../src/components/ward-management/use-ward-supabase-shared";

function form(overrides: Partial<WardCredentialForm> = {}): WardCredentialForm {
  return {
    open: true,
    recovery: false,
    signupAvailable: false,
    busy: false,
    message: null,
    messageKind: null,
    signIn: vi.fn(async () => {}),
    signUp: vi.fn(async () => {}),
    recover: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => {}),
    cancel: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Night entrance sign-in", () => {
  it("signs in with the typed details and clears the password", () => {
    const controls = form();
    render(<FrontDoor form={controls} demoUrl={publicDemoUrl()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " synthetic@example.test " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(controls.signIn).toHaveBeenCalledWith("synthetic@example.test", "synthetic-password");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByRole("link", { name: /Explore the demo/ })).toHaveAttribute(
      "href",
      "https://ward-flow-production.up.railway.app/ward-flow",
    );
  });

  it("shows and hides the password", () => {
    render(<FrontDoor form={form()} />);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tells wrong details apart from a busy sign-in service", () => {
    const { rerender } = render(<FrontDoor form={form({ message: "Refused.", messageKind: "credentials" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Email or password is not right.");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    rerender(
      <FrontDoor form={form({ message: "Sign-in service is unavailable. Try again.", messageKind: "unavailable" })} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nothing is wrong with your details.");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });

  it("says a set-up fault in the app's own words, not as a busy service", () => {
    render(
      <FrontDoor
        form={form({ message: "Shared sign-in configuration is unavailable.", messageKind: "unavailable" })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Shared sign-in configuration is unavailable.");
    expect(screen.getByRole("status")).toHaveTextContent("tell the Ward Flow coordinator");
    expect(screen.queryByText("The sign-in service is busy.")).toBeNull();
  });

  it("says why this tab signed out, with the shared computer reminder after a sign-out", () => {
    render(<FrontDoor form={form()} notice={SIGNED_OUT_NOTICE} />);
    const said = screen.getByRole("status");
    expect(said).toHaveTextContent("You have signed out.");
    expect(said).toHaveTextContent("On a shared computer, close the browser too.");
  });

  it("says plainly when sign-in is not set up on this site", () => {
    render(<FrontDoor form={undefined} notice="Shared sign-in configuration is unavailable." />);
    expect(screen.getByText("Sign-in is not available on this site.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("holds the button while offline", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      render(<FrontDoor form={form()} />);
      expect(screen.getByRole("button", { name: /Waiting for a connection/ })).toBeDisabled();
    } finally {
      online.mockRestore();
    }
  });

  it("leaves the demo link off when the site says off", () => {
    expect(publicDemoUrl("off")).toBeNull();
    render(<FrontDoor form={form()} demoUrl={null} />);
    expect(screen.queryByRole("link", { name: /Explore the demo/ })).toBeNull();
  });
});

describe("password reset", () => {
  it("sends the link, confirms neutrally and holds Send again for a minute", () => {
    vi.useFakeTimers();
    const controls = form();
    const { rerender } = render(<FrontDoor form={controls} />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(controls.cancel).toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(controls.recover).toHaveBeenCalledWith("synthetic@example.test");
    rerender(<FrontDoor form={{ ...controls, message: "Sent.", messageKind: "sent" }} />);
    expect(screen.getByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Send again in 1:00/ })).toBeDisabled();
    // One tick a second, each scheduled after the last renders.
    for (let second = 0; second < 60; second += 1) act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("button", { name: "Send again" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });
});

describe("new password from a recovery link", () => {
  it("names the link's account, refuses a mismatch and saves a matching pair", () => {
    const controls = form({ recovery: true, accountEmail: "synthetic@example.test" });
    render(<FrontDoor form={controls} />);
    expect(screen.getByTestId("ward-recovery-account")).toHaveTextContent("This link is for synthetic@example.test.");
    const passphrase = "synthetic long passphrase";
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: passphrase } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: `${passphrase}x` } });
    fireEvent.click(screen.getByRole("button", { name: "Save and sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The passwords do not match.");
    expect(controls.updatePassword).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: passphrase } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: passphrase } });
    fireEvent.click(screen.getByRole("button", { name: "Save and sign in" }));
    expect(controls.updatePassword).toHaveBeenCalledWith(passphrase);
  });
});

describe("bed meeting TV", () => {
  it("shows the TV's own signed-out screen with a Perth clock and its own sign-in", () => {
    const controls = form();
    render(<FrontDoor form={controls} tv />);
    const tv = screen.getByRole("main", { name: "TV signed out" });
    expect(within(tv).getByRole("heading", { level: 1, name: "This TV is signed out" })).toBeVisible();
    expect(within(tv).getByRole("heading", { level: 2, name: "Sign in this TV" })).toBeVisible();
    expect(tv).toHaveTextContent("Names show in full on this screen.");
    fireEvent.change(within(tv).getByLabelText("Email"), { target: { value: "tv@example.test" } });
    fireEvent.change(within(tv).getByLabelText("Password"), { target: { value: "synthetic-password" } });
    fireEvent.click(within(tv).getByRole("button", { name: "Sign in" }));
    expect(controls.signIn).toHaveBeenCalledWith("tv@example.test", "synthetic-password");
  });
});

describe("sign-out notices", () => {
  it("picks a tone for each reason", () => {
    expect(frontDoorNotice(SIGNED_OUT_NOTICE)).toMatchObject({ tone: "success", title: "You have signed out." });
    expect(frontDoorNotice("Signed out after 15 minutes without use. Sign in again.")?.icon).toBe("lock");
    expect(frontDoorNotice("Your sign-in reached its 12-hour limit. Sign in again.")?.icon).toBe("clock");
  });
});
