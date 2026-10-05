"use client";

import { FLOW_ROUTES } from "../movement-flow-parts";
import styles from "../movement-flow.module.css";

import { MovementRecordProposal } from "./movement-record-proposal";

/**
 * Preview-only frame for the proposed movement record. The Movements board and Transport Hub
 * from the same proposal are now the live screens; this record stays a preview while movement
 * links open the unified patient page.
 */
export function MovementProposalPreview({ id }: { id?: string }) {
  const movementId = id ?? "WF-001";
  return (
    <>
      <div className={styles.previewBar} data-testid="movement-proposal-preview-bar">
        <strong>Proposed movement record (preview)</strong>
        <nav className={styles.previewTabs} aria-label="Movement screens">
          <a href={FLOW_ROUTES.board}>Movements</a>
          <a href={FLOW_ROUTES.transport}>Transport Hub</a>
        </nav>
        <a className={styles.link} href={FLOW_ROUTES.movement(movementId)}>
          Current screen ›
        </a>
      </div>
      <MovementRecordProposal movementId={movementId} />
    </>
  );
}
