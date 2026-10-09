import ts from "typescript";

/** These Ward boundary contracts include type-only edges as well as runtime imports. */
export function wardModuleSpecifiers(source: string, fileName: string): string[] {
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const specifiers = new Set<string>();
  const literal = (node: ts.Node | undefined) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = literal(node.arguments[0]);
      if (specifier === undefined)
        throw new Error(
          `Cannot resolve dynamic import in ${fileName}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`,
        );
      specifiers.add(specifier);
    }
    if (ts.isImportTypeNode(node)) {
      const specifier = ts.isLiteralTypeNode(node.argument) ? literal(node.argument.literal) : undefined;
      if (specifier === undefined) throw new Error(`Cannot resolve type import in ${fileName}`);
      specifiers.add(specifier);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...specifiers];
}

export function collectWardModuleGraph(
  entryFiles: readonly string[],
  io: {
    readSource: (file: string) => string;
    resolveSpecifier: (specifier: string, fromFile: string) => string | null;
  },
): Map<string, string> {
  const visited = new Map<string, string>();
  const queue = [...entryFiles];
  while (queue.length) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    const source = io.readSource(file);
    visited.set(file, source);
    for (const specifier of wardModuleSpecifiers(source, file)) {
      const resolved = io.resolveSpecifier(specifier, file);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}
