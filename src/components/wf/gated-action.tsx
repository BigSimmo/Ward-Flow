"use client";

/**
 * **GATED ACTION — one control that draws `permit()`'s answer (R-STRUCT-2, D-192 item 5, D-223).**
 *
 * | `permit()` | Drawn as |
 * | --- | --- |
 * | `allow` | the normal `Button`, enabled |
 * | `not-now` | the `Button` with its reason drawn under it (`disabledReason`), on a phone too |
 * | `never` | nothing, and no "who does this" line in its place (Josh, 14 Nov 2026, 14:44Z) |
 *
 * `GatedAction` asks `usePermit(change)` itself, so the place rules reach the screen (R3-10, REC-E-1).
 * `GatedButton` draws an answer a screen already has: a `Permit`, or a `useRoleGate()` result through
 * `permitFromRoleGate`. Both reuse `Button`; there is no new style.
 *
 * Not exported from `@/components/wf` (`index.ts`): it reads the ward session, so import it by path.
 */
import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { usePermit } from "@/components/ward-management/shell/use-permit";
import type { Change, Permit } from "@/components/ward-management/ward-permit";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";

type GatedButtonOwn = {
  /** Runs only when the change is allowed. */
  onPress: () => void;
  children?: ReactNode;
};

export type GatedButtonProps = GatedButtonOwn &
  Omit<ButtonProps, "onClick" | "disabledReason" | "children" | "iconOnly"> & { readonly permit: Permit };

/** A `useRoleGate()` answer as a `Permit`: allowed, never (hidden) or not now (with its reason). */
export function permitFromRoleGate(gate: RoleGate): Permit {
  if (gate.allowed) return { kind: "allow" };
  const reason = gate.reason ?? "";
  return gate.never ? { kind: "never", refusal: reason } : { kind: "not-now", refusal: reason, reason };
}

/** Draws one `permit()` answer: hidden, disabled with its reason, or enabled. */
export function GatedButton({ permit, onPress, children, ...button }: GatedButtonProps) {
  if (permit.kind === "never") return null;
  if (permit.kind === "not-now")
    return (
      <Button {...(button as ButtonProps)} disabledReason={permit.reason}>
        {children}
      </Button>
    );
  return (
    <Button {...(button as ButtonProps)} onClick={onPress}>
      {children}
    </Button>
  );
}

export type GatedActionProps = GatedButtonOwn &
  Omit<ButtonProps, "onClick" | "disabledReason" | "children" | "iconOnly"> & {
    /** The change this control makes, without its role or time (the shell stamps those). */
    readonly change: Change;
  };

/** A control that asks `permit()` for this desk and this change, and draws the answer. */
export function GatedAction({ change, ...props }: GatedActionProps) {
  return <GatedButton permit={usePermit(change)} {...props} />;
}
