"use client";

import type { HealthService } from "@/components/ward-management/ward-model";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";

import { Badge } from "./badge";
import { cx } from "./cx";
import styles from "./figure.module.css";

/** The words a scope tag uses for a figure that counts the whole network. */
export const NETWORK_WIDE = "Network-wide";

export type FigureScope = {
  /** The chosen service, or `null` for All services. */
  service: HealthService | null;
  /** True when the figure is narrowed to the chosen service. */
  scoped: boolean;
  /** What the figure covers: the service's short name ("CAHS") when scoped, else "Network-wide". */
  words: string;
  /** True when a "Network-wide" tag must sit beside the figure: a service is chosen and the figure ignores it. */
  showNote: boolean;
};

/**
 * Kit rule b (Josh, 3 Nov 2026): every figure follows the chosen service, or says "Network-wide"
 * beside it. Pure, so the rule is tested without a browser store. `followsService` is the caller's
 * own statement of whether its figure is computed from the scoped records.
 */
export function figureScope(service: HealthService | null, followsService: boolean): FigureScope {
  const scoped = service !== null && followsService;
  return {
    service,
    scoped,
    words: scoped ? healthServiceAcronym(service) || service : NETWORK_WIDE,
    showNote: service !== null && !followsService,
  };
}

/** The same answer for the service chosen now, read from the one service store every page uses. */
export function useFigureScope(followsService: boolean): FigureScope {
  return figureScope(useServiceScope(), followsService);
}

/**
 * The "Network-wide" tag beside a figure that does not follow the chosen service. Renders nothing
 * while All services is chosen, or when the figure is scoped, because then the figure already
 * matches what the page shows.
 */
export function ScopeNote({
  followsService,
  onHero = false,
  className,
}: {
  followsService: boolean;
  /** On the hero band, the tag takes the band's badge look. */
  onHero?: boolean;
  className?: string;
}) {
  const scope = useFigureScope(followsService);
  if (!scope.showNote) return null;
  return (
    <Badge size="sm" variant={onHero ? "onHero" : "default"} className={cx(styles.scope, className)}>
      {scope.words}
    </Badge>
  );
}
