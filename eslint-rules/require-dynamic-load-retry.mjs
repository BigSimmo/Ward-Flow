/**
 * Every `next/dynamic` loader goes through `withLoadRetry` (src/components/ward-management/load-retry.tsx).
 *
 * next/dynamic wraps React.lazy, which keeps a rejected import. Without the wrapper, one failed chunk
 * fetch (offline, patchy Wi-Fi, a new deploy) throws to the nearest boundary, and that boundary's
 * Try again throws the same cached error until the page reloads. `withLoadRetry` resolves a failed
 * fetch to a stand-in with its own Try again instead (review finding 2, 12 Nov 2026).
 *
 * Audit 4 A4-08 (13 Nov 2026): the rule also covers React's own `lazy` (its loader must be wrapped
 * the same way, or handle failure itself), and a bare `import()` in a component file (.tsx, .jsx).
 * A bare `import()` passes when its failure is handled:
 * - it sits inside a call to a loader that handles failure (`withLoadRetry`, `loadEarly`,
 *   `preloadWhenIdle`, or the rule's `handlers` option);
 * - its promise chain ends in `.catch(...)` or a two-argument `.then(...)`, through `Promise.all`,
 *   `Promise.allSettled`, `await` and `.then`/`.finally` links;
 * - it is awaited inside a `try` block that has a `catch`;
 * - it is the result of a loader function (returned, or awaited outside try, which rejects the
 *   function's own promise) that is passed to a handler, given to a prop that handles failure
 *   (`load`, `onExportList`: both end at ListExportButton, which catches it; or the rule's
 *   `handlerProps` option), or bound to a name (`const load = () => import(...)`) whose every use in
 *   the file passes one of these checks.
 * Type positions (`typeof import("x")`, `import("x").Type`) are not loads and are never checked.
 */
const DEFAULT_HANDLERS = ["withLoadRetry", "loadEarly", "preloadWhenIdle"];
const DEFAULT_HANDLER_PROPS = ["load", "onExportList"];

const FUNCTION_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

function calleeName(call) {
  const { callee } = call;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier")
    return callee.property.name;
  return undefined;
}

/** True when `node` sits (at any depth) in an argument of a call to one of `handlers`. */
function insideHandlerCall(node, handlers) {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (parent.type === "CallExpression" && parent.callee !== child && handlers.has(calleeName(parent) ?? ""))
      return true;
  }
  return false;
}

/** True when the promise `node` makes ends in a chain that handles rejection, or an awaited try. */
function chainHandlesFailure(node) {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (!parent) return false;
    // `x.then(...)`, `x.catch(...)`, `x.finally(...)`
    if (parent.type === "MemberExpression" && parent.object === current && !parent.computed) {
      const call = parent.parent;
      if (call?.type !== "CallExpression" || call.callee !== parent) return false;
      const method = parent.property.name;
      if (method === "catch") return true;
      if (method === "then" && call.arguments.length >= 2) return true;
      if (method !== "then" && method !== "finally") return false;
      current = call;
      continue;
    }
    // `Promise.all([..., x, ...])` and friends: the combined promise carries the failure.
    if (parent.type === "ArrayExpression") {
      const call = parent.parent;
      if (
        call?.type === "CallExpression" &&
        call.callee.type === "MemberExpression" &&
        call.callee.object.type === "Identifier" &&
        call.callee.object.name === "Promise"
      ) {
        current = call;
        continue;
      }
      return false;
    }
    if (parent.type === "AwaitExpression") return insideTry(parent);
    if (
      parent.type === "ChainExpression" ||
      parent.type === "TSAsExpression" ||
      parent.type === "TSNonNullExpression"
    ) {
      current = parent;
      continue;
    }
    return false;
  }
}

/** True when `node` is inside the block of a `try` with a `catch`, within its own function. */
function insideTry(node) {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (FUNCTION_TYPES.has(parent.type)) return false;
    if (parent.type === "TryStatement" && parent.block === child && parent.handler) return true;
  }
  return false;
}

