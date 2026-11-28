"use client";

import { Download, Printer, Share2 } from "lucide-react";
import { Button, Menu } from "@/components/wf";
import { printPage } from "@/components/ward-management/use-printing";
import { DownloadRefusedError } from "@/components/ward-management/ward-download";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type { exportMovementsList } from "@/components/ward-management/ward-movements-export";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

type ExportInput = Parameters<typeof exportMovementsList>[0];

/** The worklist's Export: loads its builder on the click, so the screen carries none of it up front. */
function useExportLoad(input: ExportInput) {
  const zone = useClockZoneLabel();
  // A failed fetch of the builder reaches the caller's own catch (the Export item shows its refusal line).
  return () =>
    import("@/components/ward-management/ward-movements-export").then(
      (builder) => builder.exportMovementsList({ ...input, zone }),
      (error: unknown) => {
        throw error;
      },
    );
}

/**
 * Simplification mock-up (26 Nov 2026): on a tablet or laptop the worklist's rarer tools share one kit
 * menu on the list head: Print and Export. The Graph or Table switch (D-265) stays visible on the head,
 * not in this menu. Audit three #16 (28 Nov 2026): the phone bar uses the same menu as one Share, as
 * Chronology does (D-159 item 5, one phone rule for Print and Export).
 */
export function MovementsListMenu(props: ExportInput & { disabled?: boolean; share?: boolean; named?: boolean }) {
  // Audit four item 39: `named` draws the Share chip with its word (desktop), so Print and Export are
  // found under "Share" on every width and page.
  const { disabled, share = false, named = false, ...input } = props;
  const load = useExportLoad(input);
  return (
    <Menu
      // Audit four #79: one name for a page's outputs, "Share", on every width; no "List tools".
      label="Share"
      align="end"
      items={[
        {
          id: "print",
          label: "Print list",
          icon: Printer,
          disabled,
          meta: disabled ? "Nothing to print" : undefined,
          onSelect: () => printPage(),
        },
        {
          id: "export",
          label: "Export list",
          icon: Download,
          disabled,
          meta: disabled ? "Nothing to export" : undefined,
          onSelect: () => {
            load().catch((error: unknown) => {
              if (error instanceof DownloadRefusedError) {
                announceToWardShell("Export is not available in this browser");
                return;
              }
              console.error("List export failed", error);
              announceToWardShell("Export failed. Try again.");
            });
          },
        },
      ]}
      trigger={(triggerProps) =>
        named ? (
          <Button {...triggerProps} variant="sec" icon={Share2} data-testid="ward-movements-share">
            Share
          </Button>
        ) : (
          <Button
            {...triggerProps}
            variant="sec"
            iconOnly
            icon={Share2}
            aria-label="Share: print or export this list"
            data-testid={share ? "ward-movements-share" : "ward-movements-list-menu"}
          />
        )
      }
    />
  );
}
