# Local MCP and plugin setup

Kanban Lite provides ten real MCP tools through one optional stdio adapter. Both host packages use that adapter and the same board service. The adapter never opens SQLite, starts the board, runs project commands, or reads artifact contents. Automatic OpenSpec import/synchronization remains Release 3.

## Build and start

Use Node **24.21.0 or a newer Node 24 patch**. From the Kanban Lite checkout:

```sh
npm ci
npm run build
npm ci --ignore-scripts --prefix adapters/mcp
npm run build:mcp
npm start -- --open
```

Keep that board terminal running. In another terminal, configure your host. The board and adapter must use the same data directory. The default is `~/.kanban-lite`; an already running board may use a custom directory. Preserve the actual directory in restart commands. Rebuild and restart an older Release 1 service before using the new agent endpoint; an old running process does not gain new capabilities when its files are rebuilt.

## Direct MCP configuration

Use an absolute path to the built adapter and your actual data directory. Replace the example paths below; do not paste a literal placeholder.

Codex:

```sh
codex mcp add kanban-lite -- node /absolute/path/to/kanban-lite/adapters/mcp/dist/stdio.js --client codex --data-dir /absolute/path/to/kanban-data
codex mcp get kanban-lite
```

Claude Code:

```sh
claude mcp add --transport stdio --scope user kanban-lite -- node /absolute/path/to/kanban-lite/adapters/mcp/dist/stdio.js --client claude --data-dir /absolute/path/to/kanban-data
claude mcp get kanban-lite
```

Quote each path containing spaces. Start a new host session and inspect the discovered `kanban_*` tools. Direct MCP configuration provides tools; plugin installation additionally supplies the shared `kanban-workflow` skill. Choose one registration route per host to avoid duplicate servers.

Removal removes only that server entry, not board data:

```sh
codex mcp remove kanban-lite
claude mcp remove --scope user kanban-lite
```

## Generate host packages

```sh
npm run package:plugins
```

Generated directories and archives are under `artifacts/plugins/`, including hidden host manifests. Archive contents exclude credentials, databases, dependency directories, and unrelated source files. Generation refuses an existing package output rather than deleting it. For another build, choose a fresh output directory:

```sh
node scripts/package-plugins.mjs --output /absolute/path/to/new-packages
```

The adapter must be built first. Validate a fresh package before installing dependencies:

```sh
node scripts/validate-plugins.mjs artifacts/plugins/kanban-lite-codex
node scripts/validate-plugins.mjs artifacts/plugins/kanban-lite-claude
```

The project validator checks the official portable schemas, manifest consistency, entrypoints, and archive hygiene. It is not a substitute for a host's own loader/validator. Claude Code's `claude plugin validate /absolute/path/to/kanban-lite-claude --strict` is the authoritative Claude check; actual Claude acceptance is pending on this development machine because Claude Code is unavailable.

## Codex plugin

Prepare the package's locked dependencies **before** installation. The local marketplace installs a cached copy; this package must include the installed dependencies when copied by the host.

```sh
npm ci --omit=dev --ignore-scripts --prefix artifacts/plugins/kanban-lite-codex/adapter
codex plugin marketplace add /absolute/path/to/kanban-lite/artifacts/plugins
codex plugin add kanban-lite-codex@kanban-lite-local
```

The generated `.agents/plugins/marketplace.json` declares only this plugin and does not overwrite other marketplaces. Start a new Codex chat/session to load the skill and tools. Plugin install/remove commands depend on the installed CLI version; these were checked against Codex CLI 0.159.2. When upgrading, prepare a fresh package, remove/re-add this plugin through the supported host flow, and verify discovery again. Do not edit cached source as the development workflow.

Removal:

```sh
codex plugin remove kanban-lite-codex@kanban-lite-local
codex plugin marketplace remove kanban-lite-local
```

Only remove the marketplace if you no longer need its packages. Board state remains in its original data directory.

## Claude Code plugin

Extract `kanban-lite-claude.tar.gz` into your chosen directory. Install dependencies in the extracted package and load it through Claude Code's local plugin option:

```sh
npm ci --omit=dev --ignore-scripts --prefix /absolute/path/to/kanban-lite-claude/adapter
claude plugin validate /absolute/path/to/kanban-lite-claude --strict
claude --plugin-dir /absolute/path/to/kanban-lite-claude
```

