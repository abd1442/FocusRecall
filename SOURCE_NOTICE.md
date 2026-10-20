# Matching source and license materials

FocusRecall original code/artwork is **GPL-3.0-only**. Third-party terms remain applicable. Use the source and notices attached to the [single Beta 1 release](https://github.com/abd1442/FocusRecall/releases/tag/v0.1.1-beta.1). No private repository access is needed.

The tag `v0.1.1-beta.1` identifies a release assembly, not one common application build revision. Its own automatic source ZIP/tar contains the application snapshots below. The larger `FocusRecall-Beta-1-Source.zip` additionally supplies dependency/preferred upstream source inputs, exact FFmpeg source, native/theme/artwork/build inputs and pinned runtime source access/replacement directions. `FocusRecall-Beta-1-Notices.zip` contains the corresponding project/component notices.

| Platform | Build source revision | Source folder in this repository |
| --- | --- | --- |
| windows-x64 | `822068b128b47e3cff3627082ee0e336dfa17d71` | [corresponding-source](corresponding-source/SOURCE_MANIFEST.json) |
| linux-x64 | `f583c7de992dfbf8edfe3f20bc369c0f26567112` | [platform-source/linux-x64](platform-source/linux-x64/SOURCE_MANIFEST.json) |
| macos-arm64 | `8bdc835e3e7f7f5a7fa1c62c829c9b2d2f2addca` | [platform-source/macos-arm64](platform-source/macos-arm64/SOURCE_MANIFEST.json) |
| macos-x64 | `f93d7991d4ba52335cfdbc72d536fdd0eb76fcb6` | [platform-source/macos-x64](platform-source/macos-x64/SOURCE_MANIFEST.json) |

The [release manifest](RELEASE-MANIFEST.json) maps every binary to its source, version, SHA-256 and matching source archive. The two Mac snapshots differ only by a verification-script cold-start deadline; application code is unchanged.

Runtime source access must remain available while the binaries are offered. Full recursive Chromium/CIPD retrieval and a complete Electron rebuild were not performed; the source package explains the bounded review and pinned upstream access. Modified components can be rebuilt/replaced using the supplied directions, without vendor-only signing keys.

The owner confirmed authorship of the unchanged F/R logo on 20 October 2026. Editable artwork/theme inputs are retained. The bounded provenance review found no identified outstanding third-party artwork permission request; it is not independent proof of ownership or trademark clearance. Runtime Mac framework permissions and notices are included with the downloads.
