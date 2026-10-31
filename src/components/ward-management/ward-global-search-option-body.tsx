import { StatusGlyph } from "@/components/wf";
import { formatDateOfBirth } from "@/components/ward-management/ward-patients";
import { CornerDownLeft } from "lucide-react";
import styles from "./ward-global-search.module.css";
import { patientResultTitle, type SearchResultItem } from "./ward-global-search-groups";
import { SearchResultIcon } from "./ward-global-search-icon";

/**
 * What one search result row shows: icon, title, meta line, kind and the Enter hint. Shared by the
 * link rows and the Help rows that open in Help itself, so both read the same.
 */
export function SearchOptionBody({
  item,
  nameFor,
  taskWord,
}: {
  item: SearchResultItem;
  nameFor: (name: string, umrn: string | undefined | null) => string;
  taskWord: string;
}) {
  return (
    <>
      <span className={styles.itemIconBox} aria-hidden="true">
        {item.tone ? <StatusGlyph tone={item.tone} /> : <SearchResultIcon kind={item.kind} id={item.id} />}
      </span>
      <span className={styles.resultContent}>
        <span className={styles.resultTitle}>{patientResultTitle(item, nameFor)}</span>
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
            <span>{item.meta}</span>
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
