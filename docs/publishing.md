# Publishing Kanban Lite

The repository prepares `@alvintayzhenwei/kanban-lite` for public npm releases. The unscoped `kanban-lite` name belongs to another project. Confirm that your npm account owns the `alvintayzhenwei` scope before publishing; GitHub ownership does not grant npm ownership. A registry lookup returning 404 does not reserve a name.

The CLI remains `kanban-lite`. The npm package includes compiled application code, browser assets, README, license, security policy, and package metadata. The optional MCP adapter stays private and is distributed separately through the plugin packaging workflow.

## Before making GitHub public

Review the entire Git history and tracked files for credentials, private paths, personal information, proprietary material, and assets you cannot redistribute. Removing a file from the latest commit does not remove it from history. Rotate any exposed credential before publication.

Merge the reviewed release preparation into `main`. Enable private vulnerability reporting, dependency alerts, security updates, and secret scanning/push protection where available. Protect `main` and release tags. Configure the GitHub `npm` environment to allow release tags and require maintainer approval if supported by your repository plan. Repository visibility, security settings, and npm configuration are separate manual actions; this change does not perform them.

## Verify the release contents

Use Node 24.21.0 or a newer Node 24 patch and npm 11.5.1 or newer.

```sh
npm ci
npm ci --ignore-scripts --prefix adapters/mcp
npm run check
npm run check:mcp
npm run test:plugins
npm run format:check
npm audit --audit-level=high
npm audit --audit-level=high --prefix adapters/mcp
npx playwright install chromium
npm run test:browser
npm run test:package
npm pack --dry-run
```

`test:package` builds and packs the actual allowlisted files, installs the tarball in a temporary directory, checks the executable, starts an isolated board, and verifies its HTTP assets. It removes the temporary installation afterward. `prepack` compiles the source before packing or publishing; no build script runs for npm consumers.

## Bootstrap the first npm version

Trusted publisher setup uses an existing npm package's settings. For a new package, publish the initial reviewed version from your own machine while authenticated to npm. This is an intentional public release and cannot be treated as a reversible preview. First confirm account and scope ownership:

```sh
npm login
npm whoami
npm view @alvintayzhenwei/kanban-lite version
```

An expected 404 means the package does not yet exist; other errors need investigation. From the clean, reviewed `main` checkout, run the verification above and inspect the pack preview, then publish only when ready:

```sh
npm publish --access public
```

Complete npm's authentication/2FA prompt. Do not paste tokens or recovery codes into GitHub, source files, or chat. This local bootstrap does not carry GitHub build provenance. Each published name/version is immutable; the tag workflow must use a new version after bootstrap.

## Configure subsequent trusted releases

In the npm package's Settings → Trusted publishing, add GitHub Actions with these exact fields:

- Organization or user: `alvintayzhenwei`
- Repository: `kanban-lite`
- Workflow filename: `publish.yml`
- Environment name: `npm`
- Allowed actions: allow direct `npm publish` for this workflow.

The environment must match the job's `environment: npm`. Current npm settings default to staged publication; this workflow uses direct publication, so its permission must be selected explicitly. After verifying trusted publishing works, restrict traditional token-based publishing in npm settings. The workflow needs no `NPM_TOKEN` secret. It uses a GitHub-hosted runner and checks the npm CLI supports OIDC. Provenance requires both the repository and package to be public.

## Release from GitHub to npm

On a development branch, update `package.json` and `package-lock.json` together without automatically creating a tag:

```sh
npm version patch --no-git-tag-version
```

Review and merge the version change into `main`; confirm CI and Security results for that commit. From the clean, up-to-date `main` checkout, create and push the matching tag. For example, after a `0.1.0` bootstrap and a bump to `0.1.1`:

```sh
git tag -a v0.1.1 -m "Release 0.1.1"
git push origin v0.1.1
```

Pushing a `v*` tag starts `publish.yml`. The job rejects prerelease tags, mismatched versions, and commits outside `main` history, runs all checks and the installed-package smoke test, then publishes with provenance. Wait for the actual workflow result and verify the registry version before announcing the release:

```sh
npm view @alvintayzhenwei/kanban-lite version dist.attestations
npx --yes @alvintayzhenwei/kanban-lite@0.1.1 --help
```

A source change, passing local tests, or GitHub tag does not establish successful npm publication. If authentication fails, check the scope, trusted publisher fields, direct-publish permission, environment, and workflow filename. Never reuse an already published version.

See npm's [trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) and [scoped package publishing guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) for current account setup requirements.
