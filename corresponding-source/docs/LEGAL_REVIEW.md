# GPL-3.0-only release review

The owner explicitly selected GPL-3.0-only on 18 October 2026. The previous proposed proprietary EULA is superseded. Original code and original artwork are offered under version 3 only, without additional restrictions on copying, modification, reverse engineering or redistribution. User study records are not licensed to the developer by this change.

The complete unmodified [license](../LICENSE) is included in source, application notices and installer. The English GPL text is authoritative; installer navigation is localized into seven languages. No separate contract or jurisdiction clause is introduced. The existing EULA filename is retained solely for build compatibility.

Before any public binary release: verify ownership/provenance of supplied branding and icon paths, preserve all dependency copyright notices, and provide matching Corresponding Source (including native source, build/install scripts and required dependency sources) in accordance with GPLv3 section 6. Do not publish the existing private Git history or historical verification folders without a separate privacy review. The source export is an input to release review, not proof of legal compliance or a written offer of source.

The installed runtime dependency graph is inventoried by `scripts/prepare-legal.cjs`; MIT, ISC and BSD notices accompany the package. Electron/Chromium notices are supplied beside the executable. Build tools keep their own licenses. A dependency inventory cannot establish authorship of project assets or satisfy source provision by itself.

References: [GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html), [GNU application guidance](https://www.gnu.org/licenses/gpl-howto.html), [GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html).
