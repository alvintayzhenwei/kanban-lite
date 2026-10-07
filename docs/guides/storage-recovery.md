# Storage, backups, and recovery

Default state lives in `~/.kanban-lite/`, outside repositories and plugin caches. The directory contains `board.sqlite`, a private local credential, and an active service lock. Never commit or share the credential or browser session links.

Use the same `--data-dir` value on the service and MCP adapter. For an existing service, identify its actual data directory before restarting or recovering it. Do not start another writer. A port conflict or active writer lock should lead you to inspect the existing service, not remove its lock.

## Back up

Create a backup while the service is running or stopped. For a source checkout, replace the npx package command with `node dist/src/cli.js`.

```sh
npx --yes @alvintayzhenwei/kanban-lite backup --output /path/to/new-backup.sqlite
```

The command refuses to overwrite an existing output file. Backups include cards, evidence, registered paths, history, public passkey credentials, and the board owner's identity. Protect them as project data. Restoring a backup restores its access trust, including credentials removed since that backup.

## Restore

Stop the service before restoring:

```sh
npx --yes @alvintayzhenwei/kanban-lite restore --input /path/to/backup.sqlite
```

Restore validates schema and database integrity, preserves existing state in a `pre-restore-*.sqlite` backup, and replaces the database atomically. Do not copy the live database manually. If startup leaves a `service.acquire` guard, first ensure no Kanban startup or recovery process is running; then remove that guard directory. Automatic guard reclamation is intentionally avoided.

Schema-version-1 backups restore board data without passkeys; enroll again after CLI login. Older application versions cannot open the new schema. Use a backup made before upgrading to roll back.

See [browser login recovery](../getting-started/browser-login.md) for CLI browser sessions and passkey recovery.

[Back to Kanban Lite](../../README.md)
