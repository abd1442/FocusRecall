# Theme accent consistency — focused publication follow-up

Base: accepted RC2 source `cedd32a693f422b983813260cbe4f828c3983d66`. Frozen candidate outputs are not rebuilt or replaced. Verification uses separate `dist/theme-accent-20261019-{qa,production}` directories and marked fictional profiles.

## Findings and correction

A fresh Ivory & Ink (default light) profile already gives both Start and the active sidebar entry `#183D56`. No hardcoded competing Start color was found. A fictional migrated profile reproduced a mismatch: the retained custom Focus/action preference (`focusIsAccent: true`, Focus `#245679`) made Start blue while normal sidebar selection remained the original ink. The owner's actual stored preferences were not inspected.

When an existing custom Focus preference also drives actions, normal sidebar selection now follows the same resolved accent. Its label and bookmark are contrast-checked. Raw saved custom colors are retained; no settings migration/reset is introduced. Explicit inverse/accent sidebar preferences remain honored. Uncustomized themes retain their approved independent sidebar palettes, including deliberately neutral rails.

Primary buttons now explicitly use the existing accent default/hover/pressed token family, replacing a brightness filter that changed both label and fill. Shared segmented controls, Home timer-mode selection and duration chips use the existing selected background/border/text tokens. Disabled treatment and keyboard focus remain intact. No hardcoded new colors, palette seeds, layout, timer logic, scientific calculations, subject-specific colors, status colors or illustrations changed. No new strings need translation.

## Verification

- Full regression: **1,159 tests / 82 files**. All approved theme derivations and existing contrast/compatibility checks pass. Added adversarial coverage across all 26 themes for custom-action/sidebar coordination, high contrast, retained raw requests, stage-only overrides and explicit sidebar choices.
- Normal native compilation, type checks and separate QA/production packaging passed. Production package hygiene passed; **29 production security launch cases** passed. Automated visual checks use the isolated QA package; **13 renderer/preload files match production exactly**.
- **130 packaged accent checks** cover all 26 themes: primary normal/hover/pressed, keyboard focus, stable geometry, selected timer mode/length, shared segmented selection, custom action/sidebar colors with/without high contrast, and disabled Start. Packaged Quick results and screenshots: `docs/verification/theme-accent-20261019/` (local receipts).
- Packaged Quick workflow regression: **420 layouts/state checks** passed across seven languages, both timer displays, pauses/breaks, restart/recovery and Full Mode preservation.
- **51 frozen artifact hashes** matched, including RC2 and the earlier protected candidates. The unrelated modified localization coverage receipt is unchanged. No personal profiles, original recovery material or installed application were accessed.
- Initial test-harness retries corrected Windows sandbox cache permissions, in-flight CSS sampling and foreground-window interference from security probes; no app logic was changed for those harness conditions. Color assertions wait for settled computed states rather than disabling animation or editing styles.

## Review and remaining requirements

Before/after gallery: `publication-local/theme-accent-20261019/index.html`. Direct packaged screenshots show default light, a fictional migrated custom-Focus default light, default dark and Saffron. No screenshots were edited. Keyboard/mouse focus is controlled through normal UI interaction.

This is a post-RC2 source correction, not a replacement RC2 binary. A separately approved future candidate and matching source/screenshots are needed before distribution. Existing RC2 GitHub proposal `0e06a067` remains unchanged and still documents the frozen candidate. No push, installation, public release or distribution occurred. Existing artwork-rights, GPL source-provision, physical Windows/accessibility and separate-PC installer gates remain. Automated contrast/ARIA/layout checks do not certify screen-reader or physical High Contrast behavior.


Local integration target: `publication/beta29-20261019`. The frozen source branch `release/beta29-rc2-20261019` remains at `cedd32a6`; the original integration/checkpoint branches are preserved.
