# Kanban Lite

[![npm version](https://img.shields.io/npm/v/%40alvintayzhenwei%2Fkanban-lite)](https://www.npmjs.com/package/@alvintayzhenwei/kanban-lite)
[![CI](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/ci.yml)
[![Security checks](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/alvintayzhenwei/kanban-lite/blob/main/LICENSE)

A local Kanban board for developers and coding agents. Track repository work, blockers, artifact links, and verification evidence across projects. The browser app uses SQLite and Node's built-in HTTP and SQLite APIs; optional MCP tools support Codex and Claude Code.

![Kanban Lite board with illustrative sample data](docs/assets/board-desktop.png)

## Quick start

Use Node.js **24.21.0 or a newer Node 24 patch**. Node 25+ is not supported.

```sh
npx --yes @alvintayzhenwei/kanban-lite start --open
```

This starts the local service at `http://localhost:4317/` and opens an authenticated browser session. The upcoming `0.3.0` release candidate includes passkey onboarding and browser logout; those features are unavailable from npm until that release is published.

For a source checkout:

```sh
git clone https://github.com/alvintayzhenwei/kanban-lite.git
cd kanban-lite
npm ci
npm run build
npm start -- --open
```

## Guides

- [Copy-paste setup prompts](docs/setup-prompts.md) for browser board and MCP/plugin setup.
- [Browser login, passkeys, and logout](docs/getting-started/browser-login.md), including the current **Copy setup prompt** onboarding flow.
- [Agent tracking and approval boundaries](docs/guides/agent-tracking.md).
- [Storage, backups, and recovery](docs/guides/storage-recovery.md).
- [macOS auto-start](docs/guides/auto-start.md).
- [Development checks and roadmap](docs/guides/development.md).
- [MCP setup](docs/mcp-setup.md) and [release publishing](docs/publishing.md).

## Release status

The npm version badge reports the latest published package. The `0.3.0` release candidate adds passkeys, guided onboarding, browser logout, and macOS auto-start guidance; these features remain unavailable from npm until publication. The `kanban-lite open` browser login command arrived in `0.2.0`. Automated Chromium results do not establish real macOS Touch ID/PIN or Codex embedded-browser acceptance.

## License

Kanban Lite uses the [MIT License](https://github.com/alvintayzhenwei/kanban-lite/blob/main/LICENSE). See [SECURITY.md](SECURITY.md) for trust boundaries and private vulnerability reporting.
