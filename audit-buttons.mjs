import ts from "typescript";
import fs from "fs";
import path from "path";

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith(".tsx")) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk("src/components/ward-management");
const missingType = [];
const bareDisabled = [];
const noClickOrSubmit = [];

files.forEach(file => {
  const code = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sourceFile) === "button") {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const attrs = {};
        node.attributes.properties.forEach(prop => {
          if (ts.isJsxAttribute(prop)) {
            const name = prop.name.getText(sourceFile);
            const val = prop.initializer ? prop.initializer.getText(sourceFile) : true;
            attrs[name] = val;
          }
        });
        const item = {
          file: file.replace(/\\/g, "/"),
          line,
          type: attrs["type"],
          onClick: attrs["onClick"],
          disabled: attrs["disabled"],
          ariaDisabled: attrs["aria-disabled"],
          text: node.getText(sourceFile).substring(0, 100).replace(/\s+/g, " ")
        };
        if (!attrs["type"]) missingType.push(item);
        if (attrs["disabled"] !== undefined && attrs["aria-disabled"] === undefined) bareDisabled.push(item);
        const isSubmit = attrs["type"] === '"submit"' || attrs["type"] === "'submit'";
        if (!attrs["onClick"] && !isSubmit) noClickOrSubmit.push(item);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
});

console.log("=== MISSING TYPE COUNT:", missingType.length, "===");
missingType.forEach(x => console.log(`  ${x.file}:${x.line} -> ${x.text}`));

console.log("\n=== NO ONCLICK OR SUBMIT COUNT:", noClickOrSubmit.length, "===");
noClickOrSubmit.forEach(x => console.log(`  ${x.file}:${x.line} -> type=${x.type} | ${x.text}`));

console.log("\n=== BARE DISABLED COUNT:", bareDisabled.length, "===");
bareDisabled.forEach(x => console.log(`  ${x.file}:${x.line} -> disabled=${x.disabled} | ${x.text}`));
