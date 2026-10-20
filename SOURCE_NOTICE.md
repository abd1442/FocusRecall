# Source, licenses and artwork

FocusRecall is GPL-3.0-only. Component licenses remain applicable. The app downloads and source are provided together on each platform release page. Source is not offered only on request.

## Exact build mapping

| Platform | Original build source revision | Application SHA-256 |
| --- | --- | --- |
| windows-x64 | `aab39d4719aa0da6da9dfc0bf08a3d7f89d3b173` | `74c53c3947317555c1df7ec6106bb8ae01726790280789dd180a8d1970745bab` |
| linux-x64 | `6fef041b68cf80ef3701a5e2945b1de2ac5eb78e` | `04bd00ea7792db39ce0b224d6064366119f2b8836d3f039c3d24c2c4c0e650c7` |
| macos-arm64 | `5a79f3b9b8d9c99e85a4e43d2e19eadf2e129d7f` | `a41d98d4ee223aa6023f5b11a33ea02518084d7ad2b32ac598b9e3d350cc098e` |
| macos-x64 | `156d62ce800df0a9b29c0fdfa63de6b42f364910` | `aed1903e2cb034675b4ec803b99f49be307d1fa4c4a564d36418efa1f18fe82f` |

The main branch contains the verified Windows application source under `corresponding-source/`; platform release tags contain their exact curated application snapshots under `corresponding-source/`. `RELEASE_SOURCE.json` maps the snapshot to the original build, binary and attached source archive. The existing project-page history is preserved; private developer history is not imported.

The attached `FocusRecall-0.1.0-beta.29-corresponding-source.zip` contains all four source snapshots, build/native/packaging inputs, theme generators and seeds, dependency inputs, preferred upstream sources, exact FFmpeg source and runtime build/replacement instructions. Select the folder for your platform. `FocusRecall-0.1.0-beta.29-notices.zip` contains the project and component license notices. Each page also provides `SHA256SUMS.txt`.

Pinned equivalent upstream access is documented for unchanged runtime components; the distributor must maintain required source availability while offering binaries. Full recursive Chromium/CIPD retrieval and a complete Electron rebuild were not performed. The included delivery review explains the scope and limitations.

## Artwork

The owner confirmed on 20 October 2026 that they created the F/R logo. Original project artwork is supplied under GPL-3.0-only, with editable code/artwork/theme inputs. The bounded provenance review identified code-authored illustrations and glyphs and a synthesized chime; it found no identified outstanding third-party artwork permission request. This records the owner’s authorship representation, not independent proof of ownership or trademark clearance. Third-party component copyrights and permissions are retained in their notices.

The Windows installer and Linux DEB are unchanged verified files. The Mac ZIPs include the normal app bundle plus installation notes and licenses; all app bytes, permissions and symlinks are preserved. The new ZIP containers still need extraction/opening on real Macs.
