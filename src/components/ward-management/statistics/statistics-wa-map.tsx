"use client";

import type { KeyboardEvent } from "react";

import { cx } from "@/components/wf";

import styles from "./statistics-wa-map.module.css";

/**
 * A simplified map of Western Australia with a Perth metro inset, for the Summary page's Map view.
 *
 * ⚠️ SCHEMATIC, NOT SURVEY GRADE. The coastline is 37 points and the metro positions are placed by
 * eye inside the inset so labels do not collide. Regional sites sit near their longitude
 * and latitude, nudged a little where two circles would overlap. The map shows where a site is relative to the others; it does not measure distance.
 */

export type WaMapStatus = "warning" | "danger";

/** One site as the map draws it. The map draws what it is given; the view derives the figures. */
export type WaMapNode = {
  code: string;
  /** Full site name, for the accessible label and the phone chips. */
  name: string;
  /** Health service colour token, such as `var(--wf-svc-east)`. */
  colour: string;
  /** False when the lens does not apply here (no ED, or no ward): drawn as a small grey dot. */
  applies: boolean;
  /** The lens value, which sizes the circle and tints its centre. */
  value: number;
  /** Centre text. */
  display: string;
  /** Short line under the label ("78% · 4 ready"). */
  sub: string;
  /** 0 to 1, drawn as the ring. */
  ring: number;
  /** Shape-coded status: amber dot for warning, triangle for danger. */
  status?: WaMapStatus;
  /** Accessible name for the node button. */
  ariaLabel: string;
};

type Side = "t" | "b" | "l" | "r";

/** Map labels and their side. Codes missing here use the site name, underneath. */
/** Map labels, their side and an optional vertical nudge so neighbouring labels clear each other. */
const LABELS: Readonly<Record<string, [string, Side, number?]>> = {
  SCGH: ["SCGH", "l", -16],
  GRY: ["Graylands", "l"],
  SJGS: ["SJG Subiaco", "t"],
  RPH: ["Royal Perth", "r"],
  KEMH: ["King Edward", "r"],
  PCH: ["Perth Children's", "l"],
  FRE: ["Fremantle", "l"],
  FSH: ["Fiona Stanley", "b"],
  BTY: ["Bentley", "r"],
  ARM: ["Armadale", "b"],
  SJGM: ["SJG Midland", "t"],
  JHC: ["Joondalup", "r"],
  RGH: ["Rockingham", "l"],
  PEEL: ["Peel", "r"],
  BRM: ["Broome", "r"],
  GER: ["Geraldton", "r"],
  BUN: ["Bunbury", "r", -14],
  ALB: ["Albany", "r", 6],
};

/** Metro sites inside the inset (inset units, 640 by 520), regional sites by longitude and latitude. */
const METRO: Readonly<Record<string, [number, number]>> = {
  JHC: [180, 40],
  SCGH: [250, 140],
  GRY: [168, 176],
  KEMH: [292, 214],
  PCH: [212, 236],
  SJGS: [322, 92],
  RPH: [384, 160],
  SJGM: [548, 88],
  BTY: [452, 216],
  ARM: [548, 318],
  FSH: [304, 304],
  FRE: [160, 268],
  RGH: [172, 380],
  PEEL: [204, 484],
};

const REGIONAL: Readonly<Record<string, [number, number]>> = {
  BRM: [122.24, -17.96],
  GER: [114.61, -28.78],
  BUN: [115.6, -33.1],
  ALB: [118.4, -35.0],
};

