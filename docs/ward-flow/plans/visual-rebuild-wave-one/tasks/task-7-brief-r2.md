# Task 7 interface addendum — revision 2

All scope and acceptance conditions in revision 1 remain. Plan SHA256 DEB1A10C336EB44856430D8C15D91B09EE5787B5762B3D55A0159DB0C772BAEB. Controller owns shell/ward-facade.ts and its named facade test case. New exported `wardBoardHref(unitId: string): string` returns the encoded canonical Board route. Consume it for Change ward navigation. Worker still owns only Board TSX/CSS; no new worker file ownership. Acknowledge this interface before depending on it.
