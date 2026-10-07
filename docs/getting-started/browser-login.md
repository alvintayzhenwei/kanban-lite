# Browser login, passkeys, and logout

Kanban Lite serves the board at `http://localhost:4317/` by default. Keep the service running and use the browser opened with `--open` or `kanban-lite open`. Do not open `public/index.html` as a `file://` page; the app needs its local API and browser session.

## First-time setup

1. Open the board in the browser you want to use.
2. Expand **First-time setup** and choose **Copy setup prompt**.
3. Paste the prompt into Codex on the computer running the board. It verifies the existing service, data directory, and CLI, then opens a trusted browser session. No placeholder path needs editing.
4. In that browser, choose **Create passkey**, select a credential manager, and approve with Touch ID or your device PIN.
5. After the success message, use the board. Future visits use **Sign in with passkey**.

**Do this later** defers enrollment for the current tab's session. **Check connection** checks only the current browser session; it cannot authenticate a different browser. **Need help?** shows CLI recovery and key-storage details.

![Current first-time setup with Copy setup prompt](../assets/onboarding-desktop.png)

## Sign-in and key management

After an eight-hour browser session expires or the service restarts, choose **Sign in with passkey**. Passkeys persist in the board database. MCP credentials are separate and do not sign in to browsers.

Adding or removing keys requires a login verified within five minutes. Choose **Verify with passkey** to refresh verification, or run the CLI login command again. Removing a key signs out every browser session. Removing the final key requires CLI recovery before enrolling another key. Keep access to the board host and its data directory.

Use `localhost` consistently for passkeys. MCP keeps its IPv4-loopback endpoint and existing CLI login sessions. Registration offers ES256 (P-256). Browser helpers are served locally. Unsupported browsers retain CLI recovery guidance.

Your credential manager or security key holds the private key. Kanban Lite stores only the public key and credential metadata in `board.sqlite`; it never receives the private key, fingerprint, or device PIN.

## Log out and verify returning login

Click **Log out** in the header. This revokes the current browser's server session, clears its cookie, and shows the sign-in screen. Other tabs sharing that session lose access on their next API request. Other browser sessions and enrolled passkeys remain active. A service restart ends all browser sessions but preserves keys.

To verify returning login, create a passkey, click **Log out**, and refresh. Confirm the board stays private. Then choose **Sign in with passkey** and approve with Touch ID or PIN. The board should return without a terminal command. If no key is enrolled, expand **First-time setup** and choose **Copy setup prompt**, or use the recovery command below. Logging out does not delete projects or cards.

## CLI login recovery

Use the exact data directory already used by the running service and MCP adapter. The command opens a fresh browser session without restarting the service or signing out other browsers. Opening the plain URL alone does not authenticate you.

```sh
kanban-lite open --data-dir /path/to/your/kanban-data
```

For a source checkout, run `node dist/src/cli.js open`. For an npx install, run `npx --yes @alvintayzhenwei/kanban-lite open`. On macOS, append `--browser "Google Chrome"` to choose Chrome. Omit `--data-dir` only when the board uses the default `~/.kanban-lite/` directory.

The `open` command was introduced in `0.2.0`; `0.1.1` does not include it. Rebuild and restart once after upgrading service code. Later browser logins need no restart. For another port or data directory:

```sh
npm start -- --open --port 4320 --data-dir /path/to/kanban-data
```

## Backup trust and acceptance

Database backups include public passkey credentials and the board owner's identity. Restoring a backup restores its access trust, including credentials removed after that backup. Schema-version-1 backups restore board data without passkeys; enroll again after CLI login. Older applications cannot open the new schema; use a pre-upgrade backup to roll back.

Automated Chromium checks use virtual authenticators. Real macOS Touch ID/PIN and Codex embedded-browser acceptance require separate human verification. This is local browser login, not remote access or an extra human-approval gate for MCP actions. Repository acceptance records document automated results and pending human checks.