/** WA coastline, simplified (longitude, latitude). */
const COAST: ReadonlyArray<[number, number]> = [
  [129, -14.9],
  [128.2, -14.8],
  [127.4, -14.0],
  [126.8, -13.9],
  [125.9, -14.3],
  [125.2, -14.6],
  [124.4, -15.6],
  [124.3, -16.3],
  [123.6, -17.3],
  [122.2, -18.0],
  [121.0, -19.5],
  [119.6, -20.0],
  [118.6, -20.3],
  [116.7, -20.6],
  [115.4, -21.5],
  [114.1, -21.8],
  [113.6, -23.0],
  [113.7, -24.4],
  [113.4, -25.4],
  [113.9, -26.6],
  [114.2, -27.8],
  [114.6, -28.8],
  [115.0, -30.0],
  [115.4, -31.0],
  [115.7, -32.0],
  [115.7, -32.7],
  [115.6, -33.3],
  [115.0, -33.6],
  [115.1, -34.4],
  [116.0, -34.9],
  [117.9, -35.1],
  [119.5, -34.4],
  [121.9, -33.9],
  [123.6, -33.9],
  [124.5, -33.0],
  [126.0, -32.3],
  [129, -31.7],
];

/** Metro coast (west edge of the land) and the Swan River, in inset units. */
const METRO_COAST: ReadonlyArray<[number, number]> = [
  [95, 0],
  [118, 60],
  [128, 120],
  [118, 170],
  [108, 222],
  [124, 282],
  [100, 334],
  [114, 402],
  [118, 470],
  [108, 520],
];
const RIVER: ReadonlyArray<[number, number]> = [
  [124, 236],
  [196, 222],
  [262, 206],
  [330, 176],
  [400, 150],
  [470, 122],
  [520, 98],
];

// Desktop frame: the state on the left, the metro inset on the right.
const VIEW_W = 960;
const VIEW_H = 540;
const px = (lon: number) => 12 + (lon - 112.5) * 21;
const py = (lat: number) => 16 + (-13.5 - lat) * 21;
const INSET = { x: 372, y: 14, k: 0.9 };
const INSET_W = 640 * INSET.k;
const INSET_H = 520 * INSET.k;
const inset = ([x, y]: readonly [number, number]): [number, number] => [INSET.x + x * INSET.k, INSET.y + y * INSET.k];

// Phone frame: the metro area only.
const PHONE_W = 366;
const PHONE_H = 300;
const phone = ([x, y]: readonly [number, number]): [number, number] => [x * 0.64 - 42, y * 0.56 + 10];

const pathOf = (points: ReadonlyArray<readonly [number, number]>) =>
  points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

export const WA_MAP_METRO_CODES: readonly string[] = Object.keys(METRO);
export const WA_MAP_REGIONAL_CODES: readonly string[] = Object.keys(REGIONAL);

/** Whether the map can place this site. A site it cannot place still ranks in the list. */
export function waMapPlaces(code: string): boolean {
  return code in METRO || code in REGIONAL;
}

function desktopXY(code: string): [number, number] | null {
  const metro = METRO[code];
  if (metro) return inset(metro);
  const regional = REGIONAL[code];
  if (regional) return [px(regional[0]), py(regional[1])];
  return null;
}

type Scale = { rMin: number; rMax: number; max: number };

const radiusFor = (node: WaMapNode, scale: Scale) =>
  scale.rMin + (scale.rMax - scale.rMin) * Math.sqrt(Math.max(0, node.value) / Math.max(1, scale.max));

/** Centre tint grows with the lens value, from a faint wash to a firm accent tint. */
const tintFor = (node: WaMapNode, scale: Scale) =>
  `color-mix(in srgb, var(--wf-accent) ${Math.round(2 + 16 * (Math.max(0, node.value) / Math.max(1, scale.max)))}%, var(--wf-surface))`;