/** The function whose result is `node` (an arrow's expression body, or a `return` in its body). */
function functionReturning(node) {
  let current = node;
  for (;;) {
    const parent = current.parent;
    if (!parent) return undefined;
    if (parent.type === "ArrowFunctionExpression" && parent.body === current) return parent;
    if (parent.type === "ReturnStatement") {
      for (let up = parent.parent; up; up = up.parent) if (FUNCTION_TYPES.has(up.type)) return up;
      return undefined;
    }
    // A `.then` link or `Promise.all` still returns the import's promise.
    if (parent.type === "MemberExpression" && parent.object === current && !parent.computed) {
      const call = parent.parent;
      if (call?.type === "CallExpression" && call.callee === parent) {
        current = call;
        continue;
      }
      return undefined;
    }
    if (parent.type === "ArrayExpression" && parent.parent?.type === "CallExpression") {
      current = parent.parent;
      continue;
    }
    // An awaited failure outside try rejects the enclosing async function's own promise.
    if (parent.type === "AwaitExpression") {
      for (let up = parent.parent; up; up = up.parent) if (FUNCTION_TYPES.has(up.type)) return up;
      return undefined;
    }
    return undefined;
  }
}

/** True when `node` is the value of a JSX attribute named in `props` (`load={...}`). */
function jsxPropValue(node, props) {
  const container = node.parent;
  return (
    container?.type === "JSXExpressionContainer" &&
    container.parent?.type === "JSXAttribute" &&
    props.has(container.parent.name.name)
  );
}

/** The variable a loader function is bound to: `const load = () => ...` or `function load() {}`. */
function boundVariable(sourceCode, fn) {
  const declarator = fn.type === "FunctionDeclaration" ? fn : fn.parent;
  if (fn.type !== "FunctionDeclaration" && declarator?.type !== "VariableDeclarator") return undefined;
  if (fn.type !== "FunctionDeclaration" && declarator.init !== fn) return undefined;
  const [variable] = sourceCode.getDeclaredVariables(declarator);
  return variable;
}

/** True when the loader's own declaration is exported, so its uses in other files cannot be seen. */
function exported(fn) {
  const declaration = fn.type === "FunctionDeclaration" ? fn : fn.parent?.parent;
  const parent = declaration?.parent;
  return parent?.type === "ExportNamedDeclaration" || parent?.type === "ExportDefaultDeclaration";
}

