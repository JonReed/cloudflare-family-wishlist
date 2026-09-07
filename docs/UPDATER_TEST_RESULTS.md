# Automatic updater experiment — 6 September 2026

The GitHub delivery portion works with an ordinary repository-scoped `GITHUB_TOKEN`: the updater can
read a public upstream branch and commit only the desired version into a separate private
installation repository. A real Cloudflare Builds connection now also confirms that those bot
commits trigger deployment, that a failed build preserves the live version, and that retrying the
same commit after correcting the build configuration succeeds.

This does **not** yet prove the complete scheduled-update-to-Cloudflare-Builds path. The intended
Cloudflare dashboard session was initially unavailable and the existing Wrangler OAuth login returned
`403` for the Builds configuration API. The later dashboard session and narrowly scoped GitHub app
access resolved the connection blocker. The scheduler itself has not yet been observed firing.
No reference-deployment settings were changed by this experiment.

## Test setup

Two disposable GitHub repositories in the maintainer's account represented a public upstream and a
private household installation. The fixture application was a tiny Worker returning a synthetic
version label and an installation-specific marker. It used no family records, D1 data, Access tokens,
or private application source. A separate disposable Worker was deployed using the verified personal
Wrangler profile.

The installation workflow used `contents: write` and its normal `GITHUB_TOKEN`. No personal GitHub
token or Cloudflare token was stored in the fixture repository. The maintained updater implementation
is [check-upstream-update.ts](../scripts/check-upstream-update.ts), with local regression coverage in
[check-upstream-update.test.ts](../test/check-upstream-update.test.ts).

## Results

| Scenario                                           | Observed result                                                                                                                          | Evidence                                                                                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unchanged upstream                                 | Passed; no version commit                                                                                                                | GitHub run `33999590548`                                                                                                                                                       |
| `main` changes while installation follows `stable` | Passed; pin remained at stable version 1                                                                                                 | GitHub run `33999654434`                                                                                                                                                       |
| Upstream advances `stable`                         | Passed; bot committed only `app-version.json`                                                                                            | GitHub run `33999755644`; installation commit `0301d869e520132751b94b7aa8a5c70a3882d236`                                                                                       |
| Installation opts into `main`                      | Passed; pin advanced to main version 3                                                                                                   | GitHub run `33999840131`                                                                                                                                                       |
| Switch back to older `stable`                      | Passed; updater failed as intended and kept the version 3 pin                                                                            | GitHub run `33999900473`                                                                                                                                                       |
| Updates disabled                                   | Passed; updater succeeded without changing the pin                                                                                       | GitHub run `33999932923`                                                                                                                                                       |
| Intentionally broken application delivered         | Pin update succeeded; the subsequent local build/deploy sequence stopped before deployment                                               | GitHub run `33999996066` and local build output                                                                                                                                |
| Previous live version after broken build           | Passed; Worker still returned `main-3` and the original household marker                                                                 | Direct HTTP response from disposable Worker                                                                                                                                    |
| Retained TypeScript updater in GitHub Actions      | Passed; exact project script advanced the repaired release pin using the bot token                                                       | GitHub run `34000268523`                                                                                                                                                       |
| Actual timer-triggered run                         | Not yet observed                                                                                                                         | No scheduled run was observed during the test window; manual dispatch results are not counted as scheduler verification                                                        |
| Bot push triggers Cloudflare Builds                | Passed; bot changed only the pin, then Cloudflare deployed that exact source SHA                                                         | GitHub run `34024113089`, installation commit `1411924dc464d710a1ea3b76bc41a36ced0ff338`, Cloudflare build `f0f49795-3003-49d6-8746-2ca0dc432363`                              |
| Actual Cloudflare build failure                    | Passed; intentional `npm run build && false` stopped deployment and kept version 6 live                                                  | GitHub run `34024212793`, Cloudflare build `d0e95550-9e98-4aca-83ef-300a881b48b9`                                                                                              |
| Desired versus live after failure                  | Passed; checker returned `current: false`, all traffic remained on `c97a5a9da79bb869089bbfe86d33aac3d1dc70f5`                            | Read-only deployment/version API responses through Wrangler and the retained comparison helper                                                                                 |
| Retry the same installation commit                 | Passed after saving and reloading the corrected build command; pin commit unchanged                                                      | Installation commit `a6e2437da9024dcd969f8e2e9975a4035169305d`, Cloudflare retry build `207301e9`                                                                              |
| Desired versus live after retry                    | Passed; checker returned `current: true`, 100% of traffic tagged `3977d828282368a667fb2c427dbcd2a484bcba00`                              | Worker version `dd524195-aab6-44ee-b1d7-f98eeb082541`; HTTP returned `stable-7-retry-check` and the unchanged household marker                                                 |
| Generated real-app installer in Cloudflare Builds  | Passed; pinned public application built, migration 0012 applied before deployment, existing fictional wish and purchased claim preserved | Installation commit `4c1d548a1c94c76ead7dda45fb1458d6382d85b4`; Cloudflare build `7096daa9-76e0-4ad9-9b96-e154d9e21bc1`; Worker version `325ad308-1adf-45bb-aaca-5b3c0b02f28b` |

