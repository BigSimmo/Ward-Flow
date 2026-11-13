"use client";

/**
 * A15-14 (Josh, 13 Nov 2026): demo phone numbers are copy only, never dial links. This is the one
 * control every screen uses to show an invented number someone might want to ring. A tap copies the
 * number and says so; nothing opens the phone's dialler. `tests/ward-fix-F2-phone-and-email.test.ts`
 * fails on any `tel:` link typed anywhere else in `src/`.
 *
 * No number in the source is marked as a real service's line, so there is no dialling path. The
 * Triage safety plan's crisis lines (A15-17) are shown as text, not through this control.
 */
import { useState, type ReactNode } from "react";
import { Check, Copy, Phone } from "lucide-react";

import { buttonClass } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

export function DemoPhoneNumber({
  number,
  who,
  label,
  className,
  numberClassName,
  phoneIcon = false,
  testId,
}: {
  number: string;
  /** Whose number, for the button's name, e.g. "the referrer". */
  who?: string;
  /** Visible words instead of the number, e.g. "Copy referrer's number". */
  label?: ReactNode;
  /** The screen's own button look; without one the kit's small ghost button is used. */
  className?: string;
  numberClassName?: string;
  /** A phone glyph before the number, where the screen used one on its old dial link. */
  phoneIcon?: boolean;
  testId?: string;
}) {
  const [said, setSaid] = useState<"copied" | "failed" | null>(null);
  const name = typeof label === "string" ? `${label}, ${number}` : `Copy ${who ? `${who}'s` : "the"} number, ${number}`;
  return (
    <>
      <button
        type="button"
        className={className ?? buttonClass({ variant: "ghost", size: "sm" })}
        aria-label={name}
        data-testid={testId ?? "ward-demo-phone"}
        data-demo-phone=""
        onClick={() =>
          void copyTextToClipboard(number).then(
            () => setSaid("copied"),
            () => setSaid("failed"),
          )
        }
      >
        {phoneIcon ? <Phone size={13} aria-hidden="true" /> : null}
        <span className={numberClassName}>{label ?? number}</span>
        {said === "copied" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      </button>
      {/* An intrinsic element, so the announced-figure guard reads this live region. */}
      <span className="sr-only" role="status">
        {said === "copied"
          ? "Number copied. Demo numbers do not dial."
          : said === "failed"
            ? "Not copied. Select the number instead."
            : ""}
      </span>
    </>
  );
}