/** @type {import('eslint').Rule.RuleModule} */
const requireDynamicLoadRetry = {
  meta: {
    type: "problem",
    docs: { description: "Require lazy loads to be wrapped in withLoadRetry or to handle a failed fetch" },
    schema: [
      {
        type: "object",
        properties: {
          handlers: { type: "array", items: { type: "string" } },
          handlerProps: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      wrap: "Wrap this next/dynamic loader in withLoadRetry(...) from @/components/ward-management/load-retry, so a failed chunk fetch can be retried without a reload.",
      wrapLazy:
        "Wrap this React lazy loader in withLoadRetry(...) from @/components/ward-management/load-retry, or handle a failed fetch with .catch(...), so a failed chunk fetch does not throw to the page.",
      bareImport:
        "Handle a failed fetch of this import(): pass it to withLoadRetry (or loadEarly, preloadWhenIdle), end its chain in .catch(...) or a two-argument .then(...), or await it inside try/catch.",
    },
  },
  create(context) {
    const handlers = new Set([...DEFAULT_HANDLERS, ...(context.options[0]?.handlers ?? [])]);
    const handlerProps = new Set([...DEFAULT_HANDLER_PROPS, ...(context.options[0]?.handlerProps ?? [])]);
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const filename = context.filename ?? context.getFilename();
    const componentFile = /\.(tsx|jsx)$/.test(filename);
    const dynamicNames = new Set();
    const lazyNames = new Set();
    const reactNamespaces = new Set();

    /** True when the failure of the promise made at `node` is handled, by rule or by its loader's uses. */
    function handled(node, depth = 0) {
      if (insideHandlerCall(node, handlers) || chainHandlesFailure(node)) return true;
      if (depth > 2) return false;
      const fn = functionReturning(node);
      if (!fn) return false;
      if (jsxPropValue(fn, handlerProps)) return true;
      // A loader passed straight to a call: judged by that call (a handler, or `lazy`/`dynamic`, checked there).
      if (fn.parent?.type === "CallExpression" && fn.parent.callee !== fn) {
        const name = calleeName(fn.parent) ?? "";
        return handlers.has(name) || dynamicNames.has(name) || lazyNames.has(name) || name === "lazy";
      }
      const variable = boundVariable(sourceCode, fn);
      if (!variable || exported(fn)) return false;
      const uses = variable.references.filter((reference) => reference.identifier !== variable.identifiers[0]);
      if (uses.length === 0) return false;
      return uses.every((reference) => {
        const id = reference.identifier;
        if (insideHandlerCall(id, handlers) || jsxPropValue(id, handlerProps)) return true;
        // `load()`: the call's own promise must be handled.
        if (id.parent?.type === "CallExpression" && id.parent.callee === id) return handled(id.parent, depth + 1);
        // Passed on as a loader (`dynamic(load)`, `lazy(load)`): checked where that call is.
        if (id.parent?.type === "CallExpression") {
          const name = calleeName(id.parent) ?? "";
          return dynamicNames.has(name) || lazyNames.has(name);
        }
        return false;
      });
    }

    function checkLazyLoader(loader) {
      if (!loader) return;
      const wrapped =
        loader.type === "CallExpression" &&
        loader.callee.type === "Identifier" &&
        loader.callee.name === "withLoadRetry";
      if (wrapped) return;
      // A loader that handles its own failure (`() => import("x").catch(() => fallback)`).
      if (FUNCTION_TYPES.has(loader.type) && loader.body.type !== "BlockStatement") {
        let start = loader.body;
        while (start.type === "CallExpression" && start.callee.type === "MemberExpression") start = start.callee.object;
        if (start.type === "ImportExpression" && chainHandlesFailure(start)) return;
      }
      context.report({ node: loader, messageId: "wrapLazy" });
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value === "next/dynamic") {
          for (const specifier of node.specifiers) {
            if (specifier.type === "ImportDefaultSpecifier") dynamicNames.add(specifier.local.name);
          }
        }
        if (node.source.value === "react") {
          for (const specifier of node.specifiers) {
            if (specifier.type === "ImportSpecifier" && specifier.imported.name === "lazy")
              lazyNames.add(specifier.local.name);
            else if (specifier.type !== "ImportSpecifier") reactNamespaces.add(specifier.local.name);
          }
        }
      },
      CallExpression(node) {
        const { callee } = node;
        if (callee.type === "Identifier" && dynamicNames.has(callee.name)) {
          const [loader] = node.arguments;
          if (!loader) return;
          const wrapped =
            loader.type === "CallExpression" &&
            loader.callee.type === "Identifier" &&
            loader.callee.name === "withLoadRetry";
          if (!wrapped) context.report({ node: loader, messageId: "wrap" });
          return;
        }
        const isLazy =
          (callee.type === "Identifier" && lazyNames.has(callee.name)) ||
          (callee.type === "MemberExpression" &&
            !callee.computed &&
            callee.object.type === "Identifier" &&
            reactNamespaces.has(callee.object.name) &&
            callee.property.name === "lazy");
        if (isLazy) checkLazyLoader(node.arguments[0]);
      },
      ImportExpression(node) {
        if (!componentFile || handled(node)) return;
        context.report({ node, messageId: "bareImport" });
      },
    };
  },
};

export default requireDynamicLoadRetry;
