"use client";

import { ChevronDown } from "lucide-react";

import { Icon, Menu, buttonClass } from "@/components/wf";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useOptionalRouter } from "@/components/ward-management/statistics/statistics-nav";
import type { WardMetadata } from "@/components/ward-management/statistics/statistics-wards-index";

/** The hero's Change ward menu, moved out of the One ward fork to keep it under the file cap. */
export function ChangeWard({ units, currentId }: { units: WardMetadata[]; currentId: string }) {
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
        <button {...props} type="button" className={buttonClass({ variant: "onHero", size: "sm" })}>
          Change ward
          <Icon icon={ChevronDown} size={14} />
        </button>
      )}
    />
  );
}
