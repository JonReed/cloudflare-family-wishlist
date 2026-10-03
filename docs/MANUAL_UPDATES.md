# Update manually

Choose manual updates if you want to decide when each release is installed. Your app keeps working
between updates. Publishing a release does not update a manual installation for you.

The original standard setup used manual updates, even when Cloudflare automatically deployed changes
from your own repository. The separate experimental installation-repository updater was an exception.
You can keep updating manually or [enable automatic updates](REPAIR_UPDATES.md) later.

## Set up release notifications once

Open [the project on GitHub](https://github.com/JonReed/cloudflare-family-wishlist), sign in and choose
**Watch → Custom → Releases → Apply**. Check [your notification settings](https://github.com/settings/notifications)
so GitHub can email you. You can also bookmark [the latest release](https://github.com/JonReed/cloudflare-family-wishlist/releases/latest).
There is currently no in-app update notice.

## Choose how to run manual updates

- **GitHub:** use the manual button in the same workflow used for automatic updates. Cloudflare
  builds and deploys the tested release. This is the simpler repeatable route once connected.
- **Your computer:** use the terminal procedure below. No GitHub Actions or Cloudflare Builds
  connection is required. Keep the original project folder and its installation settings.

Both routes update your existing Worker and database. Do not run the new-household setup again.

## Manual updates through GitHub

### One-time setup

If your repository does not contain `.github/workflows/update-household.yml`, follow
[repair steps 1–4](REPAIR_UPDATES.md#1-keep-your-installation-settings) to bring in the update tools.
That initial repair brings in current `main`; subsequent runs select tested `stable` releases.

Complete [update connection steps 1–15](AUTOMATIC_UPDATES.md#1-open-your-existing-worker), including
the first manual run and app check. **Skip step 16** (the automatic schedule). Complete step 17
to receive failure notifications. In your repository's
**Settings → Secrets and variables → Actions → Variables**, leave `WISHLIST_AUTO_UPDATE` absent or
set it to `false`. The workflow must remain enabled for its manual button to work.

If you installed the earlier fork workflow that has no `WISHLIST_AUTO_UPDATE` condition, first
update that workflow through the repair guide. Setting a variable alone cannot change an old workflow.
Until that is done, disable the old workflow in Actions to stop its schedule.

### Each time you want to update

#### 1. Read the release notes

Open [the latest release](https://github.com/JonReed/cloudflare-family-wishlist/releases/latest).

**Done when:** you have checked whether the release asks for any preparation before updating.

#### 2. Open your database

Open [Cloudflare D1](https://dash.cloudflare.com/?to=/:account/workers/d1) and select the database
named `databaseName` in your saved `.wishlist-installation.json`. Use the household's account.

**Done when:** the database name and ID match your installation settings. Do not select a database
based only on a similar name.

#### 3. Record the recovery time

Open the database's **Time Travel** tab. Note the current UTC time in a private note so you can
identify the point before this update if recovery is needed. Do not select **Restore**.

**Done when:** you have recorded the database ID and pre-update UTC time. For a portable SQL backup,
use the optional export steps in [the backup guide](BACKUP_RESTORE_UPGRADE.md#create-a-recovery-point).

#### 4. Open the update workflow

Open the GitHub workflow page bookmarked during setup. If you do not have it bookmarked, open
[GitHub](https://github.com/), select **your** `cloudflare-family-wishlist` repository, select
**Actions**, then **Update Family Wishlist** in the left sidebar.

**Done when:** the page shows **Run workflow**. If it shows **Enable workflow**, enable it first.
If the workflow is absent, stop and complete the one-time setup above.

#### 5. Start the update

Choose **Run workflow**, select branch **main**, then press the green **Run workflow** button.

**Done when:** a new run appears in the list. This installs a newer tested release or rebuilds the
current version for a retry. It will not downgrade newer code.

#### 6. Check the build result

Open the new run and wait for **Check the Cloudflare build** to succeed. This can take up to 25 minutes.

**Done when:** that check is green. A skipped job is not a successful update. If it fails, read the
first error in that job, correct that cause and repeat step 5. Do not delete the database or reset the fork.

#### 7. Check your app

Open your usual wishlist address and sign in.

**Done when:** the family's existing lists and wishes are present. The footer shows the installed
version; compare it with the release notes. If your installation was already ahead of the stable
release, keeping that newer code is expected.

GitHub's automatic schedule may be disabled after inactivity; manual runs do not require that schedule.

## Manual updates from your computer

These commands work in Windows PowerShell, Command Prompt, macOS Terminal and Linux terminals.
Run **one command at a time**. Stop if any command fails. On Windows, if PowerShell blocks `npm.ps1`,
use Command Prompt instead. Use Node.js 24 and Git; [setup steps 1–2](DEPLOYMENT.md#1-install-nodejs)
include their installers.

This procedure is for a clean checkout that follows the project's Git history. A fork previously
updated by the snapshot workflow, or a customised checkout, may not fast-forward. In that case use
its GitHub update workflow or ask an assistant to preserve and review your changes. Do not force a
merge, discard commits or reset the checkout. Keep any other deployment process idle while updating.

### 1. Open the existing project folder

Open a terminal in the folder used to install the app. If it is in the current directory, run:

```sh
cd cloudflare-family-wishlist
```

**Done when:** you are in the existing checkout, not a new empty folder. If you no longer have it,
recover the installation settings and use the [existing-installation guide](REPAIR_UPDATES.md).

### 2. Check for local changes

```sh
git status --short
```

**Done when:** nothing is printed. If files are listed, stop and preserve those changes with an
assistant. Ignored installation settings will not appear here; the next step checks them separately.

### 3. Check the saved installation settings

```sh
node -e "console.log(require('node:fs').readFileSync('.wishlist-installation.json','utf8'))"
```

**Done when:** `accountId`, `workerName`, `databaseId` and `databaseName` identify your existing
household. Keep a private backup of this file. If it is missing, recover the identifiers from your
Worker's bindings or its `WISHLIST_INSTALLATION` build variable using
[Installation settings](INSTALLATION_CONFIG.md). Do not create a new database or guess its ID.

### 4. Make a recovery point

Run this from the existing project folder before changing its source:

```sh
npm run installation:wrangler -- d1 time-travel info DB
```

**Done when:** Wrangler prints a recovery bookmark for your saved database. Keep the bookmark and
current UTC time in a private note. If the older script fails on Windows, use browser steps 2–3
under **Each time you want to update** above to record a recovery time for the same database.
Stop if you cannot verify the database. A portable SQL export is optional; see
[the backup guide](BACKUP_RESTORE_UPGRADE.md#create-a-recovery-point).

### 5. Download the tested release history

```sh
git fetch https://github.com/JonReed/cloudflare-family-wishlist.git stable
```

**Done when:** the fetch succeeds. This only downloads source; it does not deploy anything.

### 6. Check whether there are new release commits

```sh
git rev-list --count HEAD..FETCH_HEAD
```

**Done when:** a positive number is printed. If it prints `0`, stop: your checkout already includes
this release or is ahead of it. Do not downgrade to `stable`. If you only need to retry a failed
deployment of this checkout, continue at step 9 after checking the previous error.

### 7. Read the release notes

Open [the latest release](https://github.com/JonReed/cloudflare-family-wishlist/releases/latest).
Complete any preparation it requires before proceeding.

### 8. Advance the checkout safely

```sh
git merge --ff-only FETCH_HEAD
```

**Done when:** the fast-forward succeeds. If it refuses, stop: your history has diverged or contains
custom changes. Ask an assistant to review it. The command preserves ignored installation settings
and does not deploy or push changes to GitHub.

### 9. Install the release's tools, including Wrangler

```sh
npm ci
```

**Done when:** installation succeeds. A separate global Wrangler or Cloudflare CLI install is not
needed for an update; `npm ci` installs this release's Wrangler. The wider `cf` CLI is only needed
when changing Access setup, which routine updates do not require.

### 10. Sign in to Cloudflare

```sh
npx wrangler login
```

**Done when:** the browser authorisation completes for the household's Cloudflare account.
If an assistant uses API-token environment variables, it must check their intended account too;
a browser login does not override an existing token.

### 11. Check the active account

```sh
npm run installation:wrangler -- whoami
```

**Done when:** the intended account ID matches the saved installation settings. Stop on a mismatch.

### 12. Check the source

```sh
npm run quality
```

**Done when:** all checks and the production build succeed.

### 13. Check dependencies

```sh
npm run audit
```

**Done when:** the audit succeeds. If it fails, do not run `npm audit fix` on a release; report the
failure and wait for reviewed guidance.

### 14. Deploy to the existing household

```sh
npm run deploy
```

This rebuilds using your installation settings, applies pending migrations to your existing D1
and deploys the Worker while preserving runtime variables and secrets. Do not run a separate SQL
migration command first.

**Done when:** deployment succeeds and prints your existing Worker address. If deployment fails
after migrations, keep the database and fix the reported error before retrying this step.

### 15. Check the deployment

```sh
npm run setup:check
```

**Done when:** the account, database, migrations and deployed bindings checks pass. A message that
deep Access checks were skipped is expected when no Access-check credentials were supplied.

### 16. Check the app

Open your usual address and sign in. Confirm existing lists and wishes remain, and check the footer
version. Keep the updated checkout and its settings for the next release.

**Done when:** the existing household works. A rollback of Worker code does not undo database
migrations; use [the recovery runbook](BACKUP_RESTORE_UPGRADE.md) if recovery is needed.
