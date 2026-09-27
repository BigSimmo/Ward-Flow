# F01b bed-map CSS polish report (r1)

Changed only `src/components/ward-management/capacity/bed-map.module.css`.

- Added local `wardShellTokens` composition on `.map`.
- Removed the outer `.wardBlock` border, radius, and padding so wards render as unboxed clusters.
- Changed the cluster layout to one column on phone and three compact columns from 48rem upward.
- Kept dashed, dotted, and hatched border semantics for state distinction.
- Added canonical third-edition fills: ready `--good`, held `--warn`, blocked `--danger`, occupied `--muted`; preparing remains a hatch layered over ready.
- Preserved existing legend, square state/test IDs, print token re-grounding, and forced-colors token handling. No TSX, shared-token, or engine changes.

Current CSS SHA-256: `2024C9E77E2A8259F92005B129066CBF4983466D9A1B45EFA3DDA596C32622B0`.

The requested `before-bed-map` snapshot path was not present under the estate snapshot directory; comparison was therefore against the current source and the supplied Capacity reference screenshot. This is source-only evidence; no browser or test claim is made.

Validation: `node -e "const fs=require('fs');const postcss=require('postcss');postcss.parse(fs.readFileSync('src/components/ward-management/capacity/bed-map.module.css','utf8'));console.log('postcss.parse ok')"` — passed. `git diff --check -- src/components/ward-management/capacity/bed-map.module.css` — clean.
