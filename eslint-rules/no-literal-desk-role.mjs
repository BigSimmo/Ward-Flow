// R-STRUCT-1 and R-STRUCT-3 (D-222, D-223, Josh 14 Nov 2026): the desk a change comes from is the
// session's, stamped by the shell and the server from the membership, never a role a screen types.
// This rule flags a role written as a literal in a dispatched change:
//   - an object literal with `type: "SOME_CHANGE"` and `role: "<desk>"` (any desk but "demo",
//     whose role names the demonstration controls, not who acted);
//   - `useWardRaise("<desk>")` and `wardRaise(dispatch, "<desk>", …)`.
// It is a shrink-only ratchet: each file may keep at most the count it had on 14 Nov 2026
// (eslint-rules/no-literal-desk-role-baseline.mjs, option `max`), new files none.
// tests/eslint-rules-no-literal-desk-role.test.ts holds the baseline to the files as they shrink.

const DESK_ROLES = new Set(["coordinator", "ward", "ed", "officer", "community", "bed_manager", "executive"]);
const CHANGE_TYPE = /^[A-Z][A-Z0-9_]+$/;

function literalString(node) {
  return node && node.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
}

function propertyNamed(objectNode, name) {
  return objectNode.properties.find(
    (property) =>
      property.type === "Property" &&
      !property.computed &&
      ((property.key.type === "Identifier" && property.key.name === name) || literalString(property.key) === name),
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: { description: "No literal desk role in a dispatched change; the shell stamps the session's desk" },
    schema: [{ type: "object", properties: { max: { type: "integer", minimum: 0 } }, additionalProperties: false }],
  },
  create(context) {
    const max = context.options[0]?.max ?? 0;
    const found = [];
    return {
      ObjectExpression(node) {
        const type = propertyNamed(node, "type");
        const role = propertyNamed(node, "role");
        const typeValue = literalString(type?.value);
        const roleValue = literalString(role?.value);
        if (typeValue && CHANGE_TYPE.test(typeValue) && roleValue && DESK_ROLES.has(roleValue)) found.push(role);
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const argument =
          node.callee.name === "useWardRaise"
            ? node.arguments[0]
            : node.callee.name === "wardRaise"
              ? node.arguments[1]
              : undefined;
        const value = literalString(argument);
        if (value && DESK_ROLES.has(value)) found.push(argument);
      },
      "Program:exit"() {
        if (found.length <= max) return;
        for (const node of found.slice(max))
          context.report({
            node,
            message: `A literal desk role in a dispatched change (${found.length} in this file, at most ${max}). Leave the role to the shell's desk stamp (D-222, D-223); see eslint-rules/no-literal-desk-role-baseline.mjs.`,
          });
      },
    };
  },
};
