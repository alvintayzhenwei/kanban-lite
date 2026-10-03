# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub's Report a vulnerability form](https://github.com/alvintayzhenwei/kanban-lite/security/advisories/new). This requires the maintainer to enable private vulnerability reporting in the repository settings. If the form is unavailable, open an issue asking for a private reporting channel without sharing exploit details, credentials, databases, or personal information.

Include the affected version, reproduction steps using fictional data, expected and actual behavior, and the potential impact. There is no guaranteed response time. Security fixes target the latest release; older versions have no promised maintenance period.

## Local security boundary

Kanban Lite binds to `127.0.0.1` and is intended for a trusted local machine. Browser sessions and the MCP adapter use local credentials. Do not expose the service through a public proxy, share session links, or commit `~/.kanban-lite/`. Backups contain project data and need the same protection as the live database. Browser-session access does not establish human identity or authorization to merge or deploy work.

## Automated checks

The Security workflow audits the main package and optional MCP adapter against npm's known-vulnerability database on pull requests, main pushes, and a weekly schedule. It fails on high or critical findings. Lower-severity findings may still appear in its report. The badge shows the latest workflow result on main; it is not a security certification, source-code audit, or guarantee that the software has no vulnerabilities.

The board has no third-party runtime dependencies. Development tools and the optional adapter have their own dependencies. Enable GitHub dependency alerts, security updates, secret scanning, and push protection where available; these are repository settings, not outcomes established by a workflow file.
