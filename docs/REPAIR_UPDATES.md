# Restore automatic updates for an existing household

The earlier setup connected some households to Cloudflare Builds but did not enable automatic
delivery of upstream releases. Other households deployed directly from a computer. The original
standard setup therefore required manual updates. A separate experimental installation-repository
updater existed; see [its migration notes](INSTALLATION_UPDATES.md) if you enabled that.

**Choose what you want:** keep control with [manual updates](MANUAL_UPDATES.md), or complete this
one-time setup to enable automatic updates. Publishing a new version alone cannot enable automatic
updates in an existing installation. Manual users do not need to opt in.

Keep your current Worker, D1 database, Access application, address and runtime secrets. This repair
connects future releases to those existing resources. It does not reinstall the household.

## 1. Keep your installation settings

Locate the project folder used during setup and confirm `.wishlist-installation.json` is there.
It contains the selected account, Worker and D1 identifiers. Keep a private copy of it.

**Done when:** you have those existing identifiers. If the file is missing, recover them from the
Worker's Cloudflare bindings or its `WISHLIST_INSTALLATION` build variable before proceeding.
Never create a replacement database because this file is missing.

## 2. Make a recovery point

Follow the [pre-upgrade backup instructions](BACKUP_RESTORE_UPGRADE.md). Keep the export private.

**Done when:** you have a recovery point for the current D1 database.

## 3. Find or create your GitHub copy

If your Worker is connected to GitHub, use the repository shown in **Worker → Settings → Builds**.
If you installed straight from this project's source, [create a fork](https://github.com/JonReed/cloudflare-family-wishlist/fork)
in your GitHub account, copying only `main`.

**Done when:** you have your own full application repository. If it contains only `updater.json`,
`app-version.json` and installer scripts, it is the older bootstrap installation; follow its
[migration notes](INSTALLATION_UPDATES.md) instead of using GitHub Sync fork.

## 4. Bring in the repair

For an existing application fork, select **Sync fork → Update branch** on its GitHub home page.
A newly created fork already contains the repair. Do not choose **Discard commits**. If GitHub reports
conflicts, preserve your changes and resolve them with an assistant before proceeding.

**Done when:** your repository contains `.github/workflows/update-household.yml` and
`scripts/update-fork.ts`. Connecting Builds alone does not enable upstream updates.

## 5. Connect and verify automatic updates

Complete [automatic update setup](AUTOMATIC_UPDATES.md) using the **existing** Worker and the saved
installation settings. Do not stop after enabling Actions: run it once and require the Cloudflare
build verification to pass.

**Done when:** the update workflow is green and you can still sign in and see your household's lists.

## If the updater reports custom changes

The updater deliberately stops before replacing household changes to application files or
`wrangler.jsonc`. An assistant should compare the fork with its upstream base, move account/Worker/D1
identifiers into the ignored installation settings and Cloudflare build variable, and preserve any
intentional application customisations for review. Do not use a hard reset or discard commits as a
generic fix. Normal household installs keep configuration outside tracked application source so
future releases can be applied without manual merges.

## Message for existing users

> We found a gap in the original setup: Cloudflare could deploy your repository, but it was not
> automatically receiving our new releases. We should have made that limitation clear. You can
> now choose [automatic updates](REPAIR_UPDATES.md) or follow the [manual update instructions](MANUAL_UPDATES.md)
> for each release. Both keep your existing site and family data. Automatic updates need a one-time
> setup; they are not switched on just because we publish a release.

Maintainer: link this page in release notes and send the notice through your existing support
channel. Users on old versions cannot see a new in-app notice until their app has been upgraded.
Do not claim every existing household is repaired merely because the upstream workflow passed.
