import type { WhatsNewFile, WhatsNewEntry } from "./whats-new-list";

/**
 * Every file in `whats-new/`, read by the bundler at build time (webpack and Turbopack both support
 * `require.context`). Tests read the same folder from disk instead (`tests/stubs/whats-new-files.ts`).
 */
type BundlerRequire = NodeJS.Require & {
  context(directory: string, recursive: boolean, filter: RegExp): { keys(): string[]; (key: string): unknown };
};

const folder = (require as BundlerRequire).context("./whats-new", false, /\.json$/);

export const WHATS_NEW_FILES: readonly WhatsNewFile[] = folder.keys().map((key) => {
  const loaded = folder(key) as WhatsNewEntry | { default: WhatsNewEntry };
  const entry = "default" in loaded ? loaded.default : loaded;
  return { name: key.replace(/^.*\//u, ""), entry };
});
