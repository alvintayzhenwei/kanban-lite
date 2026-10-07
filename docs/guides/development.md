# Development checks and roadmap

Use Node.js 24.21.0 or a newer Node 24 patch; development and CI pin 24.21.0.

```sh
npm ci
npm run build
npm run check
npx playwright install chromium
npm run test:browser
npm run format:check
```

CI runs lint, type checks, application tests, MCP contracts, plugin installation checks, package installation/startup checks, and Chromium acceptance. The Security workflow audits main and adapter dependencies on pull requests, main pushes, and weekly runs. High or critical findings fail the check. The Security badge shows the latest main-branch workflow result; it is not a security certification. See [SECURITY.md](../../SECURITY.md) for the local trust boundary and private reporting route.

Dependabot checks npm and GitHub Actions weekly on Monday at 09:00 Asia/Singapore. It does not merge updates automatically. Repository security alerts and private reporting need separate GitHub settings.

SQLite and HTTP use Node's built-in APIs. Passkey ceremonies use pinned SimpleWebAuthn runtime libraries and locally served browser helpers. The optional MCP adapter has separate locked SDK/schema dependencies. Development dependencies are not needed to run the built app. Node 24 SQLite API maturity may vary by patch; this project verifies its pinned patch. Performance measurements describe one machine, not universal guarantees.

## Delivery roadmap

1. **Local foundation:** persistent multi-repository board, verification, recovery, CI, Dependabot, and live badges.
2. **Claude Code and Codex:** shared MCP adapter and skills source, separate validated plugin packages, and actual host acceptance.
3. **Workflow integration:** read-only OpenSpec import/reconciliation and project workflow modes for Agent Skills, Superpowers, or both. Preserve source authority and approval gates.

See the [design](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/superpowers/specs/2026-10-01-kanban-lite-design.md) and [Release 1 plan](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/superpowers/plans/2026-10-01-release-1.md).
