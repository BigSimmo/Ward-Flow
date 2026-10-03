// Exact module resolution for isolated FULL rechecks. Uncertainty keeps the full gate.
import ts from "typescript";
import path from "node:path";
import { readFileSync } from "node:fs";

export function referencedTestChanges({ root, population, changed }) {
  const blocked = new Set();
  const graph = new Map();
  const configPath = ts.findConfigFile(root, ts.sys.fileExists);
  if (!configPath) return [...changed];
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return [...changed];
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  if (parsed.errors.length) return [...changed];
  const key = (file) => {
    const absolute = path.resolve(file);
    return process.platform === "win32" ? absolute.toLowerCase() : absolute;
  };
  const targets = new Map(changed.map((file) => [key(path.join(root, file)), file]));
  let uncertain = false;
  function visit(file) {
    const id = key(file);
    if (graph.has(id)) return;
    const imports = new Set();
    graph.set(id, imports);
    let source;
    try {
      source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    } catch {
      uncertain = true;
      return;
    }
    if (source.parseDiagnostics.length) uncertain = true;
    function resolve(specifier) {
      const result = ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule;
      if (!result) {
        if (specifier.startsWith(".") || specifier.startsWith("@/")) uncertain = true;
        return;
      }
      if (result.isExternalLibraryImport || result.resolvedFileName.endsWith(".d.ts")) return;
      imports.add(key(result.resolvedFileName));
      visit(result.resolvedFileName);
    }
    function walk(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        if (ts.isStringLiteralLike(node.moduleSpecifier)) resolve(node.moduleSpecifier.text);
        else uncertain = true;
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        const argument = node.arguments[0];
        if (node.arguments.length === 1 && argument && ts.isStringLiteralLike(argument)) resolve(argument.text);
        else uncertain = true;
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  for (const file of population) visit(path.join(root, file));
  if (uncertain) return [...changed];
  for (const file of population) {
    const origin = key(path.join(root, file));
    const seen = new Set([origin]);
    const queue = [...(graph.get(origin) ?? [])];
    for (let index = 0; index < queue.length; index++) {
      const dependency = queue[index];
      if (seen.has(dependency)) continue;
      seen.add(dependency);
      if (targets.has(dependency)) blocked.add(targets.get(dependency));
      queue.push(...(graph.get(dependency) ?? []));
    }
  }
  // Exported test helpers may be consumed outside the collected population.
  for (const file of changed) {
    const source = ts.createSourceFile(file, readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
    if (
      source.statements.some(
        (node) =>
          ts.isExportDeclaration(node) ||
          ts.isExportAssignment(node) ||
          node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
      )
    )
      blocked.add(file);
  }
  return [...blocked].sort();
}
