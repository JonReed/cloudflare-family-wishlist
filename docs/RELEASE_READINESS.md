# First-release readiness

Evidence reviewed on 6 September 2026. This is a test record, not a release announcement. The package
is currently `0.1.0`; the final release version and tag have not been selected or published.

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

## Remaining release gates

- [x] Authorise Cloudflare's GitHub integration for only the private disposable installation repository,
      preserving existing access; connect the synthetic Worker with previews disabled.
- [x] Verify a bot-generated version-only commit triggers a real Cloudflare Build and deployment.
- [ ] Observe a real timer-triggered updater run; manual dispatch is not scheduler evidence.
- [x] Verify a failed Cloudflare build leaves the existing version live, then retry successfully and
      compare desired versus deployed SHA using the new version tag/status check.
- [x] Deploy the real generated application locally and apply its pending migration to disposable data.
- [x] Repeat the real generated-installer deployment through Cloudflare Builds.
- [ ] Complete [fresh-deployment acceptance](FRESH_DEPLOYMENT_ACCEPTANCE.md) from a clean account and
      checkout, including unrelated-email denial and the complete guide checklist without repairs.
      The earlier smoke test did not cover new-account payment/activation, the fork Builds path, or
      a complete clean rerun after guide corrections; it must not be labelled a full pass.
- [ ] Select the first version, align package/lockfile versions, review the final diff, and run both
      quality and dependency-audit gates on the exact release commit.
- [ ] Publish only with maintainer approval; observe successful promotion to `stable`, then verify
      delivery to an opted-in test installation.

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
