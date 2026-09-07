# Release channels

Family Wishlist has two channels:

| Channel  | Intended use                                                | When it changes                                       |
| -------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| `stable` | Recommended for family installations                        | A published stable release passes both required gates |
| `main`   | Reference installation and people opting into early updates | Normal development pushes                             |

A release tag such as `v1.0.0` identifies a fixed commit. `stable` points to the latest successfully
promoted release commit. Work continues directly on `main`; `stable` is only a release pointer and
must not receive independent changes. Fork owners are responsible for their own releases and updates.

## Publish a release

1. Merge or commit the intended work on `main` and run `npm run quality` and `npm run audit` before
   pushing, as usual. Check the reference installation and complete the
   [release-readiness checklist](RELEASE_READINESS.md) before the first release. The maintainer has
   accepted the completed installation walkthroughs for the core release; the stricter
   [fresh-account procedure](FRESH_DEPLOYMENT_ACCEPTANCE.md) remains follow-up verification.
2. Set `package.json` and both package version entries in `package-lock.json` to the intended release
   version, commit them, and rerun the gates. The promotion script rejects a tag whose version differs
   from either file. In GitHub, prepare release notes explaining changes, migrations, installer fixes
   and any operator action. Use the [v1.0.0 notes](releases/v1.0.0.md) as a structural reference. Choose
   the exact tested commit on `main` and a new tag named `vMAJOR.MINOR.PATCH`, for example `v1.0.0`.
3. Publish the release as a normal release. Drafts and prereleases do not advance `stable`.
4. Watch **Actions → Release to stable**. The workflow checks out the release commit, verifies that
   its tag still matches and that it belongs to `main`, then runs `npm ci`, `npm run quality` and
   `npm run audit`.
5. Only after those gates pass, a separate job with repository write permission checks the target
   again and pushes that exact commit to `stable`. The first successful release creates the branch.
   No Cloudflare credentials are held by this workflow.
6. Verify the `stable` commit and the resulting deployment in each connected installation. Publishing
   a GitHub release is not itself confirmation that promotion or a Cloudflare deployment succeeded.

Release workflows are serialised. Promotion uses an ordinary, non-forced push: an older release or
divergent history cannot replace a newer `stable` commit. Re-running the current release is a no-op.
A changed tag, failed gate, unavailable repository or rejected branch update fails the workflow;
`stable` is not forcibly moved. Keep published tags immutable and publish fixes as new releases.

The workflow requires GitHub Actions to be enabled and its promotion job to have `contents: write`.
Repository rules for `stable` must permit this workflow's update. If a rule blocks it, resolve the
intended rule configuration and rerun the failed workflow; do not force-push around it. The promotion
job does not install dependencies or run the application with its write token.

CI also covers ordinary pushes to `main` and `stable`. GitHub does not start additional push workflows
for changes made with `GITHUB_TOKEN`, so the release workflow runs the full gates itself before
promotion rather than relying on a second CI run.

## Select a channel in Cloudflare

For a repository you can authorise through Cloudflare's GitHub integration, select the existing
Worker's **Settings → Builds** and set the production branch to `stable`, or `main` for early updates.
Keep build command `npm run build` and deploy command `npm run deploy:production`. Disable
non-production builds unless they have separate resources and credentials.

The channel chooses application code and migrations. Every installation still needs its own account,
D1 database, Access configuration and scoped credentials. Production deployment applies pending
migrations before deploying the Worker. Migrations must remain compatible with the previous Worker;
a failed Worker deployment does not roll back successful database migrations. Switching from `main`
back to an older stable version therefore requires a compatibility check, not just a branch change.

## Independent-account delivery remains a separate step

Cloudflare's standard Git integration connects repositories authorised through the installer's
GitHub account or organisation. Reading a public repository is not equivalent to authorising that
integration. Do not promise that an unrelated household can simply choose this upstream repository
in its own Cloudflare account. A fork also does not follow upstream branch changes automatically.

This release workflow establishes the shared `stable` channel. The [version-pin updater and installation
bootstrap](INSTALLATION_UPDATES.md) have passed live GitHub delivery, synthetic bot-triggered Cloudflare
deployments, and a real-application Cloudflare build with a pending migration. A genuine scheduled
updater event has not yet been observed. Before offering automatic updates to
independent households without fork maintenance, we still need to verify:

- delivery of upstream channel changes into each installation's build;
- a clean installation and upgrade acceptance run in an independent account.

The small installation scripts use protocol 1 and receive separately documented operator-applied
fixes; application updates do not replace them. See the [release-readiness record](RELEASE_READINESS.md)
for checked and outstanding gates. No `stable` branch or release should be described as available
until the first promotion has actually succeeded.

Account/Worker/D1 configuration is now separate from shared source through
[Installation settings](INSTALLATION_CONFIG.md). Existing Builds must receive their installation
JSON before adopting that change; this does not yet complete automatic upstream delivery.

The existing [installation guide](DEPLOYMENT.md) remains a self-managed fork route while that work is
completed. Users who choose a fork own its synchronisation and customisations.

## Sources

- [Cloudflare build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/)
- [Cloudflare GitHub integration and account access](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [GitHub release workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release)
- [GitHub workflow token event behaviour](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
