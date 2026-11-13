/**
 * The legal position's home is the ward root, `ward-legal-form-progression.ts`, so every screen can
 * read it without importing the legal forms screen (`tests/ward-import-map-guard.test.ts`). This file
 * keeps the old path working for the legal forms screen's own files and the tests.
 */
export * from "@/components/ward-management/ward-legal-form-progression";
