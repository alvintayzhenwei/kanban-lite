# Publishing Kanban Lite

The repository publishes `@alvintayzhenwei/kanban-lite` under the npm organization `alvintayzhenwei`, owned by the npm account `alvintay1987`. The unscoped `kanban-lite` name belongs to another project. GitHub ownership does not grant npm ownership.

Version `0.3.0` is published on npm (verified 2026-10-08), with provenance
metadata. It includes passkeys, logout, and guided onboarding.
The workflow uses the GitHub `npm` environment and OIDC. Confirm the package's
trusted-publisher settings in npm before releasing; repository files alone do
not prove that external settings are configured.

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

Version increments are intentional and reviewed, not automatic on every main push. Use `patch` for fixes, `minor` for compatible features, and `major` for breaking changes. The README badge follows npm's latest published version; `/health` reads the installed package version. Neither needs a separate version edit.

Review and merge the version change into `main`; confirm CI and Security results for that commit. From the clean, up-to-date `main` checkout, create and push the matching tag. The completed `0.3.0` release used the following commands. For a future release,
substitute a new reviewed version; do not recreate or move an existing tag:

```sh
git tag -a v0.3.0 -m "Release 0.3.0"
git push origin v0.3.0
```

Pushing a `v*` tag starts `publish.yml`. The job rejects prerelease tags, mismatched versions, and commits outside `main` history, runs all checks and the installed-package smoke test, then publishes with provenance. Wait for the actual workflow result and verify the registry version before announcing the release:

```sh
npm view @alvintayzhenwei/kanban-lite version dist.attestations
npx --yes @alvintayzhenwei/kanban-lite@0.3.0 --help
```

A source change, passing local tests, or GitHub tag does not establish successful npm publication. If authentication fails, check the scope, trusted publisher fields, direct-publish permission, environment, and workflow filename. Never reuse an already published version.

See npm's [trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) and [scoped package publishing guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) for current account setup requirements.

## Validate without publishing

Use Actions → Publish npm → Run
workflow on `main`. A manual run executes version/main-ancestry validation,
all checks, the installed-package smoke test, and `npm pack --dry-run`. It
skips `npm publish`. A passing manual run is release readiness evidence, not a
published version. Tag pushes still publish only when `vX.Y.Z` matches the
package version and the tagged commit belongs to main history.

## Future release checklist

- Review the [changelog](../CHANGELOG.md) and [browser guide](getting-started/browser-login.md).
- Verify real Chrome/macOS enrollment and returning sign-in with Touch ID/PIN;
  virtual-authenticator tests do not establish real-device acceptance.
- Back up the existing board before schema-2 migration. Restoring a backup also
  restores public passkey credentials and their access trust. Old binaries
  require a pre-upgrade backup to roll back.
- Merge reviewed preparation, verify CI and Security, then run the manual
  publication-free workflow on the exact main commit.
- Confirm npm trusted publisher fields: `alvintayzhenwei/kanban-lite`,
  workflow `publish.yml`, environment `npm`, direct publish allowed.
- Obtain release approval before pushing the new matching version tag. Verify the Publish npm run,
  registry version, provenance, and installed CLI before announcing publication.

The npm tarball includes the user guides and README images. Historical design
and acceptance records remain in the GitHub repository.