function Node({
  node,
  x,
  y,
  scale,
  label,
  side,
  nudge = 0,
  compact,
  selected,
  highlighted,
  onSelect,
}: {
  node: WaMapNode;
  x: number;
  y: number;
  scale: Scale;
  label: string;
  side: Side;
  nudge?: number;
  compact: boolean;
  selected: boolean;
  highlighted: boolean;
  onSelect: (code: string) => void;
}) {
  if (!node.applies) {
    return (
      <g className={styles.ghost} aria-hidden="true">
        <circle cx={x} cy={y} r={compact ? 3 : 4} />
      </g>
    );
  }
  const r = radiusFor(node, scale);
  const ringR = r + (compact ? 3 : 4);
  const circumference = 2 * Math.PI * ringR;
  const ring = Math.min(1, Math.max(0, node.ring));
  const offset = r + (compact ? 6 : 10);
  const lx = side === "l" ? x - offset : side === "r" ? x + offset : x;
  const ly = (side === "t" ? y - offset - 18 : side === "b" ? y + offset + 15 : y - 2) + nudge;
  const anchor = side === "l" ? "end" : side === "r" ? "start" : "middle";
  const gx = x + r * 0.72;
  const gy = y - r * 0.72;
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(node.code);
    }
  };
  return (
    <g
      className={cx(styles.node, selected && styles.on, highlighted && styles.hl)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={node.ariaLabel}
      data-site={node.code}
      onClick={() => onSelect(node.code)}
      onKeyDown={onKeyDown}
    >
      {/* A 48px hit area on the phone map, wider than the drawn circle. */}
      <circle cx={x} cy={y} r={Math.max(ringR, compact ? 24 : 0)} className={styles.hit} />
      {selected || highlighted ? <circle cx={x} cy={y} r={ringR + (compact ? 6 : 8)} className={styles.halo} /> : null}
      <circle cx={x} cy={y} r={ringR} className={styles.track} />
      {ring > 0 ? (
        <circle
          cx={x}
          cy={y}
          r={ringR}
          className={styles.arc}
          style={{ stroke: node.colour }}
          strokeDasharray={`${(circumference * ring).toFixed(1)} ${circumference.toFixed(1)}`}
          transform={`rotate(-90 ${x} ${y})`}
        />
      ) : null}
      <circle cx={x} cy={y} r={r} className={styles.core} style={{ fill: tintFor(node, scale) }} />
      <text x={x} y={y + (compact ? 4 : 5)} className={compact ? styles.figSm : styles.fig} textAnchor="middle">
        {node.display}
      </text>
      {node.status ? (
        <g transform={`translate(${gx} ${gy})`} className={styles.status}>
          <circle r={compact ? 6 : 7.5} className={styles.statusBack} />
          {node.status === "danger" ? (
            <path d={compact ? "M0 -4 4.4 3.6 -4.4 3.6Z" : "M0 -5 5.4 4.4 -5.4 4.4Z"} className={styles.danger} />
          ) : (
            <circle r={compact ? 3.6 : 4.4} className={styles.warning} />
          )}
        </g>
      ) : null}
      {compact ? (
        <text x={x} y={y + ringR + 14} className={styles.code} textAnchor="middle">
          {node.code}
        </text>
      ) : (
        <>
          <text x={lx} y={ly} className={styles.label} textAnchor={anchor}>
            {label}
          </text>
          <text x={lx} y={ly + 17} className={styles.sub} textAnchor={anchor}>
            {node.sub}
          </text>
        </>
      )}
    </g>
  );
}

/**
 * The map itself: the whole state with a Perth metro inset on desktop, the metro area alone with the
 * country sites as chips on the phone. Each placed site is a button that selects it.
 */
