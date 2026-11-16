# The BedChart brand mark

The mark is the **Folded B** (D-261, 16 November 2026). It is a pillow above a bed, and the bed's
lower right corner is turned down like a sheet. Together the two shapes read as a B, the first
letter of BedChart. It replaces the S inherited from PsychSift, whose construction notes are in
this file's history.

`src/lib/brand-mark.ts` holds the geometry. Every surface draws from it: the in-app mark
(`src/components/ward-management/brand-mark.tsx`), the browser-tab icon (`src/app/icon.svg`),
`favicon.ico` and the generated icon, launch-screen and link-preview images. The paths come from
the master generator in the brand pack (`/mnt/project-files/bedchart-logo/master.py`), so edit the
generator and regenerate the set rather than hand-editing one path.

## Four size masters

The mark is redrawn, not just scaled, as it gets smaller. `pickBrandMaster(px)` chooses the master
from the pixels drawn.

| Master  | Drawn at        | What changes                                                     |
| ------- | --------------- | ---------------------------------------------------------------- |
| Display | 48 px and up    | The full fold, a 2-unit crease, 1-unit soft corners on the cut   |
| Text    | 24 to 47 px     | A heavier 2.6-unit crease and a rounder flap                     |
| Small   | 17 to 23 px     | A tighter bed corner (radius 7), a 12-unit fold, a 3-unit crease |
| Micro   | 16 px and below | Redrawn on a 16-pixel grid, every edge on a pixel, no fold       |

The display, text and small masters share a 48-unit grid and one ink box (29.5 by 38 units), so
the mark can sit in a line of type at Geist's cap height (0.719 em).

The crease is a cut, not a painted line. A mask removes it from the bed and the flap, so the mark
sits on any ground without a stripe.

## Colours

The colours are the v9 kit's own. `tests/brand-mark-optics.test.ts` pins them token by token.

| Part       | On a light page       | On a dark page or the navy hero |
| ---------- | --------------------- | ------------------------------- |
| Pillow     | `--wf-pri-1` #2f6aa3  | `--wf-accent` (dark) #8cbcf0    |
| Bed        | `--wf-hero-2` #1c2f41 | `--wf-ink-1` (dark) #e9eef3     |
| Icon field | `--wf-hero-1` #22384d | `--wf-surface` (dark) #141d26   |

In the app the mark paints with `--bc-pillow` and `--bc-bed`, which fall back to
`--wf-brand-pillow` and `--wf-brand-bed`. Those follow the theme. A surface on the navy hero sets
the two properties to `--wf-brand-hero-pillow` and `--wf-brand-hero-bed`. The light pillow is only
2.1:1 on navy, so anything dark always takes the dark pair.

## Where each form goes

| Place                      | Form                                                        |
| -------------------------- | ----------------------------------------------------------- |
| Rail, open                 | Bare mark, 22 px, beside the name; hero colours on the band |
| Rail, closed strip         | Bare mark, 26 px, no tile; theme colours                    |
| Sign-in and front door     | Mark in the frosted glass tile, beside or above the name    |
| Lock screens               | Mark in a 34 px glass tile beside the name                  |
| Browser tab (`icon.svg`)   | Small master on the navy tile, dark field in dark mode      |
| `favicon.ico`              | Micro at 16 px, small at 32 px, text at 48 px, navy tile    |
| Apple touch icon, maskable | Bare mark on a full-bleed navy field                        |
| PWA "any" icons            | Mark on its rounded navy tile, transparent corners          |
| PWA monochrome icons       | White silhouette, crease cut out                            |
| iPhone launch screens      | Light mark on the app's light colour                        |
| Link preview               | Mark and name on the navy gradient                          |

## Regenerating

`src/app/icon.svg` is `brandIconSvg()` written to disk; the optics test fails if they differ.
`favicon.ico` is rendered from `brandTileSvg(16)`, `brandTileSvg(32)` and `brandTileSvg(48)`.
