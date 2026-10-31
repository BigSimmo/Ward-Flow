"use client";

import { ChevronDown } from "lucide-react";

import { Icon, Menu, buttonClass } from "@/components/wf";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useOptionalRouter } from "./statistics-nav";
import type { WardMetadata } from "./statistics-wards-index";

/** The hero's Change ward menu, split out of statistics-ward-screen.tsx to keep it under the file cap. */
export function ChangeWard({
  units,
  currentId,
  className,
}: {
  units: WardMetadata[];
  currentId: string;
  /** Extra class for the trigger (the phone hero's pill). */
  className?: string;
}) {
  const router = useOptionalRouter();
  return (
    <Menu
      label="Change ward"
      items={units.map((candidate) => ({
        id: candidate.id,
        label: candidate.name,
        meta: candidate.siteCode,
        disabled: candidate.id === currentId,
        onSelect: () => {
          const href = wardStatisticsHref(candidate.id);
          if (router) router.push(href);
          else window.location.assign(href);
        },
      }))}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={
            className
              ? `${buttonClass({ variant: "onHero", size: "sm" })} ${className}`
              : buttonClass({ variant: "onHero", size: "sm" })
          }
        >
          Change ward
          <Icon icon={ChevronDown} size={14} />
        </button>
      )}
    />
  );
}
