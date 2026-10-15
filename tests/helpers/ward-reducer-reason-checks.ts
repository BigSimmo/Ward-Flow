import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

type ReasonCheck = { event: string; list: string };
type ReducerCase = { name: string; line: number };
type SourceReader = (file: string) => string;

function runtimeReducerImport(declaration: ts.ImportDeclaration): string | undefined {
  const clause = declaration.importClause;
  if (!clause || !ts.isStringLiteral(declaration.moduleSpecifier)) return undefined;
  if (!hasRuntimeBinding(clause)) return undefined;
  const name = declaration.moduleSpecifier.text;
  // The reducer's RECORD_* and UNDO_* cases live in ward-flow-record-events.ts and ward-flow-undo-events.ts.
  if (!name.endsWith("-reducer") && !/ward-flow-[a-z-]+-events$/u.test(name)) return undefined;
  return name;
}

function hasRuntimeBinding(clause: ts.ImportClause): boolean {
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
  }
  return true;
}

function importPath(file: string, name: string): string {
  // An import that already names its TypeScript extension must not gain a second one.
  const withExtension = (target: string) => (/\.tsx?$/u.test(target) ? target : `${target}.ts`);
  if (name.startsWith("@/")) return path.join("src", withExtension(name.slice(2)));
  if (name.startsWith(".")) return path.join(path.dirname(file), withExtension(name));
  throw new Error(`Reducer import is outside the local source tree: ${name}`);
}

/** Type-narrowed handlers retain event attribution after a case delegates to a module. */
function declaredEvent(node: ts.FunctionDeclaration): string | undefined {
  const parameter = node.parameters.find((item) => item.name.getText() === "event");
  return parameter?.type?.getText().match(/\btype\s*:\s*"([A-Z][A-Z0-9_]*)"/u)?.[1];
}

function negatedReasonList(node: ts.Node): string | undefined {
  if (!ts.isPrefixUnaryExpression(node) || node.operator !== ts.SyntaxKind.ExclamationToken) return undefined;
  return reasonMembershipList(node.operand);
}

function reasonMembershipList(call: ts.Node): string | undefined {
  if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) return undefined;
  if (call.expression.name.text !== "includes" || call.arguments.length !== 1) return undefined;
  if (!isEventReason(call.arguments[0]!)) return undefined;
  const list = call.expression.expression.getText();
  return /^[A-Z][A-Z0-9_]*$/u.test(list) ? list : undefined;
}

function isEventReason(node: ts.Node): boolean {
  return ts.isPropertyAccessExpression(node) && node.getText() === "event.reason";
}

function inspectSource(source: ts.SourceFile): { cases: ReducerCase[]; checks: ReasonCheck[] } {
  const cases: ReducerCase[] = [];
  const checks: ReasonCheck[] = [];
  const visit = (node: ts.Node, owner?: string): void => {
    if (ts.isFunctionDeclaration(node)) owner = declaredEvent(node);
    if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression)) {
      owner = node.expression.text;
      cases.push({ name: owner, line: source.getLineAndCharacterOfPosition(node.getStart()).line });
    }
    const list = negatedReasonList(node);
    if (list) checks.push({ event: owner ?? "(no enclosing event)", list });
    ts.forEachChild(node, (child) => visit(child, owner));
  };
  visit(source);
  return { cases, checks };
}

/** Scan the facade and its runtime-imported reducer modules, excluding type-only edges.
 * Missing modules throw. Comments and unimported files cannot manufacture a reason check. */
export function scanReducerReasonChecks(
  root: string,
  read: SourceReader = (file) => readFileSync(file, "utf8"),
): { cases: ReducerCase[]; checks: ReasonCheck[]; sources: string[] } {
  const visited = new Set<string>();
  const cases: ReducerCase[] = [];
  const checks: ReasonCheck[] = [];
  const pending = [path.normalize(root)];
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
    const inspected = inspectSource(source);
    cases.push(...inspected.cases);
    checks.push(...inspected.checks);
    for (const declaration of source.statements.filter(ts.isImportDeclaration)) {
      const name = runtimeReducerImport(declaration);
      if (name) pending.push(importPath(file, name));
    }
  }
  return { cases, checks, sources: [...visited] };
}
