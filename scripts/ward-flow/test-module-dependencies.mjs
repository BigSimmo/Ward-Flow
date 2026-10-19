// Exact module resolution for isolated FULL rechecks. Uncertainty keeps the full gate.
import ts from "typescript";
import path from "node:path";
import { readFileSync } from "node:fs";
import { isBuiltin } from "node:module";

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
    const requireAliases = new Set();
    graph.set(id, imports);
    let source;
    try {
      source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    } catch {
      uncertain = true;
      return;
    }
    if (source.parseDiagnostics.length) uncertain = true;
    // Deliberately bounded static resolution: only uniquely named local const literals,
    // with no other same-name occurrences beyond direct module-load arguments.
    // Checking the entire file first rejects writes and shadowed bindings even
    // when they occur after a load or inside a nested/destructured scope.
    const constantModules = new Map();
    function collectConstants(node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isVariableDeclarationList(node.parent) &&
        ts.isVariableStatement(node.parent.parent) &&
        (ts.isSourceFile(node.parent.parent.parent) || ts.isBlock(node.parent.parent.parent)) &&
        node.parent.flags & ts.NodeFlags.Const &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isStringLiteralLike(node.initializer)
      )
        constantModules.set(node.name.text, node);
      ts.forEachChild(node, collectConstants);
    }
    collectConstants(source);
    function checkConstantUses(node) {
      if (ts.isIdentifier(node) && constantModules.has(node.text)) {
        const declaration = constantModules.get(node.text);
        const parent = node.parent;
        const declarationScope = declaration.parent.parent.parent;
        let inScope = false;
        for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
          if (ancestor === declarationScope) {
            inScope = true;
            break;
          }
        }
        const moduleArgument =
          inScope &&
          node.pos >= declaration.end &&
          ts.isCallExpression(parent) &&
          parent.arguments.length === 1 &&
          parent.arguments[0] === node &&
          (parent.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(parent.expression) && parent.expression.text === "require"));
        if (node !== declaration.name && !moduleArgument) constantModules.delete(node.text);
      }
      ts.forEachChild(node, checkConstantUses);
    }
    checkConstantUses(source);
    function resolve(specifier, requireResolution = false) {
      const result = ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule;
      if (!result) {
        if (specifier.startsWith(".") || specifier.startsWith("@/") || (requireResolution && !isBuiltin(specifier)))
          uncertain = true;
        return;
      }
      if (result.isExternalLibraryImport || result.resolvedFileName.endsWith(".d.ts")) return;
      imports.add(key(result.resolvedFileName));
      visit(result.resolvedFileName);
    }
    function walk(node) {
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        const expression = node.moduleReference.expression;
        if (expression && ts.isStringLiteralLike(expression)) resolve(expression.text);
        else uncertain = true;
      }
      // eval/new Function keep the full gate only when their code text itself loads modules; running
      // opaque code (e.g. a theme bootstrap script) is not a module load. A createRequire result is
      // tracked as a require alias so literal loads resolve and non-literal ones stay uncertain.
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        ts.isIdentifier(node.expression) &&
        ["eval", "Function"].includes(node.expression.text) &&
        (node.arguments ?? []).some(
          (argument) => ts.isStringLiteralLike(argument) && /\b(?:import|require)\b/u.test(argument.text),
        )
      )
        uncertain = true;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "createRequire") {
        if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name))
          requireAliases.add(node.parent.name.text);
        else uncertain = true;
      }
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        if (ts.isStringLiteralLike(node.moduleSpecifier)) resolve(node.moduleSpecifier.text);
        else uncertain = true;
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            (node.expression.text === "require" || requireAliases.has(node.expression.text))))
      ) {
        const argument = node.arguments[0];
        if (node.arguments.length === 1 && argument && ts.isStringLiteralLike(argument)) resolve(argument.text);
        else if (
          node.arguments.length === 1 &&
          argument &&
          ts.isIdentifier(argument) &&
          constantModules.has(argument.text)
        )
          resolve(constantModules.get(argument.text).initializer.text, true);
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
