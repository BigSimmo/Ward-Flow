/**
 * The demonstration save's fixed values, shared by the write (`ward-flow-demo-storage.ts`) and the
 * on-demand read (`ward-flow-demo-restore.ts`) without either importing the other at run time, and
 * without loading the stored-state schema (Josh, 21 Oct 2026: no phone script budget raises).
 * `WARD_FLOW_STORED_STATE_VERSION` must equal the one in `ward-flow-storage-validation.ts`;
 * tests/ward-demo-save-recovery.dom.test.tsx checks that.
 */
export const WARD_FLOW_STORED_STATE_VERSION = 7;

export const WARD_FLOW_DEMO_STORAGE_KEY = "ward-flow-demo-state-v1";

/**
 * The opening words of the routine "your last save came back" notice. The shell shows that notice
 * once per tab and lets it fade (simplification A3, 19 Oct 2026); the two failure notices stay.
 */
export const RESTORED_NOTICE_PREFIX = "Restored the last successful save from";

export const STORAGE_UNAVAILABLE =
  "Demo storage is unavailable. Changes stay in memory and may be lost when this page closes.";
