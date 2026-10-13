import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import DATA from "./data.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const reducerPath = "src/components/ward-management/ward-flow-reducer.ts";
const eventPath = "src/components/ward-management/ward-flow-events.ts";
const reducer = fs.readFileSync(path.join(root, reducerPath), "utf8");
const events = fs.readFileSync(path.join(root, eventPath), "utf8");
export const masterAdditions = [
  ...["placement", "asked", "inPrinciple", "pulled", "booked", "handover", "enroute"].map((from, index) => ({
    id: `audit-${from}-community`,
    from,
    to: "cmhtFromSearch",
    label: "Redirect this open bed search to a community referral",
    event: "REFER_TO_COMMUNITY_TEAM",
    source: `${reducerPath}:2861`,
    condition:
      "Before collection only; valid named team and conclusive examination when required. Creates or reuses the referral arm, closes the bed search, cancels uncollected transport and releases its held admission. This is not automatic community acceptance.",
    channel: 574 + index * 12,
  })),
  {
    id: "audit-ed-community-continuation",
    from: "edToCommunity",
    to: "cmhtFromSearch",
    label: "Continue into the real community referral arm",
    event: "REFER_TO_COMMUNITY_TEAM",
    source: `${reducerPath}:2861`,
    condition:
      "A successful diversion creates or reuses the community arm; the receiving team must still answer. Rejection or more information is handled by that arm. No implied accepted admission.",
    channel: 1234,
  },
  {
    id: "audit-repatriation-placement",
    from: "dRepat",
    to: "placement",
    label: "Agreed receiving ward: start a new home-hospital bed search",
    event: "RECORD_REPATRIATION",
    source: `${reducerPath}:8886`,
    condition:
      "Only when receivingWardAgreed is true and the repatriation record is valid. Creates a distinct placement_requested movement referencing the existing admission. No transport booking, departure or discharge is implied.",
    channel: 1218,
  },
];

export const masterGaps = [
  {
    node: "sStopTransport",
    title: "Held-bed release after stopped transport is an action, not a separate result box",
    detail:
      "RELEASE_HELD_BED is catalogued against this box. The map has no dedicated result box. It must not be linked to bedReleased, which records an admitted patient's leaving. Keep the distinction visible in the existing detail panel.",
  },
  {
    node: "sAbscond",
    title: "Historical absence finding remains unvalidated",
    detail:
      "The source box says absence has no state. This connection audit did not run current patient-state behaviour; this wording remains historical, not a confirmed present defect. The wider care map separately models absence review and conditional return.",
  },
  {
    node: "end1",
    title: "A transfer outcome does not itself create the receiving admission",
    detail:
      "The end box records the existing ward's leaving outcome. A new receiving episode needs its own referral, assessment and acceptance. No automatic end1-to-occupied connector was invented.",
  },
  {
    node: "cmhtExempt",
    title: "This box is a policy note, not a disconnected patient step",
    detail:
      "No incoming or onward patient route is required for this explanatory box. Likewise headings, record annotations and independent source starts are not missing patient-flow connections.",
  },
];

export function directedMasterEdges(stages) {
  return stages.edges
    .flatMap((edge, index) => [
      { id: `source-${index + 1}`, ...edge, disposition: "Original drawn link" },
      ...(edge.both && edge.from !== edge.to
        ? [
            {
              ...edge,
              id: `source-${index + 1}-reverse`,
              from: edge.to,
              to: edge.from,
              disposition: "Reverse direction already implied by double arrow",
            },
          ]
        : []),
    ])
    .concat(masterAdditions.map((edge) => ({ ...edge, disposition: "Audit-added source-supported continuation" })));
}

