# Choose how to update

Choose when new releases are installed in your existing family wishlist:

| Option                | What happens                                                                    | Instructions                                     |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Manual updates**    | You start each update when you are ready.                                       | [Update manually](MANUAL_UPDATES.md)             |
| **Automatic updates** | After you opt in, your installation checks for tested releases every six hours. | [Set up automatic updates](AUTOMATIC_UPDATES.md) |

Both options keep your current Worker, database, sign-in settings and website address. You can
change your choice later. Automatic updates are off until you explicitly enable them.

## Already using the app?

The original standard setup used manual updates. You can continue with the
[manual update guide](MANUAL_UPDATES.md), or choose automatic updates. A separate experimental
updater was available; if you enabled it, use [its migration instructions](INSTALLATION_UPDATES.md).

If your GitHub copy already contains `.github/workflows/update-household.yml` with the
`WISHLIST_AUTO_UPDATE` setting, go straight to your chosen guide above. Otherwise, follow steps 1–4
below to add the current update tools, then step 5 for your chosen option. These preparation steps
apply to automatic updates and manual updates through GitHub. Manual updates from your computer
use [their own instructions](MANUAL_UPDATES.md#manual-updates-from-your-computer).

## 1. Keep your installation settings

Open a terminal in the project folder used during setup. Use PowerShell or Command Prompt on
Windows, Terminal on macOS, or your Linux terminal. Paste this command to create a dated backup
beside the project folder:

```sh
node -e "const fs=require('node:fs'); const p='../wishlist-installation-backup-'+Date.now()+'.json'; fs.writeFileSync(p,fs.readFileSync('.wishlist-installation.json'),{flag:'wx',mode:0o600}); console.log('Saved '+p)"
```

It copies only the saved account, Worker and database identifiers; it does not change Cloudflare.

**Done when:** the command prints `Saved` and the backup filename. Keep that file private. If it
reports `ENOENT`, first check that you are in the original project folder. If the settings are lost,
open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages), select your
existing Worker, then **Settings → Builds → Variables and secrets**. Recover the complete
`WISHLIST_INSTALLATION` value into `.wishlist-installation.json` in your project folder. If there is
no saved build variable either, stop and have an assistant recover the existing IDs from the Worker
and its D1 binding. Never create a replacement database because this file is missing.

## 2. Make a recovery point

In the same project folder, run:

```sh
npm run installation:wrangler -- d1 time-travel info DB
```

**Done when:** you have copied the recovery bookmark and current UTC time into a private note. If
an old Windows script fails, open [Cloudflare D1](https://dash.cloudflare.com/?to=/:account/workers/d1),
select the exact database from your saved settings and open **Time Travel**. Record its database ID
and current UTC time; do not click **Restore**. Stop if you cannot identify the correct database.
A portable SQL export is also available in [the backup guide](BACKUP_RESTORE_UPGRADE.md#create-a-recovery-point).

## 3. Find or create your GitHub copy

Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages), select your
existing Worker and open **Settings → Builds**. If a GitHub repository is listed, follow its link
and keep that repository tab open.
If you installed straight from this project's source, [create a fork](https://github.com/JonReed/cloudflare-family-wishlist/fork)
in your GitHub account, copying only `main`.

**Done when:** you have your own full application repository. If it contains only `updater.json`,
`app-version.json` and installer scripts, it is the older bootstrap installation; follow its
[migration notes](INSTALLATION_UPDATES.md) instead of using GitHub Sync fork.

## 4. Add the current update tools

For an existing application fork, select **Sync fork → Update branch** on its GitHub home page.
A newly created fork already contains these tools. Do not choose **Discard commits**. If GitHub reports
conflicts, preserve your changes and resolve them with an assistant before proceeding.

**Done when:** your repository contains `.github/workflows/update-household.yml` and
`scripts/update-fork.ts`. Connecting Builds alone does not enable upstream updates.

## 5. Set up your chosen option

- **Automatic:** follow [automatic update setup](AUTOMATIC_UPDATES.md#1-open-your-existing-worker),
  including the step that enables the schedule.
- **Manual through GitHub:** follow [manual update setup](MANUAL_UPDATES.md#one-time-setup),
  leaving the automatic schedule off.

Use the **existing** Worker and saved installation settings. Run the workflow once and wait for its
Cloudflare build check to pass.

**Done when:** the update workflow is green and you can still sign in and see your household's lists.

## If the updater reports custom changes

The updater deliberately stops before replacing household changes to application files or
`wrangler.jsonc`. An assistant should compare the fork with its upstream base, move account/Worker/D1
identifiers into the ignored installation settings and Cloudflare build variable, and preserve any
intentional application customisations for review. Do not use a hard reset or discard commits as a
generic fix. Normal household installs keep configuration outside tracked application source so
future releases can be applied without manual merges.

## Message for existing users

> You can choose how your Family Wishlist receives new versions: update manually when you are
> ready, or opt in to automatic updates. The original standard setup used manual updates. Follow
> [the update guide](UPDATES.md) to choose your option. Both keep your existing site and family data.
> Automatic updates need a one-time setup; publishing a release does not enable them for you.

Maintainer: link this guide from release notes. Users on older versions cannot see a new in-app
notice until their app has been upgraded. Describe automatic updates as enabled only after the
household has chosen that option and verified its update connection.
