# Auto-start on macOS

A foreground terminal service ends when its process stops. A per-user LaunchAgent starts Kanban Lite at macOS login and restarts it after a crash. It runs only while that user is logged in.

First build a stable checkout with `npm ci && npm run build`. Stop the foreground board you own with Ctrl+C before setup. If a LaunchAgent already runs the board, inspect and update that agent. Never start two writers for one data directory. Keep the exact directory used by the MCP adapter. This example uses the default `~/.kanban-lite` directory.

Run this from the built checkout:

```sh
python3 <<'PY'
from pathlib import Path
import os, plistlib, shutil, subprocess

repo = Path.cwd().resolve()
data = (Path.home() / '.kanban-lite').resolve()  # Replace with your existing data directory.
node = shutil.which('node')
entry = repo / 'dist/src/cli.js'
if not node or not entry.is_file():
    raise SystemExit('Install supported Node.js and build this checkout first.')
agent = Path.home() / 'Library/LaunchAgents/com.alvintay.kanban-lite.plist'
if agent.exists():
    raise SystemExit('An agent already exists. Inspect and update it; do not overwrite it.')
logs = Path.home() / 'Library/Logs/KanbanLite'
logs.mkdir(parents=True, exist_ok=True)
agent.parent.mkdir(parents=True, exist_ok=True)
config = {
    'Label': 'com.alvintay.kanban-lite',
    'ProgramArguments': [str(Path(node).resolve()), str(entry), 'start', '--data-dir', str(data)],
    'WorkingDirectory': str(repo),
    'RunAtLoad': True,
    'KeepAlive': True,
    'ThrottleInterval': 10,
    'Umask': 0o077,
    'StandardOutPath': str(logs / 'stdout.log'),
    'StandardErrorPath': str(logs / 'stderr.log'),
}
with agent.open('xb') as out:
    plistlib.dump(config, out)
subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(agent)], check=True)
print('Open http://localhost:4317/; use CLI login once to enroll a passkey.')
PY
```

Use an absolute Node path and a checkout or installation path you will keep. Update the agent before moving Node or removing the checkout. Verify the default port with `curl --fail http://localhost:4317/health`. Logs live in `~/Library/Logs/KanbanLite/`; do not share login links or credentials from other files. Restarting does not sign you in automatically.

Inspect or stop this exact agent:

```sh
launchctl print "gui/$(id -u)/com.alvintay.kanban-lite"
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.alvintay.kanban-lite.plist"
```

To enable it again, run `launchctl bootstrap` with the same domain and plist path. To disable auto-start, boot it out and remove that plist. Linux and Windows need their own service manager configured with the same absolute entrypoint, data directory, and single-writer rule.

## Setup prompt

Paste this into Codex or Claude Code when you want the agent to configure the LaunchAgent:

```text
Set up Kanban Lite to start at my macOS login and restart after a crash. This
request authorizes configuring its per-user LaunchAgent. Inspect existing
listeners, LaunchAgents, service lock, installed build and MCP configuration
first. Reuse the established data directory; if it cannot be verified, ask me
for its exact path before starting anything. Back up the board through its
supported backup command and preserve any existing agent before changes. Use
absolute Node/build paths, private permissions, and local-only binding. Never
start a second writer or disclose credentials. Verify health and preservation
of existing projects/cards, then open http://localhost:4317/. Guide me through
one-time passkey enrollment; leave Touch ID/PIN approval to me. Do not merge,
publish, configure remote access, or claim passkey acceptance without testing.
```

[Back to Kanban Lite](../../README.md)