To remove this session-local loading, exit Claude Code and start it without `--plugin-dir`. No board data is deleted. The package is generated and tested through the SDK; installed Claude Code discovery remains unverified until the commands run in a real Claude installation.

## Custom data directories for plugins

The adapter accepts explicit `--data-dir`, which takes precedence over its own `KANBAN_DATA_DIR` environment variable. Codex CLI 0.159.2 did not forward that variable from the host environment during acceptance. Use explicit arguments for a custom directory; do not assume a shell export reaches the adapter.

Use the direct MCP route with `--data-dir`. For the plugin route, before installing a local package, append `--data-dir` and the absolute directory as separate argument elements in both its `mcp.json` and `.mcp.json` server configuration. Keep credentials out of these files. A package with this local path is personal setup, not a portable distribution artifact. Do not register both direct MCP and the plugin's MCP server simultaneously.

## First real tool call

Paste into a new host chat after discovery:

```text
Use Kanban Lite MCP tools to list registered projects and cards for my current repository. Do not modify cards yet. Report the actual discovered tools and any service/configuration errors. Do not use browser automation if the tools are available.
```

Then, to populate cards:

```text
Read the repository instructions and existing spec/plan documents. Use the Kanban Lite workflow skill if installed. Propose a small set of task cards with phases, blockers, artifact paths, and verification criteria. Say explicitly that my reply Proceed authorizes creating these proposed cards only, not implementation, merge, or deployment. After that approval, use the real Kanban MCP tools to check duplicates, create the missing cards, apply the approved fields, and read them back. Criteria belong in descriptions until checks actually run. Report created/skipped counts and any partial failures.
```

## Diagnostics and limits

- `SERVICE_UNAVAILABLE`: explicitly start the board with the matching directory; check its terminal. Plugin loading does not start it.
- `INCOMPATIBLE_PROTOCOL`: rebuild/restart the board and adapter. Health must advertise `agentProtocolVersion: 1`.
- `UNAUTHORIZED` or credential diagnostics: check the local directory/service setup. Never print or paste the credential file.
- `CONFLICT`: compare returned current state and reconcile; never blindly retry with a newer revision.
- `POLICY`: current passing evidence is required for Done. MCP offers no human override.
- Missing tools: verify Node, installed adapter dependencies, host enablement, and a new session after installation.
- Browser login required: MCP access does not sign in Chrome or Codex's browser. From the source repository, run `node dist/src/cli.js open --data-dir /path/to/kanban-data` with the same directory as the adapter. On macOS, add `--browser "Google Chrome"` to choose Chrome. The command opens a fresh one-time login without restarting the board or invalidating existing sessions. See [browser login instructions](../README.md#start-locally); older services require one rebuild/restart after upgrading.

Tools are `kanban_list_projects`, `kanban_register_project`, `kanban_list_cards`, `kanban_get_card`, `kanban_create_card`, `kanban_update_card`, `kanban_move_card`, `kanban_record_evidence`, `kanban_list_events`, and `kanban_update_project`. Host namespaces may add a prefix. Mutations require the current `expectedRevision`; creation requires 0. Tool results use `structuredContent.result`; failures carry `isError`, code/message, and current state for conflicts.

The board uses pinned SimpleWebAuthn runtime libraries for browser passkeys; SQLite and HTTP remain built-in Node APIs. The optional adapter has two direct runtime dependencies (official MCP SDK and Zod), with its transitive packages locked separately. See [Release 2 acceptance](release-2-acceptance.md) for measured footprint and host evidence.

Format grounding: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [Claude plugin reference](https://code.claude.com/docs/en/plugins-reference), and the installed host CLI help. These local stdio packages target local hosts, not cloud/web/mobile runtimes.

## Browser passkeys

The browser board is `http://localhost:4317/` by default. Enroll through an
authenticated CLI-link session under **Passkeys → Create passkey**, then use
**Sign in with passkey** on returning visits. MCP continues to use its local
credential and IPv4-loopback endpoint. For first enrollment, unsupported
browsers, or lost keys, run `kanban-lite open --data-dir /path/to/your/kanban-data`.
Use the exact data directory already configured for the established service.
Do not start another writer. See the README's passkey section for key removal,
fresh verification, and backup recovery trust.
