import { cx } from "./cx";
import styles from "./umrn.module.css";

/**
 * Audit two #81 (K30): the one way to draw a UMRN, in place of the many local mono classes. Mono with
 * tabular figures in ink-2, at the size of the text around it, never broken across lines. `prefix`
 * adds the word "UMRN" for prose and print; lists and drawers show the number alone. Copy rules
 * (the UMRN left off copied text) stay in the copy builders.
 */
export function Umrn({
  value,
  prefix = false,
  className,
  "data-testid": testId,
}: {
  value: string;
  prefix?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <span className={cx(styles.umrn, className)} data-wf-umrn="" data-testid={testId}>
      {prefix ? "UMRN " : null}
      {value}
    </span>
  );
}
