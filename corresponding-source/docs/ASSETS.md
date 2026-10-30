> Current update — 30 October 2026: the owner approved the A14 Pomodoro Countdown Corner identity. See [current source](CURRENT_SOURCE.md), [approved assets](branding/a14-pomodoro/README.md) and [branding compatibility](BRANDING_COMPATIBILITY.md). The dated material below is historical. Beta 2 was publicly published on 27 October under its former name; it is not the rebranded candidate.

# Asset provenance and licensing decision

**18 October 2026: distribution hold.** The owner cannot currently confirm the origin or rights of the supplied F/R reference. The [asset-rights audit](ASSET_RIGHTS_AUDIT_20261018.md) supersedes earlier statements of original authorship below. Neither tracing nor generation establishes permission to distribute an input image. The private friend-testing ZIP remains unchanged and must not be sent pending resolution.

Current beta.23 geometry supersedes the beta.22 hand-drawn reproduction: the supplied `docs/branding/FocusRecall-approved-detail.png` is traced directly by `scripts/trace-approved-logo.py`. The original 259 × 287 proportions and contour gaps are retained with uniform scaling. `scripts/verify-traced-logo.py` records over 99.8% native-size silhouette overlap, within one source pixel at the boundary. Production vectors use the approved flat ink/amber fills; raster texture is not represented as vector geometry. Icon centring is verified independently.

| Asset | Provenance | Publication status |
| --- | --- | --- |
| `resources/focusrecall-icon.png`, `resources/focusrecall.ico` | Vector reproduction of the fused F/R and amber page in the owner's approved FocusRecall Logo System Board. Built with scripts/build-brand-assets.cjs; ICO exports nine sizes from 16 through 256 pixels using scripts/build-windows-icon.ps1. The symbol was lowered and centring verified for beta.23. | Used by Windows executable, installer and app windows. No trademark clearance or ownership of the supplied reference is asserted. |
| `resources/focusrecall-mark*.svg`, `resources/focusrecall-lockup*.svg`, `resources/focusrecall-banner.svg`, `resources/support-focusrecall.svg` | Vector assets following the approved ink (#183D56), amber (#CC8C30) and ivory (#FFFDF7) system. Dark standalone marks use the approved light right-hand form. | Product and optional Ko-fi banners. |
| `src/renderer/src/assets/chime.wav` | Synthesized sine-partial bell; reproducible with `node scripts/make-chime.mjs` | Project-generated audio; no sampled recording found. Owner's code license decision still applies. |
| Icons | Inline SVG paths in `src/renderer/src/components/Icons.tsx` | No imported icon package found; authorship/any copied path provenance requires owner confirmation. |
| Fonts | CSS system/installed font families; no bundled font files found | System font names do not redistribute the fonts. Custom installed fonts depend on the user's machine. |
| `docs/screenshots/*.png` | Genuine application captures using isolated fictional profiles; older captures are retained as historical evidence. | Each capture manifest identifies its version. beta.20 captures show the superseded sprout logo and must not represent the approved F/R logo. No generated app screenshots. |
| Third-party packages | License fields and included notices in installed packages/lockfile | Source license does not replace dependency licenses. Review bundled notices before binary distribution. |

Historical concept boards, owner feedback and reference screenshots are deliberately excluded from the publication export. They remain local. An asset's presence in the working tree is not proof of ownership.

The owner has selected GPL-3.0-only for the original application source and original artwork. The former proprietary terms are superseded by [LICENSE](../LICENSE). Third-party licenses and the provenance review above remain applicable; a source license does not establish rights to supplied references or trademarks.

The support cup (`resources/support-cup.svg`) is source-authored vector geometry with no external resource references; no external source was located, but its human/AI authoring history is undocumented. The support banner (`resources/support-focusrecall.svg`) incorporates the traced F/R mark and shares its unresolved reference provenance. Earlier descriptions of both as original artwork were stronger than the available evidence supports.


## Learn artwork — 17 October 2026

The diagrams in `PrincipleVisual.tsx`, other `components/learn/` sources and `learn.css` use inline SVG, CSS and typeset examples recorded in the project. Inspection found no imported stock image, icon-library dependency, external font, hosted asset or identified traced educational diagram. This does not establish their complete creative history: human versus AI authorship and any input references are undocumented. GPL-3.0-only is the project's intended license for rights it can grant, not evidence of ownership of unverified inputs. See the audit for the complete bounded inventory and remaining provenance questions.
