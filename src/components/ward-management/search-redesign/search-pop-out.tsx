"use client";

/**
 * MOCK-UP for Josh's approval (D-74): the header search as a pop-out, like Help. Not wired into
 * `/ward-flow`; shown only at `/mockups/ward-flow-search`, which production blocks.
 *
 * It runs the real engine (`searchWardFlow`), the real groups (`smartSearchGroups`) and the real
 * Help rows (`headerHelpRows`) over the synthetic world, so every row is a real result. What it
 * proposes is the shape: on a phone a full-height sheet that rises like Help's, with the field
 * pinned at the top and suggestions before anything is typed; on a tablet or computer a centred
 * pop-out with the matched words marked in each row.
 */
import Link from "next/link";
import { Search } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";

import { Sheet, TextInput, useIsPhone } from "@/components/wf";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { queryWords } from "@/components/ward-management/search/search-text";
import { useTourRole } from "@/components/ward-management/help/ward-help-store";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { headerHelpRows } from "@/components/ward-management/ward-global-search-help";
import {
  smartSearchGroups,
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/ward-management/ward-global-search-groups";
import { SearchResultIcon } from "@/components/ward-management/ward-global-search-icon";

import styles from "./search-redesign.module.css";

/** What the empty pop-out offers: one tap fills the box with a question the search answers. */
const SUGGESTIONS = ["free beds", "accepted", "how do I book transport", "bed flow coordinator", "Morley"] as const;

const KINDS: readonly { id: string; label: string; groups: readonly string[] }[] = [
  { id: "all", label: "All", groups: [] },
  { id: "people", label: "People", groups: ["people", "similar", "movements", "referrals"] },
  { id: "places", label: "Places", groups: ["beds", "wards", "eds", "teams", "suburbs"] },
  { id: "contacts", label: "Contacts", groups: ["contacts"] },
  { id: "help", label: "Help", groups: ["help"] },
];

/** The title with each typed word marked, folded as the search folds it. */
function MarkedText({ text, query }: { text: string; query: string }): ReactNode {
  const words = queryWords(query).filter((word) => word.length > 1);
  if (words.length === 0) return text;
  // Built by joining, not a template literal, so the escapes stay as written (design-language contract).
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp("(" + escaped.join("|") + ")", "gi");
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className={styles.mark}>
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function useMockSearch(query: string): readonly SearchResultGroup[] {
  const { movements, patients, units, referrals, admissions } = useWardFlowSelect(
    "movements",
    "patients",
    "units",
    "referrals",
    "admissions",
  );
  const now = useWardFlowClock();
  const role = useTourRole();
  return useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const results = searchWardFlow({ query: trimmed, patients, movements, units, referrals, now, admissions });
    const help = headerHelpRows(trimmed, role).items;
    return smartSearchGroups(results, trimmed, units, { patients, referrals, movements }, undefined, help);
  }, [query, patients, movements, units, referrals, now, admissions, role]);
}

function Row({ item, query }: { item: SearchResultItem; query: string }) {
  return (
    <li>
      <Link href={item.href || "#"} className={styles.row}>
        <span className={styles.rowIcon} aria-hidden="true">
          <SearchResultIcon kind={item.kind} id={item.id} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>
            <MarkedText text={item.title} query={query} />
          </span>
          {item.meta ? <span className={styles.rowMeta}>{item.meta}</span> : null}
        </span>
        <span className={styles.rowKind}>{item.kindLabel}</span>
      </Link>
    </li>
  );
}

/** The pop-out's contents: field, kind chips, then suggestions or grouped results. */
export function SearchPopOutBody({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState("all");
  const groups = useMockSearch(query);
  const chosen = KINDS.find((entry) => entry.id === kind) ?? KINDS[0]!;
  const shown = groups
    .filter((group) => chosen.id === "all" || chosen.groups.includes(group.key))
    .map((group) => ({ ...group, items: chosen.id === "all" ? group.items.slice(0, 4) : group.items }));
  const count = (entry: (typeof KINDS)[number]) =>
    groups
      .filter((group) => entry.id === "all" || entry.groups.includes(group.key))
      .reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className={styles.popBody}>
      <div className={styles.popHead}>
        <TextInput
          type="search"
          icon={Search}
          aria-label="Search people, places, contacts and Help"
          placeholder="People, places, contacts or a question"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          autoComplete="off"
          enterKeyHint="search"
          boxClassName={styles.popField}
        />
        {query.trim() ? (
          <div className={styles.chips} role="group" aria-label="Kind of result">
            {KINDS.map((entry) => {
              const n = count(entry);
              if (entry.id !== "all" && n === 0) return null;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={kind === entry.id}
                  onClick={() => setKind(entry.id)}
                >
                  {entry.label} <span className={styles.chipCount}>{n}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {query.trim() === "" ? (
        <section className={styles.section} aria-label="Try">
          <h3 className={styles.sectionHead}>Try</h3>
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className={styles.suggestion} onClick={() => setQuery(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
          <p className={styles.note}>
            Names, UMRNs, wards, EDs, teams, forms, screens, on-call contacts, a suburb or postcode, or a question for
            Help.
          </p>
        </section>
      ) : shown.length === 0 ? (
        <p className={styles.note}>
          No matches for &ldquo;{query.trim()}&rdquo;. This does not say whether the person or place exists.
        </p>
      ) : (
        shown.map((group) => (
          <section key={group.key} className={styles.section} aria-label={group.heading}>
            <h3 className={styles.sectionHead}>
              {group.heading} <span className={styles.chipCount}>{group.items.length}</span>
            </h3>
            <ul className={styles.rows}>
              {group.items.map((item) => (
                <Row key={`${item.kind}-${item.id}`} item={item} query={query} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** The pop-out itself: a full-height sheet on a phone, a centred pop-out above it. */
export function SearchPopOut({
  open,
  onClose,
  initialQuery,
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const isPhone = useIsPhone();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Search"
      mobilePlacement={isPhone ? "fullscreen" : undefined}
      mobileBreakpoint="phone"
      contentClassName={styles.popSheet}
    >
      <SearchPopOutBody initialQuery={initialQuery} />
    </Sheet>
  );
}
