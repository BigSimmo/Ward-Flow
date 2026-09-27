/* A box is opaque, so a line running behind one reads as a chain between the boxes either side
   of it. Find every line that does it. Horizontal long hauls are a separate convention (the
   dashed record lines and the gutter channels) so report them apart rather than mixing them in. */
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^.([A-Za-z]:)/, "$1"));
const st = JSON.parse(fs.readFileSync(path.join(here, "stages.json"), "utf8"));
const N = st.nodes;
// Read the corners the generator recorded, not the path it drew. Parsing the path stopped being
// safe the moment corners were rounded, and a parser reading a curve's control point as a corner
// reports a clean result about a shape that is not on the page.
const seg = (e) => {
  if (!Array.isArray(e.p)) throw new Error("this edge has no recorded corners — rebuild the map");
  return e.p.slice(1).map((pt, i) => [e.p[i], pt]);
};
const hits = (a, b) =>
  N.filter((n) => {
    const [x1, y1] = a,
      [x2, y2] = b;
    const lo = (u, v) => Math.min(u, v),
      hi = (u, v) => Math.max(u, v);
    return hi(x1, x2) > n.x + 2 && lo(x1, x2) < n.x + n.w - 2 && hi(y1, y2) > n.y + 2 && lo(y1, y2) < n.y + n.h - 2;
  });
let vert = 0,
  horiz = 0;
for (const e of st.edges) {
  for (const [a, b] of seg(e)) {
    const through = hits(a, b);
    if (!through.length) continue;
    const isV = a[0] === b[0];
    for (const n of through) {
      if (isV) {
        vert++;
        console.log(`VERTICAL x${a[0]} y${a[1]}→${b[1]} passes through "${n.label}"`);
      } else horiz++;
    }
  }
}
console.log(`\nvertical runs behind a box: ${vert}    horizontal runs behind a box: ${horiz}`);
