# Update manually

Choose manual updates if you want to decide when each release is installed. Your app keeps working
between updates. Publishing a release does not update a manual installation for you.

The original standard setup used manual updates, even when Cloudflare automatically deployed changes
from your own repository. The separate experimental installation-repository updater was an exception.
You can keep updating manually or [enable automatic updates](UPDATES.md) later.

## Set up release notifications once

Open [the project on GitHub](https://github.com/JonReed/cloudflare-family-wishlist), sign in and choose
**Watch → Custom → Releases → Apply**. Check [your notification settings](https://github.com/settings/notifications)
so GitHub can email you. You can also bookmark [the latest release](https://github.com/JonReed/cloudflare-family-wishlist/releases/latest).
There is currently no in-app update notice.

## Choose how to run manual updates

- **In your browser:** press a button on GitHub to start the update. Cloudflare installs the new
  release on your existing website. Use this route if you connected GitHub during setup.
- **On your computer:** download and install the release with the commands below. Use this route
  if you originally installed from your computer and still have the project folder.

Both routes keep the website address and family lists you already use. You do not need to install
a second website. Choose one route below; you do not need to follow both.

## Manual updates through GitHub

### One-time setup

Open [GitHub](https://github.com/) and select your copy of `cloudflare-family-wishlist`. GitHub
calls this copy a **repository**. Its address contains your username or organisation name, rather
than the project's `JonReed` username. Select **Actions** and look for **Update Family Wishlist**
in the left sidebar.

If that option is missing, complete [setup steps 1–4f](UPDATES.md#1-keep-your-installation-settings)
to add the update tool. Both that preparation and later updates use published releases. The tool will not replace a
newer version with an older release.

Complete [update connection steps 1–15](AUTOMATIC_UPDATES.md#1-open-your-wishlist-website-in-cloudflare), including
the first manual run and app check. **Skip steps 16–28** (the automatic connection). Complete [step 29](AUTOMATIC_UPDATES.md#29-turn-on-failure-notifications)
to receive failure notifications. In your repository's
**Settings → Secrets and variables → Actions → Variables**, leave `WISHLIST_AUTO_UPDATE` absent or
set it to `false`. The workflow must remain enabled for its manual button to work.

If you previously enabled automatic updates using the older experimental setup, follow its
[migration guide](INSTALLATION_UPDATES.md) before using this option. If you enabled the first version
of **Update Family Wishlist** before the manual/automatic choice was added, update its files through
[the setup guide](UPDATES.md) first. Until then, use **Disable workflow** in its GitHub Actions menu
to stop automatic runs; changing a new setting cannot change how an old update tool behaves.

### Each time you want to update

#### 1. Read the release notes

Open [the latest release](https://github.com/JonReed/cloudflare-family-wishlist/releases/latest).

**Done when:** you have checked whether the release asks for any preparation before updating.

#### 2. Find where your website stores its lists

Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and select your
wishlist app. Check that its website address is the one your family uses; website addresses are
listed under **Domains** if you cannot see yours on the overview. Older dashboard layouts call
this **Settings → Domains & Routes**.

Open the app's **Settings → Bindings** section (or **Bindings** tab in older layouts). Look for **DB**, labelled **D1 database**. That is the stored data
used by this website. Follow the database link. If it is not clickable, note its displayed name,
open [Cloudflare D1](https://dash.cloudflare.com/?to=/:account/workers/d1) and select that exact name.

**Done when:** you have opened the database linked to your existing wishlist website. You do not
need to find a hidden file or guess which database belongs to the app.

#### 3. Record the recovery time

Open the database's **Time Travel** tab. This is Cloudflare's way to return stored data to an
earlier time if something goes wrong. Note the database name and the current date and time,
including your time zone, in a private note. For example: “3 October 2026, 14:30, London time.”
Do not select **Restore**; you are only recording when you are about to update.

**Done when:** you have a note identifying the database and the time before you updated. Cloudflare
can use that time for recovery within its retention window. To also download a backup file, use
[the optional export steps](BACKUP_RESTORE_UPGRADE.md#create-a-recovery-point).

#### 4. Open the update workflow

Open the GitHub workflow page bookmarked during setup. If you do not have it bookmarked, open
[GitHub](https://github.com/), select **your** `cloudflare-family-wishlist` repository, select
**Actions**, then **Update Family Wishlist** in the left sidebar.

**Done when:** the page shows **Run workflow**. If it shows **Enable workflow**, enable it first.
If the workflow is absent, stop and complete the one-time setup above.

#### 5. Start the update

Choose **Run workflow**, select branch **main**, leave **Automatic timer check** unchecked and
**Cloudflare timer time** empty, then press the green **Run workflow** button.

**Done when:** a new run appears in the list. This installs a newer tested release or rebuilds the
current version for a retry. It will not downgrade newer code.

#### 6. Check the build result

Open the new entry in the list of runs, then open the job named **update**. Wait for its step
**Check the Cloudflare build** to succeed. This can take up to 25 minutes.

**Done when:** that check is green. A skipped job is not a successful update. If it fails, read the
first error and use [the update troubleshooting table](AUTOMATIC_UPDATES.md#if-a-step-fails) to
find the next action. Repeat step 5 after fixing that cause. Keep your existing website and database.

#### 7. Check your app

Open your usual wishlist address and sign in.

**Done when:** the family's existing lists and wishes are present. The footer shows the installed
version number; compare it with the release notes. If you installed a development version newer
than the latest release, the tool keeps it until a newer release becomes available.

Manual updates do not need a Cloudflare timer key.

## Manual updates from your computer

These commands work in Windows PowerShell, Command Prompt, macOS Terminal and Linux terminals.
Run **one command at a time**. Stop if any command fails. On Windows, if PowerShell blocks `npm.ps1`,
use Command Prompt instead. Use Node.js 24 and Git; [setup steps 1–2](DEPLOYMENT.md#1-install-nodejs)
include their installers.

Use the folder from your original installation. If you have edited the app's files yourself, or
previously updated through GitHub, these commands may stop to protect those changes. Follow the
message at that step; do not use commands that discard files. Do not start another update while
following these steps.

### 1. Open the existing project folder

Find the `cloudflare-family-wishlist` folder downloaded during the original installation.
On Windows, open it in File Explorer, click the address bar, type `cmd` and press Enter.
On macOS, right-click it in Finder and choose **Services → New Terminal at Folder**.
On Linux, right-click it and choose **Open in Terminal**, if your file manager offers it.

**Done when:** your terminal is open in that existing folder. Run every command below in this
terminal. If you no longer have the folder, stop and use [the existing-installation guide](UPDATES.md)
to recover your website settings.

### 2. Check for local changes

```sh
git status --short
```

**Done when:** nothing is printed. If files are listed, stop and preserve those changes with an
assistant. Your saved website settings are kept separately; the next step displays those.

### 3. Check the saved installation settings

```sh
node -e "const s=JSON.parse(require('node:fs').readFileSync('.wishlist-installation.json','utf8')); console.table({'Cloudflare account ID':s.accountId,'Website name':s.workerName,'Database name':s.databaseName,'Database ID':s.databaseId})"
```

Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and select your
wishlist app by the website address your family uses. Check the **Website name** printed by the
command against the name at the top of that Cloudflare page. Open **Settings → Bindings** (or the **Bindings** tab in older layouts) and check that **DB**
points to the **Database name** printed by the command.

**Done when:** both names match. Keep the terminal output for step 11. The command reads the saved
settings for you; you do not need to find or edit the hidden settings file. If it reports `ENOENT`,
stop: you may have opened the wrong folder. If the saved file is lost, follow
[the settings recovery instructions](UPDATES.md#1-keep-your-installation-settings) rather than
creating a new database or guessing the values.

### 4. Make a recovery point

Run this from the existing project folder before changing its source:

```sh
npm run installation:wrangler -- d1 time-travel info DB
```

**Done when:** the command prints a **bookmark**: a value Cloudflare can use to recover the data
from this point in time. Copy that value into a private note with today's date and time. If the older script fails on Windows, use browser steps 2–3
under **Each time you want to update** above to record a recovery time for the same database.
Stop if you cannot verify the database. A portable SQL export is optional; see
[the backup guide](BACKUP_RESTORE_UPGRADE.md#create-a-recovery-point).

### 5. Download the latest published release

```sh
git fetch https://github.com/JonReed/cloudflare-family-wishlist.git stable
```

**Done when:** the command finishes without an error. It has downloaded the release files; your
website has not changed yet.

### 6. Check whether there is anything new to install

```sh
git rev-list --count HEAD..FETCH_HEAD
```

**Done when:** the command prints a number greater than `0`. Continue to step 7.
If it prints `0`, there are no newer release files to add to this folder. You can stop if the last
installation succeeded. If an earlier attempt to publish these files failed, fix its reported error
and retry from step 9.

### 7. Read the release notes

Open [the latest release](https://github.com/JonReed/cloudflare-family-wishlist/releases/latest).
Complete any preparation it requires before proceeding.

### 8. Put the release files into your project folder

```sh
git merge --ff-only FETCH_HEAD
```

**Done when:** the command finishes without an error, usually showing **Fast-forward** and a list
of changed files. Your saved website settings stay in place. Your live website has not changed yet.

If it says it cannot fast-forward, stop: it cannot safely combine your copy with this release.
Ask an assistant to check your existing changes, or use the GitHub update route if you set that up.
Do not add `--force`, run a reset, or discard your changes.

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

**Done when:** the output lists the **Cloudflare account ID** shown in step 3. An account ID is the
long value identifying your Cloudflare account. Compare the two values exactly. If the saved account
is missing from this output, stop and sign in with the account used for your existing website.

### 12. Check the downloaded app files

```sh
npm run quality
```

**Done when:** the checks finish without an error and return you to the terminal prompt. This may
take several minutes. If a check fails, stop and keep the error message for the person helping you.

### 13. Check for known problems in the included software

```sh
npm run audit
```

**Done when:** the command finishes successfully. It checks the software packages included with
the app for known security problems. If it fails, stop and report its output; do not run
`npm audit fix`, which would change the downloaded release.

### 14. Publish the updated website

```sh
npm run deploy
```

This is the step that changes your live website. It uses the saved settings checked in step 3,
updates how the app stores data if the release needs that, and publishes the new version. Your
website address, family lists and sign-in settings stay in place. No separate database command is needed.

**Done when:** the command reports a successful deployment and prints your website's Cloudflare
address. If you normally use a custom domain, that address will still work too. If this step fails,
keep the existing database and fix the reported error before retrying; some data changes may
already have been applied.

### 15. Check the published website settings

```sh
npm run setup:check
```

**Done when:** the command reports that the website and its database are correctly connected and
that required database updates have been applied. It may say **Access checks skipped** because you
have not supplied permission to inspect sign-in settings. In that case, check sign-in yourself in
step 16. Stop on a failed check.

### 16. Check the app

Open your usual address and sign in. Confirm existing lists and wishes remain, and check the footer
version. Keep the updated checkout and its settings for the next release.

**Done when:** you can sign in at your usual address and see your family's existing lists and wishes.
If the website does not work, keep the database and use [the recovery guide](BACKUP_RESTORE_UPGRADE.md).
Reinstalling an older app version does not automatically undo changes to its stored data.
