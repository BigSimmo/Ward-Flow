/**
 * Every `next/dynamic` loader goes through `withLoadRetry` (src/components/ward-management/load-retry.tsx).
 *
 * next/dynamic wraps React.lazy, which keeps a rejected import. Without the wrapper, one failed chunk
 * fetch (offline, patchy Wi-Fi, a new deploy) throws to the nearest boundary, and that boundary's
 * Try again throws the same cached error until the page reloads. `withLoadRetry` resolves a failed
 * fetch to a stand-in with its own Try again instead (review finding 2, 12 Nov 2026).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const requireDynamicLoadRetry = {
  meta: {
    type: "problem",
    docs: { description: "Require next/dynamic loaders to be wrapped in withLoadRetry" },
    schema: [],
    messages: {
      wrap: "Wrap this next/dynamic loader in withLoadRetry(...) from @/components/ward-management/load-retry, so a failed chunk fetch can be retried without a reload.",
    },
  },
  create(context) {
    const dynamicNames = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "next/dynamic") return;
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportDefaultSpecifier") dynamicNames.add(specifier.local.name);
        }
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || !dynamicNames.has(node.callee.name)) return;
        const [loader] = node.arguments;
        if (!loader) return;
        const wrapped =
          loader.type === "CallExpression" &&
          loader.callee.type === "Identifier" &&
          loader.callee.name === "withLoadRetry";
        if (!wrapped) context.report({ node: loader, messageId: "wrap" });
      },
    };
  },
};

export default requireDynamicLoadRetry;
