# Automatic installation updates

The updater has passed live GitHub Actions tests in disposable repositories. The installation
generator, pinned-source build, deployment guard and live-version checker are implemented. A generated
installation has built and deployed the real public application through Cloudflare Builds, including
a pending database migration. The complete scheduled-update-to-
Cloudflare-Builds path and independent-account installation still need verification; do not yet treat
this as a proven unattended installation. See [release readiness](RELEASE_READINESS.md) and
[UPDATER_TEST_RESULTS.md](UPDATER_TEST_RESULTS.md) for the evidence and remaining checks.

## Installation shape

Each household owns a small, preferably private installation repository. The application source stays
in the upstream public repository. The installation contains:

- `updater.json`: the upstream repository, selected `stable` or `main` channel, and an explicit
  `enabled` boolean;
- `app-version.json`: the exact upstream commit selected for the next build;
- installation-specific account, Worker and D1 configuration, separate from shared source;
- a small build bootstrap that fetches the pinned application commit and applies that installation's
  configuration; and
- a scheduled update workflow and the retained `scripts/check-upstream-update.ts` script.

The application now accepts account/Worker/D1 settings through `WISHLIST_INSTALLATION`, independently
of source. See [Installation settings](INSTALLATION_CONFIG.md). The build bootstrap supplies this JSON
rather than patching tracked `wrangler.jsonc`.

The updater fetches only the selected public branch, without supplying GitHub credentials to the
upstream fetch. If a newer descendant commit exists, it changes **only** `app-version.json` and pushes
that change with the installation repository's own `GITHUB_TOKEN`. It does not merge upstream source
or overwrite installation settings or workflow files. This avoids requiring every owner to maintain
merge conflicts or supply a personal GitHub token for ordinary application updates.

A configured Cloudflare build fetches that exact commit once, runs its build and release commands,
and deploy using that account's bindings and credentials. The version file represents the desired
version; it is not proof that deployment succeeded.

## Generate an installation repository

From an application checkout, with the supported Node.js version, run:

```sh
npm run installation:create -- /path/to/NEW_INSTALLATION_DIRECTORY FULL_UPSTREAM_COMMIT_SHA main
```

Use a real 40-character commit SHA, not the placeholder. The destination must not exist; the command
will not overwrite an existing repository. It creates local files only. Use `main` while testing;
choose `stable` after its first release exists, pinned to that release's commit.

Create a private GitHub repository from those files with `main` as its default branch. Complete the
D1, Access, runtime-secret and account prerequisites in [DEPLOYMENT.md](DEPLOYMENT.md); the generator
does not provision resources or send invitation email. Authorise Cloudflare's GitHub integration to
access the installation repository, then connect its `main` branch to the intended Worker with:

