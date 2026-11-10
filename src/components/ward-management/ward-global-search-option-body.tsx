import { StatusGlyph } from "@/components/wf";
import { formatDateOfBirth } from "@/components/ward-management/ward-patients";
import { CornerDownLeft } from "lucide-react";
import styles from "./ward-global-search.module.css";
import { patientResultTitle, type SearchResultItem } from "./ward-global-search-groups";
import { SearchResultIcon } from "./ward-global-search-icon";
import { ViewCount } from "./ward-global-search-view-count";

/**
 * What one search result row shows: icon, title, meta line, kind and the Enter hint. Shared by the
 * link rows and the Help rows that open in Help itself, so both read the same.
 */
export function SearchOptionBody({
  item,
  nameFor,
  taskWord,
  highlight = "",
}: {
  highlight?: string;
  item: SearchResultItem;
  nameFor: (name: string, umrn: string | undefined | null) => string;
  taskWord: string;
}) {
  return (
    <>
      <span className={styles.itemIconBox} aria-hidden="true">
        {item.tone ? <StatusGlyph tone={item.tone} /> : <SearchResultIcon kind={item.kind} id={item.id} />}
        {item.kind === "view" ? <ViewCount id={item.id} /> : null}
      </span>
      <span className={styles.resultContent}>
        <span className={styles.resultTitle}>{marked(patientResultTitle(item, nameFor), highlight)}</span>
        {item.kind === "view" ? <ViewCount id={item.id} spoken /> : null}
        <span className={styles.resultMeta}>
          {item.umrn ? (
            <>
              <span className={styles.umrn}>{item.umrn}</span>
              {item.dateOfBirth ? <span>born {formatDateOfBirth(item.dateOfBirth)}</span> : null}
            </>
          ) : item.readyBeds !== undefined && !item.meta ? (
            <span>
              {item.siteName} · {item.readyBeds} ready
            </span>
          ) : item.meta ? (
            <span>{marked(item.meta, highlight)}</span>
          ) : null}
        </span>
      </span>
      <span className={styles.resultKind}>{item.kind === "task" ? taskWord : item.kindLabel}</span>
      <span className={styles.actionHint} aria-hidden="true">
        <CornerDownLeft className={styles.actionHintIcon} aria-hidden="true" />
      </span>
    </>
  );
}

/** Marks where each typed word first appears, so a row shows why it matched (Josh, 3 Nov 2026). */
function marked(text: string, query: string) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return text;
  const lower = text.toLowerCase();
  const hits: [number, number][] = [];
  for (const w of words) {
    const at = lower.indexOf(w);
    if (at >= 0) hits.push([at, at + w.length]);
  }
  if (hits.length === 0) return text;
  hits.sort((a, b) => a[0] - b[0]);
  const out: (string | ReturnType<typeof Mark>)[] = [];
  let pos = 0;
  hits.forEach(([a, b], i) => {
    if (a < pos) return;
    out.push(text.slice(pos, a), <Mark key={i} text={text.slice(a, b)} />);
    pos = b;
  });
  out.push(text.slice(pos));
  return out;
}

function Mark({ text }: { text: string }) {
  return <mark className={styles.hit}>{text}</mark>;
}
