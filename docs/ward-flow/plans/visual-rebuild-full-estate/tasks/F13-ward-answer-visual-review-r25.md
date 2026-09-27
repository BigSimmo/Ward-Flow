# F13 Ward Answer visual review r25

## Scope and evidence

Independent visual review only. I inspected all 18 original r25 PNGs at native detail: paired app/mock captures at 390, 820, and 1440 pixels in Light and Dark, plus the six app captures scrolled to the `ward-answer-capacity-heading` panel. I also compared the lower panels with the four valid r24 bottom mock captures. No source, test, browser, or verification JSON files were changed or run.

The app evidence is the populated `fsh-older-adult` case with the current movement's eight disclosed facts and 11 engine-derived gates. Differences in movement identity, gate results, ward capacity, queue length, timestamps, and absent person/shift data are authoritative engine adaptations rather than visual defects.

## Findings

### P2 — the desktop rail background still ends before the page

In both 1440 lower-panel captures the rail's painted surface ends at about y=1177 while the main document continues to y=1250, leaving a black rectangle below the rail. This is conspicuous in Light and still creates a distinct background seam in Dark. The initial 1440 captures do not expose it because their viewport position is higher. The rail track therefore does not yet paint for the full document height below the sticky rail content. This is a shared shell/rail correction, not a Ward Answer content correction.

Smallest correction: make the desktop rail track/background-owning element cover the full shell row/document height while keeping the inner navigation sticky and independently scrollable. Recheck at the lower Answer capture position in both themes.

### P2 — Recent answers has lost the drawing's record-card affordance

At 820 and 1440, the app renders the single real answer as four unbounded text columns on the panel background. The drawing renders each answer as a bordered record card, which makes the movement ID, decision, detail, and time a coherent selectable/scannable unit. The app's honest `Accepted by this ward` and `Time not recorded` substitutions are correct, but they can retain the card panel type without inventing a person, role, or timestamp. On phone, the r25 capture ends before the real row, so this review cannot prove the row's lower-phone wrapping.

Smallest correction: apply the existing answer-row/card boundary and responsive grid to each real history entry; keep the current four truthful values and stack them in reading order on phone.

### P2 — phone capacity confirmation does not follow the drawing's control rhythm

At 390, the number input and `Confirm capacity` button share one row, leaving a narrow numeric control beside a very wide action. The drawing places its quantity control on one row and a full-width confirmation action below it. The current desktop/820 long button is not itself a defect: the drawing also gives `Confirm beds` the full available row width. The mismatch is phone-only, where placing the action on its own row would give the input and primary action clearer separation without changing behavior.

Smallest correction: at the phone breakpoint, make the capacity form a single-column grid and let both the numeric input and confirmation action occupy their own rows. Preserve the current label, value, submit handler, and 48-pixel targets.

## Accepted / observed

- No P1 issue was visible in the reviewed evidence.
- The previously missing `Confirm your beds` and `Recent answers` regions are now present, ordered after the gate decision, and legible in Light and Dark at all three widths.
- The five capacity values, two freshness/source notes, write-scope statement, and one real accepted answer remain visible. The synthetic/governance notice follows them.
- Gate rows remain readable at 390, 820, and 1440; failure color and text are legible in both themes. The compact Answer decision buttons are visible and do not overlap.
- No horizontal content clipping or body-level horizontal scrollbar is visible in these captures. The 390 lower images do not reach the history record or final notice, so those lower-phone regions remain a capture limitation rather than accepted visual proof.

## Evidence hashes (SHA-256)

```text
ward-answer-app-1440-dark-r25.png 8b3e912d0260f382d9ab6cb77a662d2c4828c5b0ae1567a476bf41afc2243826
ward-answer-app-1440-light-r25.png 21564414dfd2780846ea8183c84ca86f0389fe8832c33cd1ed3245d62bed50f6
ward-answer-app-390-dark-r25.png bacf1661ce6d069698c597f7736a57acd490c064822e2c90de3521341b028c6e
ward-answer-app-390-light-r25.png 8f97294233f90208d6a8717378815eb9619b49c947f471c7aa25d4d5234c05a5
ward-answer-app-820-dark-r25.png 8d45e11382b6ecf50f2a15ddb20200f7ccdba3ff3366edebf668ab2751e11f32
ward-answer-app-820-light-r25.png 66e693f9311e1e122a6bb362f6914e994af5e4272b0e73f3729abeb04d368e7c
ward-answer-mock-1440-dark-r25.png ebc6396197ad0abd3903549f4626da23bca9bce5ecbb5454db49b7a4bcd1c052
ward-answer-mock-1440-light-r25.png 1e07c4edf2f9ed71b7979e01b46f33d87c2e9f44fcfe6bd595dfcc790602cd92
ward-answer-mock-390-dark-r25.png 30fe5e0826592652afe2230a7bc073e716d6b682fce23006718c5cc77e8a5699
ward-answer-mock-390-light-r25.png e3f9c79bc850c16f72fe7400ce257785270f8651572c4f1a04d52e1ab3b0cbbc
ward-answer-mock-820-dark-r25.png 2d4f2fad2f56d15d2fa6c3f138149859da13aa74879da9d202e0c6d94bc6492a
ward-answer-mock-820-light-r25.png c5040a0ccf6efe169f2eba033419382bb02eadc84a5acee85f60bb01e40cc42a
ward-answer-panels-app-1440-dark-r25.png b7bb84506faccf4a99b9fd03ecef76ad649db413290f0bc07035dd43a6d6bc24
ward-answer-panels-app-1440-light-r25.png a570977bbb2e29501b70a84e9025272870ec3c57635ec2d02d7ecaf1b51efaff
ward-answer-panels-app-390-dark-r25.png 56705badaecabb243c5b8123a9815162bb6ec438a84d68315774c4d84f4f4536
ward-answer-panels-app-390-light-r25.png 189c2dca286afde50b0cdaef9f33fcfdabd40ece6ffa8062d442e2e3911ed834
ward-answer-panels-app-820-dark-r25.png 2a8a3b843f1d43b4f08a885f27c8463a052f780b643dbca5f42321128a422071
ward-answer-panels-app-820-light-r25.png 47c776bf62fd0d7de53127179ac6fb312caadafcbc24060236222c1fc86aa97c
```

## Rail closure (r26)

I inspected `ward-answer-panels-app-1440-light-r26.png` at original detail after the shared shell correction. The rail surface, shell row, ground, and viewport now end together; the black lower seam reported from r25 is absent. That shared-shell P2 is closed by this later evidence. The two Answer-local P2 findings above remain tied to the r25 captures.

`ward-answer-panels-app-1440-light-r26.png` SHA-256: `be89b2050c1d1a9cea6d40744a3e61a98b4aa6b60b3911c13cb51e93566d31db`.
