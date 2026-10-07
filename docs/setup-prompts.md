# Copy-paste setup prompts

Use these prompts in **Codex** or **Claude Code** with local terminal access. Both hosts run the same Kanban Lite application. The browser prompts below start the standalone board. For real agent tools and the shared workflow skill, use the MCP/plugin setup prompt next. Automatic OpenSpec synchronization remains a later release; Claude installed-host acceptance remains pending on the development machine.

The repository is private. Your local Git credentials must already have access. If cloning fails, authenticate with GitHub through your normal account flow; never paste tokens into a prompt.

## MCP/plugin setup for either host

Use this prompt in a local Codex or Claude Code session with terminal access:

```text
Set up Kanban Lite's implemented local MCP adapter for this host. Read applicable repository instructions, README.md, and docs/mcp-setup.md first. Preserve existing checkouts, board data, host configuration, and unrelated MCP entries.

Install the optional adapter's locked dependencies and build it. Identify the running board's actual data directory and protocol. Reuse a compatible service; rebuild/restart only a service I own, preserving its directory. Do not start a second writer or stop another chat's process.

Use this host's supported direct MCP setup with an absolute built entrypoint, --client codex or claude, and explicit --data-dir. If I ask for the plugin package instead, generate/validate it, install its runtime dependencies before host loading, and set the same nonsecret directory argument in both local MCP manifests before installation. Never put credentials into prompts or configurations. Do not register both routes.

Verify discovery of all ten kanban_* tools and a real read-only list_projects call in the host. Start a new host session when reload is needed; do not equate configuration listing or an SDK handshake with actual host discovery. If tools cannot be used from the current session, report that limit and provide the exact next-session verification step. Do not claim success from a failed tool result. Do not claim automatic OpenSpec synchronization.
```

The direct MCP route supplies tools; the plugin route also supplies the `kanban-workflow` skill. Actual host discovery must be checked on your own installation.

## Codex browser setup

Open a local Codex chat in the parent directory where you want the checkout, then paste:

```text
Set up https://github.com/alvintayzhenwei/kanban-lite as a lightweight localhost Kanban board in this workspace.

1. Read applicable AGENTS.md instructions. Inspect the current directory before making changes. Reuse an existing kanban-lite checkout if available; preserve local changes and do not overwrite files. Otherwise clone the repository into a new kanban-lite directory. If access fails, report the exact error without exposing credentials.
2. Read the repository README and package.json. Check Node and npm. Use Node 24.21.0 or a newer Node 24 patch. If the required runtime is missing, explain the requirement before changing global tooling.
3. Run npm ci and npm run build in the checkout. Resolve setup failures without weakening checks or changing dependency versions merely to bypass an error.
4. Check whether Kanban Lite already runs on 127.0.0.1:4317. Reuse a healthy running service; do not kill another process or start a second writer. For a fresh instance, run npm start -- --open in a persistent terminal. Keep the service bound to localhost. For an existing service, identify and preserve its actual data directory and report the matching restart command; do not assume it uses ~/.kanban-lite. For a new instance, use ~/.kanban-lite unless I specify another directory.
5. Verify the board opens and is usable. Do not print, copy, or share the one-time session credential or private local credential. Report the plain URL, checkout path, data directory, and how to stop/restart the service. If browser access is unavailable, report the verification limit and provide the manual steps.
6. Explain how I add repository roots with Add project, create a card, attach repository-relative spec/plan paths, and record verification evidence before Done. For real MCP/plugin setup, follow docs/mcp-setup.md separately. Do not claim automatic OpenSpec synchronization.
```

## Claude Code browser setup

Start Claude Code in the parent directory where you want the checkout, then paste:

```text
Set up https://github.com/alvintayzhenwei/kanban-lite as a lightweight localhost Kanban board on this machine.

1. Read applicable CLAUDE.md and repository instructions. Inspect the current directory. Reuse an existing kanban-lite checkout while preserving local changes; otherwise clone into a new kanban-lite directory. Never overwrite an unrelated directory. If GitHub access fails, report the exact error without exposing credentials.
2. Read README and package.json. Verify Node 24.21.0 or a newer Node 24 patch and npm are available. Explain missing runtime requirements before changing global tooling.
3. Run npm ci and npm run build. Diagnose setup failures without disabling checks or casually changing dependency versions.
4. Check for an existing Kanban Lite service on 127.0.0.1:4317. Reuse a healthy instance, identify its actual data directory, and preserve it in the restart command. Do not assume an existing service uses ~/.kanban-lite. Do not kill unrelated processes or start another writer. Otherwise start npm start -- --open in a persistent terminal, using the default ~/.kanban-lite data directory unless I specify another one. Keep the service localhost-only.
5. Verify the browser board is usable. Keep session links and the private credential secret. Report only the plain board URL, checkout path, data directory, and stop/restart instructions. If you cannot inspect the browser, state that limitation and give manual verification steps.
6. Guide me through Add project, a first card, repository-relative spec/plan links, and passing verification evidence before Done. This prompt sets up only the browser board. For the implemented MCP adapter/plugin packages, use docs/mcp-setup.md separately. Do not claim automatic OpenSpec synchronization.
```

