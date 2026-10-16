# Font fixtures for the third edition harness

`check.mjs` and `shots.mjs` serve these files in place of the live Google Fonts requests the
mockups make, so a run is offline and gives the same answer every time.

`platinum.css` is the latin subset of the stylesheet the third edition asks for:

    https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap

Only the latin blocks are kept, because the mockups are English only. The two `.woff2` files
are the variable fonts that stylesheet points at, under their original names, since the harness
resolves a font request by its file name: `gyByhwUxId8gMEwcGFU.woff2` is Geist and
`or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2` is Geist Mono. One file serves every weight of its family,
because both are variable fonts.

Geist and Geist Mono are published by Vercel under the SIL Open Font License 1.1, which permits
redistribution: https://openfontlicense.org

To refresh them, fetch the stylesheet above, keep its `/* latin */` blocks, and download each
file it names into this directory.