export function StatisticsWaMap({
  nodes,
  selected,
  highlighted,
  onSelect,
  label,
}: {
  nodes: readonly WaMapNode[];
  selected: string | null;
  highlighted: string | null;
  onSelect: (code: string) => void;
  label: string;
}) {
  const max = Math.max(1, ...nodes.filter((node) => node.applies).map((node) => node.value));
  const wide: Scale = { rMin: 13, rMax: 27, max };
  const narrow: Scale = { rMin: 10, rMax: 19, max };

  const coast = `${pathOf(COAST.map(([lon, lat]) => [px(lon), py(lat)] as const))}Z`;
  const perth: [number, number] = [px(115.86), py(-31.95)];
  const insetCoast = `M${INSET.x} ${INSET.y} ${METRO_COAST.map((p) => {
    const [x, y] = inset(p);
    return `L${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ")} L${INSET.x} ${INSET.y + INSET_H}Z`;
  const river = pathOf(RIVER.map(inset));
  const phoneCoast = `M0 0 ${METRO_COAST.map((p) => {
    const [x, y] = phone(p);
    return `L${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ")} L0 ${PHONE_H}Z`;
  const phoneRiver = pathOf([...RIVER, [560, 90] as const].map(phone));

  const byCode = new Map(nodes.map((node) => [node.code, node]));
  // Applying nodes last, so a live circle is never painted under a grey dot.
  const ordered = [...nodes].sort((a, b) => Number(a.applies) - Number(b.applies) || b.value - a.value);
  const country = WA_MAP_REGIONAL_CODES.map((code) => byCode.get(code)).filter(
    (node): node is WaMapNode => node !== undefined,
  );

  return (
    <div className={styles.map} data-testid="ward-statistics-wa-map">
      <svg
        className={styles.wide}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="group"
        aria-label={`${label}. Western Australia with a Perth metro inset.`}
        data-testid="ward-statistics-wa-map-wide"
      >
        <path d={coast} className={styles.land} />
        <text x={px(121.4)} y={py(-24.6)} className={styles.region} textAnchor="middle">
          Western Australia
        </text>
        <path
          d={`M${perth[0] + 8} ${perth[1] - 6} C${perth[0] + 90} ${perth[1] - 120} ${INSET.x - 70} ${INSET.y + 140} ${INSET.x} ${INSET.y + 110}`}
          className={styles.lead}
        />
        <rect x={perth[0] - 9} y={perth[1] - 9} width={18} height={18} rx={9} className={styles.perth} />
        <rect x={INSET.x} y={INSET.y} width={INSET_W} height={INSET_H} rx={22} className={styles.inset} />
        <clipPath id="ward-statistics-wa-map-inset">
          <rect x={INSET.x} y={INSET.y} width={INSET_W} height={INSET_H} rx={22} />
        </clipPath>
        <g clipPath="url(#ward-statistics-wa-map-inset)">
          <path d={insetCoast} className={styles.sea} />
          <path d={river} className={styles.river} />
        </g>
        <text x={INSET.x + INSET_W - 16} y={INSET.y + INSET_H - 14} className={styles.region} textAnchor="end">
          Perth metro
        </text>
        <text x={INSET.x + 16} y={INSET.y + INSET_H - 14} className={styles.regionSm}>
          Indian Ocean
        </text>
        {ordered.map((node) => {
          const xy = desktopXY(node.code);
          if (!xy) return null;
          const [text, side, nudge = 0] = LABELS[node.code] ?? [node.name, "b" as Side];
          return (
            <Node
              key={node.code}
              node={node}
              x={xy[0]}
              y={xy[1]}
              scale={wide}
              label={text}
              side={side}
              nudge={nudge}
              compact={false}
              selected={selected === node.code}
              highlighted={highlighted === node.code}
              onSelect={onSelect}
            />
          );
        })}
      </svg>

      <div className={styles.phone}>
        <svg
          viewBox={`0 0 ${PHONE_W} ${PHONE_H}`}
          role="group"
          aria-label={`${label}. Perth metro.`}
          data-testid="ward-statistics-wa-map-phone"
        >
          <path d={phoneCoast} className={styles.sea} />
          <path d={phoneRiver} className={styles.riverSm} />
          {ordered.map((node) => {
            const at = METRO[node.code];
            if (!at) return null;
            const [x, y] = phone(at);
            return (
              <Node
                key={node.code}
                node={node}
                x={x}
                y={y}
                scale={narrow}
                label={node.code}
                side="b"
                compact
                selected={selected === node.code}
                highlighted={highlighted === node.code}
                onSelect={onSelect}
              />
            );
          })}
        </svg>
        {country.length > 0 ? (
          <div className={styles.country} role="group" aria-label="Country sites">
            <span className={styles.countryLabel}>Country</span>
            {country.map((node) => (
              <button
                key={node.code}
                type="button"
                className={cx(styles.chip, selected === node.code && styles.chipOn)}
                aria-pressed={selected === node.code}
                aria-label={node.ariaLabel}
                onClick={() => onSelect(node.code)}
              >
                <span className={styles.chipDot} style={{ background: node.colour }} aria-hidden="true" />
                {LABELS[node.code]?.[0] ?? node.name}
                <span className={styles.chipValue}>{node.applies ? node.display : "none"}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
