import styles from "./ward-rail.module.css";

/**
 * Count leak (D-137): the rail's empty shape while a held first load waits to know the desk, so the
 * page does not jump sideways when the rail draws. It carries no figures or links. The early script
 * (ward-rail-early.ts) gives it the stored closed or tablet shape, as it does the rail.
 */
export function WardRailPlaceholder() {
  return <aside className={styles.rail} data-rail="open" data-wf-rail-placeholder="" aria-hidden="true" />;
}
