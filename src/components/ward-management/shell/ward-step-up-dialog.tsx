"use client";

/**
 * The step-up sign-in dialog (`ward-step-up.tsx`). Kept in its own file so its code loads only when
 * a powerful step asks for it (phone size trim, 31 Oct 2026). The password stays in the hook's state.
 */
import { Dialog, Field, SrOnly, TextInput } from "@/components/wf";
import { STEP_UP_MINUTES } from "@/components/ward-management/ward-access-shell-rules";

export type StepUpDialogProps = {
  mode: "confirm" | "password";
  password: string;
  setPassword: (password: string) => void;
  busy: boolean;
  error: { kind: "sign-in" | "action"; message: string } | null;
  carryOn: () => void;
  onClose: () => void;
};

export function StepUpDialog({ mode, password, setPassword, busy, error, carryOn, onClose }: StepUpDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Confirm it is you"
      description={`Giving access and opening a record outside your care need a sign-in within the last ${STEP_UP_MINUTES} minutes.`}
      size="sm"
      data-testid="ward-step-up"
      primary={{
        label: mode === "password" ? "Sign in and carry on" : "Confirm and carry on",
        onAction: carryOn,
        loading: busy,
        disabledReason: mode === "password" && password.length === 0 ? "Enter your password first." : undefined,
      }}
      secondary={[{ label: "Cancel", onAction: onClose }]}
    >
      {mode === "password" ? (
        <>
          <Field label="Password" error={error?.kind === "sign-in" ? error.message : undefined}>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                // Enter signs in, as it would in any password box.
                if (event.key === "Enter" && password.length > 0) {
                  event.preventDefault();
                  carryOn();
                }
              }}
              data-sheet-autofocus="true"
            />
          </Field>
          {/* Field errors are not announced on their own, so a refused sign-in is said here. */}
          <SrOnly role="status">{error?.kind === "sign-in" ? error.message : ""}</SrOnly>
          {error?.kind === "action" ? <p role="alert">{error.message}</p> : null}
        </>
      ) : (
        <p>
          The shared workspace asks for your password again here. In this demonstration there is no password, so confirm
          to carry on.
          {error ? <span role="alert"> {error.message}</span> : null}
        </p>
      )}
    </Dialog>
  );
}
