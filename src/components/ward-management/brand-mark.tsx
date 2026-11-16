import { useId } from "react";

import { BRAND_MASTERS, pickBrandMaster, type BrandMasterName } from "@/lib/brand-mark";

/**
 * The BedChart mark, the Folded B (D-261). One component for every in-app place: the rail, the
 * executive chrome, the front door and the lock screens. The geometry is the shared source in
 * `@/lib/brand-mark`, also used by the icons, and `size` picks the optical master for the pixels
 * it is drawn at.
 *
 * Colours come from CSS, never props: the two parts paint with `--bc-pillow` and `--bc-bed`,
 * which fall back to the theme's brand tokens (`--wf-brand-pillow`, `--wf-brand-bed`). A surface
 * on the navy hero sets those two properties to the on-hero tokens, so one mark follows light,
 * dark and the hero band without any theme code here.
 */
export function BrandMark({ size, master, className }: { size: number; master?: BrandMasterName; className?: string }) {
  const id = useId().replace(/:/g, "");
  const m = BRAND_MASTERS[master ?? pickBrandMaster(size)];
  const pillow = "var(--bc-pillow, var(--wf-brand-pillow))";
  const bed = "var(--bc-bed, var(--wf-brand-bed))";
  const maskId = `bc-crease-${id}`;
  return (
    <svg
      viewBox={`0 0 ${m.viewBox} ${m.viewBox}`}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      data-brand-mark=""
    >
      {m.flap ? (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={m.viewBox} height={m.viewBox}>
              <rect width={m.viewBox} height={m.viewBox} fill="white" />
              <path d={m.flap} fill="none" stroke="black" strokeWidth={m.crease} strokeLinejoin="round" />
            </mask>
          </defs>
          <path d={m.pillow} style={{ fill: pillow }} />
          <g mask={`url(#${maskId})`}>
            <path d={m.bed} style={{ fill: bed }} />
            <path d={m.flap} style={{ fill: pillow }} />
          </g>
        </>
      ) : (
        <>
          <path d={m.pillow} style={{ fill: pillow }} />
          <path d={m.bed} style={{ fill: bed }} />
        </>
      )}
    </svg>
  );
}

/** "BedChart" set as the wordmark: "Bed" at 600, "Chart" at 400. Any other name is set whole. */
export function BrandName({ name, className }: { name: string; className?: string }) {
  if (name === "BedChart") {
    return (
      <span className={className} data-brand-name="">
        <span style={{ fontWeight: 600 }}>Bed</span>
        <span style={{ fontWeight: 400 }}>Chart</span>
      </span>
    );
  }
  return <span className={className}>{name}</span>;
}
