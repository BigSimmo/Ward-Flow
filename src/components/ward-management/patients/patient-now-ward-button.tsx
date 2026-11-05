"use client";

// Split from patient-now-ward-cards.tsx so the phone bar can draw the next step's button at once
// while the ward cards load on their own (phone script budget).
import Link from "next/link";
import { Button, buttonClass } from "@/components/wf";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import type { NextStepAction } from "./patient-now-ward";

/** The next step's one button: a link or a handler, greyed with the desk's reason when limited. */
export function PatientNextStepButton({
  action,
  primary,
  roleLimit,
  testId,
}: {
  action: NextStepAction;
  primary: boolean;
  roleLimit?: (event: WardFlowEventType) => string | undefined;
  testId?: string;
}) {
  const reason = action.event ? roleLimit?.(action.event) : undefined;
  const variant = primary ? "pri" : "sec";
  if (reason)
    return (
      <Button icon={action.icon} disabledReason={reason} reasonDisplay="tooltip" data-testid={testId}>
        {action.label}
      </Button>
    );
  if (action.href)
    return (
      <Link href={action.href} className={buttonClass({ variant })} aria-label={action.ariaLabel} data-testid={testId}>
        {action.icon ? <action.icon size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
        {action.label}
      </Link>
    );
  return (
    <Button
      variant={variant}
      icon={action.icon}
      aria-label={action.ariaLabel}
      onClick={action.onClick}
      data-testid={testId}
    >
      {action.label}
    </Button>
  );
}
