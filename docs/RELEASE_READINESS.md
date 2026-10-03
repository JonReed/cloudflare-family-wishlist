# First-release readiness

Evidence reconciled on 7 September 2026. The maintainer selected `v1.0.0` and authorised publication;
package and lockfile versions are aligned at `1.0.0`. This is the pre-publication evidence record,
not proof of successful promotion. See the [release](https://github.com/JonReed/cloudflare-family-wishlist/releases/tag/v1.0.0)
and its **Release to stable** workflow for publication and promotion results.

## Completed evidence

| Check                                                 | Result and scope                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing-account installation smoke test, 5 September | Organiser and invited member signed in; a wish added before first login remained on the same list; public sharing and revocation worked; purchasing retained the wish and confirmed removal emptied it. Setup checks ran with and without Access variables. Disposable resources were removed.                                        |
| Version-only updater                                  | Live GitHub Actions runs verified channel selection, bot pin commits, disabled/no-op behaviour and rejection of backwards moves. See [the experiment record](UPDATER_TEST_RESULTS.md).                                                                                                                                                |
| Generated installation build, 6 September             | A clean generated installation fetched public application commit `a30e04a22fabdc350e62f0c5c44aa8a0bab1c63f`, installed locked dependencies and built successfully using synthetic installation settings. No Worker was deployed. This tests the bootstrap against published source, not deployment of the unreleased tagging changes. |
| Portable database recovery, 6 September               | Applied all 12 migrations to an empty disposable D1 database; seeded fictional members, a wishlist, a wish and a purchased claim; exported SQL and imported it into a second empty database. All expected records and migration history were recovered.                                                                               |
| D1 Time Travel recovery, 6 September                  | Captured a bookmark, deliberately deleted the synthetic wish, verified its absence, then restored to that bookmark. The wish and its purchased claim returned.                                                                                                                                                                        |
| Recovery integrity and cleanup                        | Both restored databases had 2 members, 1 wishlist, 1 wish, 1 purchased claim and 12 migration records. SQLite quick checks returned `ok`, foreign-key checks returned no violations. Both disposable databases were deleted and their absence verified. Production data was neither exported nor changed.                             |

Recovery proves the database operations, not automatic application rollback or restoration of Access,
Worker secrets or DNS. Keep those operational settings separately and follow
[the recovery runbook](BACKUP_RESTORE_UPGRADE.md).

The local bootstrap checks also verified that an existing destination is not overwritten, changed
account settings prevent deployment of the previous build, and a failed source fetch invalidates the
previous successful build receipt. No deployment was attempted in these negative checks. The current
working-tree quality gate passes 409 tests, formatting, linting, type checks, native-script imports
and the production build; the dependency audit reports no vulnerabilities. Repeat both gates on the
final release commit.

A separate local Git experiment also exercised the real promotion commands against disposable bare
repositories: eligibility checking, first creation of `stable`, a no-op rerun, a forward release and
refusal to move backwards all passed. This does not replace observing GitHub's release event,
workflow permissions or a real tagged release; no remote GitHub repository was changed by this check.

## First-release scope

On 7 September the maintainer confirmed that the repeated installation walkthroughs already carried
out are sufficient installation evidence for the first core-product release. The existing-account
family flows, separate generated-installation builds and live migration/recovery checks above are
completed evidence, not an untested installation path. No further full installation rerun is required
solely because the stricter clean-account checklist was left open.

This acceptance does not turn unobserved checks into passes: a complete new-account onboarding run
without repairs, every assertion in the strict acceptance procedure on one final commit, and an
actual timer-triggered updater event have not been recorded. The version-pin updater remains
experimental; fully unattended upstream delivery is outside the first release's verified scope.
The core application and normal deployment of changes in a connected repository are distinct from
that optional updater. Keep these limits in the release notes.

## Release checklist

- [x] Authorise Cloudflare's GitHub integration for only the private disposable installation repository,
      preserving existing access; connect the synthetic Worker with previews disabled.
- [x] Verify a bot-generated version-only commit triggers a real Cloudflare Build and deployment.
- [x] Verify a failed Cloudflare build leaves the existing version live, then retry successfully and
      compare desired versus deployed SHA using the new version tag/status check.
- [x] Deploy the real generated application locally and apply its pending migration to disposable data.
- [x] Repeat the real generated-installer deployment through Cloudflare Builds.
- [x] Accept the completed installation walkthroughs and live upgrade evidence for the first
      core-product release, with the scope and limitations above recorded.
- [ ] Select the first version, align package/lockfile versions, review the final diff, and run both
      quality and dependency-audit gates on the exact release commit.
- [ ] Publish only with maintainer approval; observe successful promotion to `stable`, then verify
      delivery to an opted-in test installation.

## Follow-up verification, not core-release blockers

- [ ] Observe a real timer-triggered updater run; manual dispatch is not scheduler evidence.
- [ ] Complete the stricter [fresh-deployment acceptance](FRESH_DEPLOYMENT_ACCEPTANCE.md) from a
      brand-new account and checkout, recording all assertions without repairs. Preserve this as a
      future repeatable test; do not describe it as completed by the existing-account walkthroughs.

The disposable Git connection was switched from the synthetic Worker to the real-application Worker
with explicit maintainer approval. Account sign-in and payment verification remain owner-assisted
steps. GitHub access was extended only to the private test repository, without widening it to all
repositories. See the experiment record for current cleanup status.

## Real application upgrade check

The current generated installer fetched and built public commit
`a30e04a22fabdc350e62f0c5c44aa8a0bab1c63f`, then its normal deploy command applied the pending twelfth
migration before deploying a separate disposable Worker. The database started with migrations 1–11,
two fictional members, one wishlist, one wish, one purchased claim and one completed invitation.
After deployment it had 12 migration records, three members, two wishlists, the original wish and
purchased claim, and first-sign-in timestamps on only the two pre-existing members. Quick and
foreign-key checks passed. Without Access configuration the deployed application returned the
expected `503`, exposing no family data. This is not an authenticated end-to-end acceptance test.

An account pre-check stopped the first deployment attempt before any mutation: the temporary macOS
directory was bound as `/tmp/...` while Node resolved it to `/private/tmp/...`, so Wrangler selected
a different default identity. Binding the canonical directory and repeating the identity check
resolved it. The installation guide now documents this pitfall.

The same upgrade then passed through Cloudflare Builds, using the generated installer in the private
test installation repository. Build `7096daa9-76e0-4ad9-9b96-e154d9e21bc1` fetched the exact public
application pin, applied only migration 0012 and deployed Worker version
`325ad308-1adf-45bb-aaca-5b3c0b02f28b` to 100% of traffic. The before/after record counts and integrity
checks matched the local experiment, and the unauthenticated response remained the expected `503`.
Build settings were `npm run build` / `npm run deploy`, `NODE_VERSION=24`, the disposable installation
JSON and preview builds disabled. No build-token permissions or production resources were changed.

The test uses published source predating the new optional SHA tag support; the synthetic Worker
separately proves tagging and live-version comparison. Testing the unreleased installer against
published application source is not the same as certifying an exact first-release candidate.

## Manual and automatic fork updates — 3 October 2026

The normal setup now includes the application fork's **Update Family Wishlist** workflow and a
one-time update setup for existing users. Real-Git local integration tests exercise repeated stable
updates, household workflow/configuration preservation, downgrade prevention, customisation refusal,
concurrent pushes and a 28-day activity commit. Cloudflare check classification tests distinguish
missing, pending, failed and successful builds, including a successful retry of an earlier failure.

The historical bootstrap evidence above belongs to a different delivery implementation. It must not
be used to claim that the new fork workflow's scheduled delivery has passed. A disposable household
must still demonstrate a scheduled run, release delivery, deployment failure and recovery before
that claim can be made. See [fresh-deployment acceptance](FRESH_DEPLOYMENT_ACCEPTANCE.md).

### Live fork delivery check — v1.1.1 candidate

On 3 October, a disposable household repository and a separate Worker/D1 database exercised
candidate `0d79dd413e63a1b808c06282541f4b7a5cf8d789`. The household started at `v1.1.0` with
12 migrations, two fictional members, two lists, one wish and one purchased claim.

| Check                           | Observed result                                                                                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline deployment             | Cloudflare build `90c2896d-f42d-4733-90fa-92e2315e058f` deployed v1.1.0 successfully.                                                                                                                                                                                                         |
| Manual release update           | GitHub run `37127907430` copied the candidate and Cloudflare build `42c49a27-d19a-476e-9c96-08dea427309a` deployed it. A separate unreleased change on source `main` was excluded; household workflows were preserved.                                                                        |
| Migration and data preservation | Build applied migration 0013. Every seeded row matched its pre-update value; SQLite quick check returned `ok` and foreign-key check returned no violations.                                                                                                                                   |
| Failed build                    | An intentionally failing build command on the disposable Worker caused Cloudflare build `8f3fdb27-f95d-4394-bd1a-67a112877219` and GitHub run `37128189072` to fail. The updater reported that the update was incomplete. The previous Worker version and all database rows stayed unchanged. |
| Retry                           | Restoring `npm run build` and running the same update workflow again succeeded: GitHub run `37128320062`, Cloudflare build `c6ce3b06-98c5-406d-8f81-5bd22a32965d`. Data and integrity checks still matched.                                                                                   |
| Scheduled delivery              | Passed on 3 October: genuine schedule run `37146969466` installed a published test release and Cloudflare build `4f87c48f-9348-475a-88bb-ad909609169b` deployed it. See the detailed record below.                                                                                            |

The fixture uses the candidate's updater and build-verification scripts unchanged, with a wrapper
selecting a disposable upstream repository. The initial timer used five-minute intervals; the corrected native-scheduler test uses
ten-minute intervals, while the shipped workflow checks every six hours. These differences allow controlled releases without publishing an
untested application release. The tests use synthetic data and the application's normal fail-closed
response without Access configuration; they do not repeat authenticated family workflows or new-account
onboarding. Production Cloudflare resources were not changed by this test.

The scheduled-delivery result is recorded below. Repeat the repository gates on the final release
commit before publication.

### Scheduler correction, 3 October 2026

The unverified Cloudflare-timer experiment was removed before release. Automatic updates again use
GitHub's native `schedule` event and the same workflow as manual updates. No additional GitHub key
is required. The Worker configuration explicitly clears the experimental cron on the next normal
deployment; merely omitting it would leave the old timer registered.

The independent scheduler diagnostic had been disabled after only a short observation window, so
it did not establish that GitHub's scheduler was broken. The original missing scheduled run remains
unexplained. The corrected live test keeps the real update workflow enabled and distinguishes a
real `schedule` event from manual dispatch. The later passing result is recorded below.

The corrected implementation passed all 557 application tests and eight updater integration tests,
formatting, lint, type checks, script checks and production build; the dependency audit found no
vulnerabilities. Commit `a1753e02e959a3d467a7605c6aceb482f5583e5d` passed reference CI and its normal
Cloudflare Build. The reference Worker settings confirmed that no cron triggers remained.

The disposable household's corrected manual run `37135784253` succeeded. Cloudflare build
`a6af9868-1800-4fa8-829e-44d62faee944` deployed version
`7f82c1ef-6fec-478e-a03d-9b6f214a078f` to 100% of traffic. All seeded rows and 13 migration records
matched the previous snapshot; integrity checks passed.

A real `v1.1.1` release was then published **only in the disposable source repository**.
Its **Release to stable** run `37136487286` passed the same quality and audit gates as this project
and promoted `stable` to the exact tagged commit `247835bc8d254623a6c0fa653c2aa1cae715f384`.
The household fixture was left for the genuine scheduled-delivery acceptance check rather than
being manually updated to that release. At 16:23 UTC, neither the household nor the separate public
scheduler diagnostic had received a `schedule` event. The project release was kept as a draft while
that check remained outstanding.

### Verified native scheduled delivery, 3 October 2026

The disposable source published test release `v1.1.2` with a distinct application version. Its
[release gate](https://github.com/JonReed/wishlist-release-test-source-20261003/actions/runs/37142793083)
passed and promoted `stable` to the exact tag commit `da0608338759c85aa90ebdc53ef85b3160c405d5`.
This version number belongs only to the fixture; the project release candidate remains `v1.1.1`.

At 19:11:02 UTC, [household run 37146969466](https://github.com/JonReed/wishlist-release-test-household-20261003/actions/runs/37146969466)
started with GitHub's actual `event=schedule`. No manual dispatch triggered it. The household schedule
had remained unchanged since 15:56:55 UTC and no manual household update had run since 16:09 UTC.
The independent public diagnostic received its first scheduled event at 19:10:18 UTC.

| Assertion                      | Result                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Released source selected       | Updater reported `updated` from exact source `da0608338759c85aa90ebdc53ef85b3160c405d5`.                                                 |
| Household version advanced     | Deployment commit `8a8d44da0f669453c7b4e3a0490c32856b9b0ae6` contains package version `1.1.2`, replacing `1.1.1`.                        |
| Cloudflare deployment verified | Build `4f87c48f-9348-475a-88bb-ad909609169b` succeeded for that exact household commit.                                                  |
| New version serving            | Worker version `ebe42cc2-9300-4166-b966-79dde629cbfa` received 100% of traffic at 19:12:03 UTC, replacing the captured baseline version. |
| Database preserved             | All seeded members, lists, wishes, claims and 13 migration records matched the previous snapshot exactly.                                |
| Integrity preserved            | SQLite quick check returned `ok`; foreign-key check returned no violations.                                                              |

The first event arrived about three hours fourteen minutes after the native schedule was restored.
No intervening household configuration repair caused it to start. The observations establish delayed
event delivery; they do not identify GitHub's internal cause or guarantee punctual future runs.
Automatic release delivery has now passed the live check. The test still uses synthetic data and
fail-closed unauthenticated responses; it does not replace the earlier authenticated-family tests or
claim a fresh-account onboarding walkthrough.
