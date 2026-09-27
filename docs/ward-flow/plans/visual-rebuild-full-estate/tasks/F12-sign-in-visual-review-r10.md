# Sign-in r10 visual review

Date: 2026-09-13
Reviewer: Codex Luna
Scope: all 12 valid r10 served app/mock pairs at 1440, 820 and 390px in light and dark themes. This is image-only review of the visible viewport tops.

## Verdict

No P1/P2 visual difference was found. App and drawing share the same centered sign-in card, section sequence, seven-role list, selected-role treatment and responsive text wrapping. The 820 and 390 views stay within the viewport width with readable line lengths, card insets and role badges. Dark theme surfaces, borders and text remain legible without an obvious contrast failure.

The app and drawing show the same seven real roles and the same prototype/permission explanation. The visible selected/focused role can differ between captures as an interaction state; this is not treated as a content mismatch. The small differences in card width and vertical crop across capture sizes do not create clipping in the inspected regions.

This evidence does not cover role selection behavior, keyboard focus traversal, action activation/navigation, the remaining lower role/action content, print output, forced colors, or human acceptance. It is not DOD completion proof.

## Image evidence

All 12 files were inspected directly:

- app: `sign-in-app-1440-light-r10.png` `sign-in-app-820-light-r10.png` `sign-in-app-390-light-r10.png` `sign-in-app-1440-dark-r10.png` `sign-in-app-820-dark-r10.png` `sign-in-app-390-dark-r10.png`
- mock: `sign-in-mock-1440-light-r10.png` `sign-in-mock-820-light-r10.png` `sign-in-mock-390-light-r10.png` `sign-in-mock-1440-dark-r10.png` `sign-in-mock-820-dark-r10.png` `sign-in-mock-390-dark-r10.png`

SHA256 fingerprints, in the same groups, are:

- app: `6FA0E00D5D359CEAEA6D78DE222DF202C346FD62E7B25605FD7ED3348E36DDFC`, `58513E7CEFFD228234A7FC094815AD2626616B7683EE218C96986B64C56E413F`, `367A33531F2BC60829EC59A4DE1A9DB672C19F5B01512811014681D8AE26859A`, `11CF3EBE25558929E4F3944CEF1E0E3FA32F1D989B1DDF878BF9A5A445579FDF`, `0B816189AB9E8B145660C78140B7B6E36E2BF80A0E5261E1F7A357DCEC2CFBE7`, `70D5EA0EC31213E90462E10897FC1846C5F4F3B758B0279338E0EA01692EF0F5`.
- mock: `CE0B04E7FDAF215D956E8EBD6AC36BD0EC7F1D21232E864461D45EB4249D5289`, `441B4B04123ECF8A667045F1ECE4EC7805AD2E73354774F5F00BC5ADBD020D3D`, `C985064E2E4F6C417586ABAC111F17F31E17F9A67E08CF466DF1E3BBD1949667`, `0D1D383DD1112CE0DD834717361D336FA41E08B98A81A80D22CB2401513890C7`, `3F8F58F470EECBA5BAB9804837E4479EAC187257D62526E13EB87EC3ED6BCC34`, `EF39D25ADF33067D1FF34123588A24FFAD9DADD47937E39ED0B5AEB2D6088F9F`.

No source, verification record, test, browser, server or provider files were changed.
