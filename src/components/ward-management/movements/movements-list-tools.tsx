"use client";

import type { ComponentProps } from "react";
import { ListExportButton } from "@/components/ward-management/ward-list-export-button";
import { ListPrintButton } from "@/components/ward-management/ward-list-print-button";
import type { exportMovementsList } from "@/components/ward-management/ward-movements-export";

type ExportInput = Parameters<typeof exportMovementsList>[0];

/**
 * The worklist's Print and Export (feature 44), kept out of `movements-screen.tsx`, which is near its
 * line cap. Export loads its builder on the click, so the screen carries none of it up front. On a
 * phone both are icon-only, with their spoken names, as on Leave and Legal forms.
 */
export function MovementsListTools(
  props: ExportInput & Pick<ComponentProps<typeof ListPrintButton>, "disabled" | "iconOnly">,
) {
  const { disabled, iconOnly, ...input } = props;
  return (
    <>
      <ListPrintButton iconOnly={iconOnly} disabled={disabled} testId="ward-movements-print" />
      <ListExportButton
        iconOnly={iconOnly}
        load={async () =>
          (await import("@/components/ward-management/ward-movements-export")).exportMovementsList(input)
        }
        disabled={disabled}
        testId="ward-movements-export"
      />
    </>
  );
}
