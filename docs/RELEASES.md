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
   from either file. Update the [family user guide](USER_GUIDE.md) for changed workflows and the
   [security record](SECURITY_REVIEW.md) with the exact reviewed range and verification limits.
   The brochure website links to these records on `stable` and to GitHub's latest release; it does not
   need a rebuild just to update release evidence. Material product/privacy changes still need a
   brochure review. In GitHub, prepare release notes explaining changes, migrations, installer fixes
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

## Delivery to household installations

Publishing a stable release advances `stable` only after the release gates pass. Households choose
automatic or manual updates. Automatic mode uses the existing Worker’s Cloudflare Cron Trigger
every six hours to dispatch **Update Family Wishlist**, with a fine-grained GitHub key limited to
Actions read/write on the household repository. `WISHLIST_AUTO_UPDATE=true` allows those automatic
requests. The workflow has no GitHub schedule; manual users dispatch it themselves. It copies the stable application
snapshot into a normal commit on its own `main`, leaving `.github/` and ignored household settings
alone. It records the upstream SHA in `.wishlist-upstream.json`. Cloudflare Builds deploys that
household commit with `npm run deploy:production` and the updater verifies Cloudflare's check result.

The updater refuses downgrades, unrelated history, dirty checkouts and application customisations.
It uses a normal push so concurrent owner commits are never force-overwritten. Older installations made from `main`
can be ahead of stable: it waits for the next descendant release. A small activity commit after 28
days without commits keeps public forks active; it also exercises the deployment connection.

Follow [AUTOMATIC_UPDATES.md](AUTOMATIC_UPDATES.md) for setup and
[UPDATES.md](UPDATES.md) for existing users choosing their update option. The old separate
bootstrap repository has [migration instructions](INSTALLATION_UPDATES.md). Both GitHub update modes use the same
fork workflow. [Manual updates](MANUAL_UPDATES.md) also document direct terminal deployments.
Do not add an app deployment button or a second scheduler.

Application source updates include the updater scripts, but `.github/` stays owned by the household.
Keep the workflow/script interface backwards-compatible. A future change to workflow permissions or
steps needs an explicit update setup step and release note; ordinary releases must not depend on it.
In particular, forks with the first schedule-only workflow need to update that workflow before the
`WISHLIST_AUTO_UPDATE` variable can control it; disable the old workflow to stop unattended runs
until the workflow is updated. The current workflow defaults to manual mode when the variable is absent.

### Verification status

Local real-Git integration tests cover repeated releases, preserved workflows/settings, installations
ahead of stable, customisation conflicts, dirty/invalid states, concurrent pushes and the inactivity
keepalive. Cloudflare build result classification is tested separately. Earlier bootstrap tests proved
that a GitHub bot push can trigger Cloudflare Builds, but they do not prove this fork workflow's
Cloudflare-timer end-to-end path. Observe that path on a disposable household installation before claiming
unattended delivery has passed. Failed builds must remain visible on subsequent updater runs.