The first cases used the initial JavaScript prototype. The retained TypeScript implementation was
then installed in the fixture and run successfully against the repaired stable release. Its regression
tests additionally cover malformed settings, failed fetches, disabled/no-op updates, backward or
unrelated history, dirty local checkouts and rejected concurrent pushes.

The upstream also contained its own workflow file. The version-only design left that in the upstream
source checkout rather than changing the installation's workflow. The bot's update commits contained
only the pin file. The installation-specific marker survived the separately exercised live upgrade.

The original Worker deployments were invoked locally. The later version 6 and 7 checks used real
Cloudflare Builds, including a deliberate build-command failure rather than broken application code.
The first attempt to restore the command had not persisted; a second failed retry exposed that, and
the successful retry followed a saved, reloaded configuration check. This reinforces verifying saved
settings before retrying. The synthetic fixture has no database, so it does not establish migration
rollback. A separate real-application installer/migration test is recorded in
[release readiness](RELEASE_READINESS.md).

## Implications

Use a small installation repository with a pinned upstream commit and separate household settings.
Avoid treating an updater commit as proof of deployment. A failed build leaves the desired pin ahead
of the live Worker. The retained build bootstrap, SHA tagging and status checker now implement that
distinction. The live comparison, Cloudflare retry path and generated real-application build/migration
integration now have test evidence. Scheduler observation and clean-account acceptance remain
separate checks for the experimental updater, not a requirement to repeat the accepted core-product
installation walkthroughs; see [release scope](RELEASE_READINESS.md#first-release-scope).
The real-app fixture uses published source predating optional SHA tagging; the
synthetic fixture proves that separately, not as an exact first-release candidate.

Keep scheduled installation repositories private to avoid GitHub's public-repository inactivity
expiry. Scheduling is best-effort and can be delayed; see
[GitHub's schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
The broader installation plan is in [INSTALLATION_UPDATES.md](INSTALLATION_UPDATES.md).

## Cleanup

After the approved connection switch and successful real-app build, both disposable Workers and the
real-app test database were deleted. Only fictional test data was removed. This evidence remains;
temporary local fixture checkouts are no longer available. Production was not changed.

On 7 September 2026, both disposable GitHub repositories were deleted through an authenticated owner
session: `JonReed/wishlist-updater-test-install-20260906` and
`JonReed/wishlist-updater-test-upstream-20260906`. No extra CLI credential scope was requested, and no
test workflow remains scheduled. Only synthetic fixtures were removed; the results are preserved here,
but historical run and resource identifiers may no longer resolve after cleanup. The timer was enabled
during active checks but no `schedule` event was observed. A later scheduler check needs a fresh
disposable fixture.
