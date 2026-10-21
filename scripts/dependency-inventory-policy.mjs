// Generated tool state is not an installed dependency. Keep structural inventory and
// byte identity aligned without excluding executable files that merely share a cache name.
const generatedDirectories = new Set([".cache", ".tmp", ".vite", ".vite-temp"]);

export const installedTreeStampName = ".codex-installed-tree.json";

/** @param {string} name
 * @param {{isDirectory:()=>boolean,isFile:()=>boolean,isSymbolicLink:()=>boolean}} entry
 */
export function isGeneratedDependencyEntry(name, entry) {
  if (entry.isSymbolicLink()) return false;
  return (entry.isDirectory() && generatedDirectories.has(name)) || (entry.isFile() && name === installedTreeStampName);
}
