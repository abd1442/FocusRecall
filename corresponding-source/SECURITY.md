# Security and privacy reports

A14 Pomodoro hardens renderer IPC permissions, navigation and report rendering, protects database transitions, and validates backup schema constraints. Automated and isolated packaged checks are described in [release status](docs/RELEASE_SECURITY.md). They do not replace a complete independent audit or native installation and assistive-technology testing.

This development repository is private. Report concerns to the owner through an established private channel. If a distribution repository becomes public, do not post exploit details or sensitive data in public issues. Use private vulnerability reporting only if it is enabled; otherwise request a private reporting channel first.

Include the affected version, minimal fictional reproduction, impact and Windows version. Never send a personal database, vault, credentials or window-title history. No response-time or supported-version guarantee is offered yet.

Records remain local and tracking is off by default. Local storage is not application-level encryption. Opening supported external resources delegates to Windows; explicitly sending notes writes to the selected Obsidian destination. Keep separate backups of external files.

Production packages disable Node execution/inspection environment switches and validate app.asar. QA builds explicitly enable inspection and must never be distributed. These controls do not protect against an administrator replacing unsigned binaries or native modules.