// Exhaustive *mechanical* pair review within this finite taxonomy; no inferred route becomes authorised.
export function pairAudit() {
  const lookup = new Map(DATA.nodes.map((n) => [n.id, n]));
  const carePath = (from, to) => {
    const queue = [[from]],
      seen = new Set([from]);
    while (queue.length) {
      const trail = queue.shift();
      for (const e of DATA.edges.filter(
        (edge) => edge.from === trail.at(-1) && !["review", "absence", "closure"].includes(edge.type),
      )) {
        if (e.to === to) return [...trail, to];
        if (!seen.has(e.to) && lookup.get(e.to).kind !== "endpoint") {
          seen.add(e.to);
          queue.push([...trail, e.to]);
        }
      }
    }
    return [];
  };
  return DATA.nodes.flatMap((from) =>
    DATA.nodes.map((to) => {
      const direct = DATA.edges.filter((e) => e.from === from.id && e.to === to.id);
      let status, reasoning;
      if (direct.length) {
        status = "Explicit conditional link(s)";
        reasoning =
          "Read every route's interaction and guards; a referral, shared care, review and physical move are different actions.";
      } else if (from.id === "death") {
        status = "Outside living-patient flow after confirmed death";
        reasoning =
          "Post-death administrative, family, coronial and mortuary work is outside this patient-care taxonomy.";
      } else if (from.id === "closed") {
        status = "New episode required for re-entry";
        reasoning =
          "A living person may re-enter through the ordinary entry routes. Preserve the closed episode rather than draw an automatic reopening or transfer.";
      } else if (from.id === to.id) {
        status = "Same-category reassessment / provider change not separately modelled";
        reasoning =
          "A category can contain multiple sites, teams and episodes. No universal local transition rule has been established; confirm actual provider and episode identity.";
      } else if (to.kind === "endpoint") {
        status = "Outcome possible in principle; direct episode rule unconfirmed";
        reasoning =
          "Confirm which service owns the episode and records the actual closure/death. An outcome is not a physical destination or evidence of a planned route.";
      } else if (from.kind === "state" || to.kind === "state") {
        status = "Circumstance / return interface requires specific review";
        reasoning =
          "Match the actual episode, origin, whereabouts and applicable authority; no unrestricted choice of return setting or automatic bed/episode change.";
      } else if ([from.kind, to.kind].some((kind) => ["contact", "service", "team"].includes(kind))) {
        status = "Unconfirmed direct referral / shared-care interface";
        reasoning =
          "Identify the actual programme, referral entitlement, lead provider and accepted tasks. Consultation or referral alone does not move the person or establish admission.";
      } else {
        status = "Unconfirmed direct movement / discharge interface";
        reasoning =
          "Clinical/population fit, receiving acceptance, jurisdiction, capacity, funding and transport need local confirmation. Do not assume all specialty pairs are interchangeable.";
      }
      const structural =
        direct.length ||
        from.kind === "endpoint" ||
        to.kind === "endpoint" ||
        from.id === to.id ||
        from.kind === "state" ||
        to.kind === "state"
          ? []
          : carePath(from.id, to.id);
      return {
        from: from.id,
        to: to.id,
        status,
        reasoning,
        routeIds: direct.map((e) => e.id),
        structuralExample: structural,
        exampleLimit: structural.length
          ? "Graph connectivity example only. Combining links does not establish clinical suitability, acceptance or legal authority."
          : "No indirect care example supplied; absence is not proof of impossibility.",
      };
    }),
  );
}

export function createAudit(stages, actions) {
  const roleBlock = events.slice(events.indexOf("export const EVENT_ROLE"));
  const roleIds = [...roleBlock.matchAll(/^\s{2}([A-Z][A-Z_]+):\s*\[/gmu)].map((m) => m[1]);
  const caseIds = [...new Set([...reducer.matchAll(/case "([A-Z][A-Z_]+)":/gu)].map((m) => m[1]))];
  const mapped = new Set(actions.map((a) => a.event));
  const inputHashes = Object.fromEntries(
    [reducerPath, eventPath, "docs/ward-flow/journey/stages.json", "docs/ward-flow/journey/actions.json"].map(
      (file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ],
    ),
  );
  return {
    date: "2026-10-08",
    baselineLinks: DATA.baselineEdgeCount,
    addedLinks: DATA.edges.length - DATA.baselineEdgeCount,
    totalLinks: DATA.edges.length,
    orderedPairs: pairAudit(),
    masterAdditions,
    masterGaps,
    masterDirected: directedMasterEdges(stages),
    originalMasterLinks: stages.edges.length,
    reverseDirections: stages.edges.filter((e) => e.both && e.from !== e.to).length,
    eventCoverage: {
      roles: roleIds.length,
      cases: caseIds.length,
      catalogued: mapped.size,
      unmappedRoles: roleIds.filter((id) => !mapped.has(id)),
      unmappedCases: caseIds.filter((id) => !mapped.has(id)),
      method: "Static label comparison only; does not prove every guard, UI action, caller or runtime outcome.",
    },
    inputHashes,
    findings: [
      "Master: nine missing continuations identified from two inspected reducer branches; existing double-arrow return directions now appear in the neighbours panel.",
      "WA register: planned child inpatient referral, youth home-treatment/outreach entry, specialist eating-disorder interfaces, regional/cross-border handover, PICU onward/event interfaces, absence return and actual unsupported departure were reviewed.",
      "All 1,600 ordered category pairs receive an explicit disposition. Unconfirmed pairs remain visible; a graph example is not an approved patient journey.",
      "Existing boxes, coordinates, symbols, lane colours and original connecting paths are preserved. Added master lines are an identifiable audit overlay.",
    ],
    unresolved: [
      "Facility-level acceptance, specialty/security/population fit, bed escalation, private funding and cross-border/court authority remain unconfirmed.",
      `The ${DATA.nodes.length} categories compress many programmes. Child liaison, eating-disorder care, youth outreach, clinical rehabilitation and supported residence have different entry rules; a shared category never grants interchangeable access.`,
      "Historic source-map defect wording and remaining state/guard/caller behaviour were not re-audited through the app. Static event labels matching a catalogue are not behavioural completeness.",
      "Public referral summaries conflict on the eating-disorder age boundary; verify the current receiving service rule. No universal age threshold is encoded.",
    ],
  };
}
