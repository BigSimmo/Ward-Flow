# F09/F10 visual review — r9

Reviewer: verification_plan (Luna, medium). All 16 supplied light-theme PNGs were viewed at original detail. Review is limited to visible screenshot regions; no source, browser, tests, server, or hosted operations were performed.

## Evidence inspected

| Pair                   | App SHA-256                                                        | Drawing SHA-256                                                    |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| transport-officer 1440 | `FFCC0C50B3FA2EDA08242DB6C71851C7E1853FAA06BD578385CD2C329DE279EA` | `C5AA605614040B8B19352F0F21652A26CE5E508F21A86D36EF231229D8ECAA8B` |
| transport-officer 390  | `06FA30823D44D6C4C6B4BCBACD154FCEB380492B8BBCAA6E9D3799AA63FF809E` | `999019EF9291A945BA196AB1493B477D66BFE3B56F5693F70FB432BFA6C91C17` |
| on-call 1440           | `4DD288A970D97B456E00DF9976CC1A6380DC884F7077C989163372280AD71811` | `235625290389183C0C07D34F75FA8ADA1F030B2C1F5978131A717D8A5F0576B4` |
| on-call 390            | `D76E2D3A7DCC91EE07DF40D0C5C91FDC1B44A8ECAB96F165C3DEB521F527A20B` | `0625EBD1723A69CAC39568A09F51E0E3D8A0B6D268ECDCABC92CF5B2C374945E` |
| alerts 1440            | `608F2A1736ACCA8F69E917FE914241DA19A331E4C39F0461F2A71976DC8C43C5` | `0E649630CDB7B9F84DB1E13687FD0670BBE1632BB985EBA2A84293F698C69992` |
| alerts 390             | `172F7F76C8E89B5CD5CD7D8C4E693B8B402723C0694504DA10B17B0BFA43A3A2` | `8C8E661952010E1B11E1457B07CB0E175DC9277999AD9F871B02A3D10A2E5F37` |
| legal-forms 1440       | `3181941E1D19A4236EC3E80CA4E88ACD6185F8ED200C86122B229C3FACC2FC1E` | `1C2980EF24449DC6F2F490C85DFD1A0314F0F8D4446A9FF913CE08EB15722F2F` |
| legal-forms 390        | `ADA5BD4FE0A1847B3E073C7ED6315177D09235862937062F9685BDAA7B8D5915` | `5FC24EFB47717F6D551785C59C501B094A4EE3AC4F76F6659E8C3B1F39A3F32D` |

## Findings

No new concrete P1/P2 visual defect was established in the visible regions. The four app screens now have the third-edition ground, compact route chrome, readable panel headers, inset record/card treatments, and phone starts without the former large reserve gap. On-call and Legal Forms retain clear primary panel hierarchy at both supplied widths. Alerts presents actual alert records in its visible groups, and Transport Officer presents the actual transport-job population with readable stage controls.

The drawing fixtures differ from the working engine: Transport Officer's drawing includes a refused-actions record while the app has none in this state; counts, names, timestamps and role/service totals also differ across all four screens. These are legitimate engine-state/content differences and were not treated as defects. The app's required synthetic-data and absence copy remains visible even where the drawings use shorter explanatory text.

## Limits

The captures are initial viewport evidence only. They do not prove lower Transport Officer jobs/actions, later On-call liaison rows, later Alerts groups, the second Legal Forms group, disclosures, scroll-end behavior, dark mode, forced colours, print, keyboard/focus, interaction outcomes, or tablet/other widths. No visual acceptance claim is made for those regions.