## First project and SDLC workflow

After setup, open the authenticated browser tab. Select **Add project** and enter the absolute path to your development repository. Create one card per implementable task. Keep board status and SDLC phase separate: for example, a Ready card can be in Planning, and an In Progress card can be in Implementation.

For existing Agent Skills, Superpowers, or OpenSpec work, keep the source documents authoritative. Attach their repository-relative paths as artifact metadata on the card. The board currently does not read or modify those documents. Continue to use each installed workflow's design, review, and approval requirements. Record actual test/review evidence on the card; card status does not approve a merge or deployment.

Paste this follow-up into either host after setup. It separates card approval from implementation approval. Browser automation must be available and authenticated; otherwise the assistant must state the exact blocker.

```text
Help me populate Kanban Lite for the current repository alongside my installed Agent Skills, Superpowers, and OpenSpec workflows.

Read the applicable repository instructions and existing spec/plan documents. Propose a small set of cards with titles, status, SDLC phase, blockers, repository-relative artifact paths, and concrete verification criteria. Use installed skills according to their instructions. Preserve approval gates.

After showing the proposed cards, wait for my approval. In this task, my reply “Proceed” or “Approved” authorizes you to create those proposed cards in Kanban Lite through the authenticated browser UI. It does not authorize implementing the cards, changing repository source files, merging, or deploying. Do not ask me to choose between card entry and implementation after I give this approval.

When approved, select or register the current repository, check for existing matching cards to avoid duplicates, and create only the missing approved cards. Store verification criteria in each card description; do not record them as passing evidence. Verify the cards appear in the correct project and report the created/skipped counts. If browser automation or authentication is unavailable, explain the exact blocker and provide manual card details; never claim creation succeeded.

Do not use nonexistent Kanban MCP tools, write directly to the database, or claim automatic OpenSpec synchronization. Do not mark work Done without current passing evidence.
```

## Recover a proposal-only chat

If an earlier prompt produced card proposals but did not enter them, paste this in that same chat:

```text
Create the cards you already proposed in Kanban Lite using the authenticated browser UI. This authorizes card entry only; do not begin implementation, reconcile the repository baseline, merge, or deploy. Select the intended repository project, inspect existing cards to avoid duplicates, and create the missing proposed cards with their descriptions, phases, blockers, artifact paths, and verification criteria. Keep criteria in descriptions, not passing evidence. Verify the saved cards in the board and report created/skipped counts. If browser access or authentication is blocked, report the exact blocker rather than claiming success. Do not write directly to the database or use nonexistent MCP tools.
```

Opening the plain URL in another browser may show an unauthenticated board. Reuse the browser tab opened with `--open`; browser sessions are not shared across Chrome and the Codex in-app browser. If that session expired, use **Sign in with passkey** if enrolled, or run `kanban-lite open --data-dir /path/to/your/kanban-data` to obtain a fresh browser login without restarting the service. Do not stop another chat's service without authorization.

## Restart and alternate settings

Keep the terminal running while using the board. Stop a service you started with **Ctrl+C**. For default storage, restart from the checkout with `npm start -- --open`; for an existing custom data directory, include its original `--data-dir` value. This creates a new browser session without exposing its credential in terminal output.

For an occupied port or a separate board, choose explicit settings:

```sh
npm start -- --open --port 4320 --data-dir /absolute/path/to/kanban-data
```

Use the same data directory on subsequent restarts and backups. If the service reports an active writer lock, inspect the existing service instead of deleting its lock. See [storage and recovery](guides/storage-recovery.md) before restoring data.

## Auto-start, logout, and confirmation prompts

See [auto-start](guides/auto-start.md), [agent tracking](guides/agent-tracking.md), and [browser login](getting-started/browser-login.md) for the LaunchAgent recipe, copy-paste prompts, and **Log out → Sign in with passkey** acceptance steps. MCP setup alone does not install an automatic chat prompt.
