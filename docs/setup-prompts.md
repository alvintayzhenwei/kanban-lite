# Copy-paste setup prompts

Use these prompts in **Codex** or **Claude Code** with local terminal access. Both hosts run the same Kanban Lite application. This guide starts the Release 1 browser board; it does not install an MCP server or host plugin. Claude/Codex plugin packages and automatic OpenSpec synchronization are planned releases.

The repository is private. Your local Git credentials must already have access. If cloning fails, authenticate with GitHub through your normal account flow; never paste tokens into a prompt.

## Codex

Open a local Codex chat in the parent directory where you want the checkout, then paste:

```text
Set up https://github.com/alvintayzhenwei/kanban-lite as a lightweight localhost Kanban board in this workspace.

1. Read applicable AGENTS.md instructions. Inspect the current directory before making changes. Reuse an existing kanban-lite checkout if available; preserve local changes and do not overwrite files. Otherwise clone the repository into a new kanban-lite directory. If access fails, report the exact error without exposing credentials.
2. Read the repository README and package.json. Check Node and npm. Use Node 24.21.0 or a newer Node 24 patch. If the required runtime is missing, explain the requirement before changing global tooling.
3. Run npm ci and npm run build in the checkout. Resolve setup failures without weakening checks or changing dependency versions merely to bypass an error.
4. Check whether Kanban Lite already runs on 127.0.0.1:4317. Reuse a healthy running service; do not kill another process or start a second writer. For a fresh instance, run npm start -- --open in a persistent terminal. Keep the service bound to localhost. Use the default ~/.kanban-lite data directory unless I specify another one.
5. Verify the board opens and is usable. Do not print, copy, or share the one-time session credential or private local credential. Report the plain URL, checkout path, data directory, and how to stop/restart the service. If browser access is unavailable, report the verification limit and provide the manual steps.
6. Explain how I add repository roots with Add project, create a card, attach repository-relative spec/plan paths, and record verification evidence before Done. Do not invent MCP tools, install unimplemented host plugins, or claim automatic OpenSpec synchronization.
```

## Claude Code

Start Claude Code in the parent directory where you want the checkout, then paste:

```text
Set up https://github.com/alvintayzhenwei/kanban-lite as a lightweight localhost Kanban board on this machine.

1. Read applicable CLAUDE.md and repository instructions. Inspect the current directory. Reuse an existing kanban-lite checkout while preserving local changes; otherwise clone into a new kanban-lite directory. Never overwrite an unrelated directory. If GitHub access fails, report the exact error without exposing credentials.
2. Read README and package.json. Verify Node 24.21.0 or a newer Node 24 patch and npm are available. Explain missing runtime requirements before changing global tooling.
3. Run npm ci and npm run build. Diagnose setup failures without disabling checks or casually changing dependency versions.
4. Check for an existing Kanban Lite service on 127.0.0.1:4317. Reuse a healthy instance. Do not kill unrelated processes or start another writer. Otherwise start npm start -- --open in a persistent terminal, using the default ~/.kanban-lite data directory unless I specify another one. Keep the service localhost-only.
5. Verify the browser board is usable. Keep session links and the private credential secret. Report only the plain board URL, checkout path, data directory, and stop/restart instructions. If you cannot inspect the browser, state that limitation and give manual verification steps.
6. Guide me through Add project, a first card, repository-relative spec/plan links, and passing verification evidence before Done. This is the Release 1 browser board. Do not claim that Claude plugins, MCP tools, or automatic OpenSpec synchronization are already implemented.
```

## First project and SDLC workflow

After setup, open the authenticated browser tab. Select **Add project** and enter the absolute path to your development repository. Create one card per implementable task. Keep board status and SDLC phase separate: for example, a Ready card can be in Planning, and an In Progress card can be in Implementation.

For existing Agent Skills, Superpowers, or OpenSpec work, keep the source documents authoritative. Attach their repository-relative paths as artifact metadata on the card. The board currently does not read or modify those documents. Continue to use each installed workflow's design, review, and approval requirements. Record actual test/review evidence on the card; card status does not approve a merge or deployment.

Paste this follow-up into either host after setup:

```text
Help me track the current repository with Kanban Lite alongside my installed Agent Skills, Superpowers, and OpenSpec workflows. Read the applicable repository instructions and existing spec/plan documents first. Propose a small set of cards with titles, status, SDLC phase, blockers, repository-relative artifact paths, and concrete verification criteria. Use existing installed skills according to their instructions. Preserve all approval gates. Give me the card details to enter in the browser; do not claim automatic synchronization or call nonexistent Kanban MCP tools. Do not mark work Done without current passing evidence.
```

## Restart and alternate settings

Keep the terminal running while using the board. Stop a service you started with **Ctrl+C**. Restart from the checkout with `npm start -- --open`; this creates a new browser session without exposing its credential in terminal output.

For an occupied port or a separate board, choose explicit settings:

```sh
npm start -- --open --port 4320 --data-dir /absolute/path/to/kanban-data
```

Use the same data directory on subsequent restarts and backups. If the service reports an active writer lock, inspect the existing service instead of deleting its lock. See [storage and recovery](../README.md#storage-and-recovery) before restoring data.