- build command: `npm run build`;
- deploy command: `npm run deploy` (**not** the application checkout's `deploy:production` command);
- build variable `NODE_VERSION`: the application's supported version (currently `24`);
- build variable: the complete `WISHLIST_INSTALLATION` JSON; and
- non-production/preview builds disabled.

Both channels use the installation repository's `main` branch. `updater.json` selects the **upstream**
channel; do not change the installation's production branch to `stable`.

The build fetches the exact public commit into a fresh ignored directory, installs its locked
dependencies and builds it. It omits deployment/repository token environment variables from those
child processes; this is not a sandbox for untrusted source. Installing a version means trusting its
code and dependencies. Only the deploy step receives the deployment environment. Deployment requires
a successful build receipt matching the current pin and installation settings, applies pending D1
migrations, and tags the Worker version with the full upstream SHA.

## Updater configuration

An installation's `updater.json` has this shape:

```json
{
  "repository": "JonReed/cloudflare-family-wishlist",
  "channel": "stable",
  "enabled": true
}
```

Its `app-version.json` must contain a real, full commit SHA from that upstream's history:

```json
{
  "commit": "REPLACE_WITH_A_FULL_UPSTREAM_COMMIT_SHA"
}
```

The placeholder intentionally fails validation. Run the following only in a prepared installation
repository, not in the application development checkout:

```sh
node scripts/check-upstream-update.ts --check
node scripts/check-upstream-update.ts --apply
```

`--check` fetches and reports the decision without changing the version file or pushing.
`--apply` requires a clean checkout, stages only the version file, and uses a normal push to the
installation's `main` branch. Concurrent remote changes reject the push; a fresh workflow run can
retry. Disabled or unchanged installations do not create commits. Missing upstream branches,
invalid settings, unrelated history and backward moves fail before changing the version file.

Both update channels use this mechanism. Moving from `main` to an older `stable` commit is refused;
wait for a stable release containing the current commit or review database compatibility and perform
an explicit operator-managed change. The updater does not roll back database migrations.

## Example installation workflow

This is a template for the installation repository, not a workflow to enable in the upstream
application repository. Copy the retained updater script into the installation alongside it.

```yaml
name: Check upstream updates
on:
  workflow_dispatch:
  schedule:
    - cron: '23 */6 * * *'
permissions:
  contents: write
concurrency:
  group: automatic-updates
  cancel-in-progress: false
jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: main
          fetch-depth: 0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: '24'
      - run: node scripts/check-upstream-update.ts --apply
```

The job executes the local updater without installing application dependencies or executing fetched
application code with its repository write token. It needs no Cloudflare secret. The public source
repository is fetched independently from the authenticated installation checkout.

Prefer a private installation repository: GitHub disables scheduled workflows in **public**
repositories after 60 days without repository activity. Schedules can also be delayed or dropped under
load, so this is periodic update checking, not an immediate release notification guarantee. Provide a
manual **Run workflow** option and retain normal failure notifications. See
[GitHub's scheduling rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Verify delivery and retry failures

A green updater job means the desired pin was checked or changed, not that Cloudflare deployed it.
Check Cloudflare Builds for that installation commit, then compare the live Worker version's tag with
the full SHA in `app-version.json`. From an authenticated application operations checkout configured
for that installation, this read-only command performs the comparison:

```sh
npm run installation:status -- FULL_DESIRED_UPSTREAM_COMMIT_SHA
```

It succeeds only when every traffic-bearing version is tagged with the desired SHA. Missing tags,
older versions, mixed traffic or unreadable status do not produce a false success. Older application
versions without release tagging cannot be verified this way. Retain the normal application and
`setup:check` acceptance checks: a matching version tag is not an application health check.

After a failed build or deploy, correct the reported cause and retry the failed build in Cloudflare.
Re-running the GitHub updater with an unchanged pin intentionally does not create another commit.
There are no unlimited retries. Pending migrations run again safely, but SQL that already succeeded
is **not** rolled back automatically; review compatibility before manually selecting an older version.

## Installer maintenance

`installer-version.json` identifies installer protocol 1. Application updates deliberately do not
overwrite installation scripts, workflow or configuration. Installer fixes are a separate, documented
operator update: generate a fresh installation in an empty temporary directory using the corrected
application tooling, compare the scripts/workflow and apply the compatible changes. Preserve the
existing `updater.json`, pin and household settings. Release notes must explicitly call out required
installer fixes. This limitation is preferable to silently executing fetched code with repository
write permission; ordinary application updates remain automatic once the delivery path is connected.

## Experimental updater: remaining verification

The core application's first release does not certify unattended upstream updates. These checks
remain required before presenting this optional updater as fully verified; they do not negate the
completed household installation walkthroughs. See [release scope](RELEASE_READINESS.md#first-release-scope).

The bot-push-to-Builds connection, live-version comparison and failed-build retry now pass in the
synthetic fixture. The generated real-application installer also passed both local deployment and
Cloudflare Builds with pending migration 0012 and fictional data. These are distinct checks, not a
full acceptance pass.

1. Observe an actual scheduled run, not only manual dispatch of the same job.
2. Complete isolated-account Access and fresh-install acceptance, including an authenticated upgrade
   on the exact release candidate.

The upstream `stable` promotion workflow remains useful independently of this delivery mechanism.
Fork owners who modify the application can disable the managed updater and maintain their own code.
