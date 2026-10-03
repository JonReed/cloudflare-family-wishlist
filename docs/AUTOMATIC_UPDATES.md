# Set up automatic updates

Complete this once after the first deployment if you want automatic updates. Your GitHub copy then
checks for tested releases every six hours. When there is a new release, it updates your copy and
Cloudflare builds and deploys it.

Prefer to choose when updates happen? Follow [manual updates](MANUAL_UPDATES.md). Manual GitHub
updates use steps 1–15 below but skip step 16. Enabling Actions alone does not enable the schedule.

## Before you start

Keep your original project folder open in a terminal. Use PowerShell or Command Prompt on Windows,
Terminal on macOS, or your Linux terminal. Run terminal commands one at a time; stop on any error.
You need the Node.js and Git installed in [setup steps 1–2](DEPLOYMENT.md#1-install-nodejs), your
working wishlist address, and access to the GitHub and Cloudflare accounts used during setup.

Open [GitHub](https://github.com/) and select your `cloudflare-family-wishlist` repository from the
repository list. Keep that tab open. Its address must contain **your** username, not `JonReed`.
Whenever this guide says “your GitHub repository”, it means that tab.

Already using the app? Start with [Repair an existing installation](REPAIR_UPDATES.md).

These instructions describe the new fork updater. Its Git operations and failure handling have
local integration tests. A live scheduled run through a separate household's Cloudflare account
must still be observed before this path can be described as verified end to end.

## 1. Open your existing Worker

Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and select the
Worker that already serves your family's wishlist. Use the same Cloudflare account as setup.

**Done when:** the Worker name matches `workerName` in your `.wishlist-installation.json` file.

## 2. Connect your GitHub copy

Open **Settings → Builds → Connect**. Authorise Cloudflare to access your
`cloudflare-family-wishlist` repository and select it. If it is already connected, check that it is
your repository. Connect the existing Worker; do not create another app or database.

**Done when:** the Builds page shows your GitHub repository.

## 3. Select the production branch

Set the production branch to `main`.

**Done when:** Builds shows `main`. The updater copies tested releases onto this branch.

## 4. Set the build command

Paste into **Build command**:

```sh
npm run build
```

**Done when:** the saved command matches the command above. Keep the root directory at the repository root.

## 5. Set the deploy command

Paste into **Deploy command**:

```sh
npm run deploy:production
```

This applies pending migrations to the household database before deploying the app.

**Done when:** the saved command matches the command above.

## 6. Set the Node.js version

Under **Settings → Builds → Variables and secrets**, add a **text** variable with these fields.
Paste these values into the web form, not the terminal.

Name:

```text
NODE_VERSION
```

Value:

```text
24
```

Save the variable.

**Done when:** the variable appears in the build settings.

## 7. Display your saved installation settings

In the project folder, run:

```sh
node -e "console.log(require('node:fs').readFileSync('.wishlist-installation.json','utf8'))"
```

These are the account, Worker and database identifiers saved during setup, not API tokens.

**Done when:** a JSON object is printed. Keep it available for the next step.

## 8. Save those settings for future builds

Under **Settings → Builds → Variables and secrets**, add a **text** variable. Paste this into **Name**:

```text
WISHLIST_INSTALLATION
```

Paste the complete output from step 7 into **Value**, including both braces, then save. Do not paste
only the database ID or include the terminal prompt.

**Done when:** the build variable exists. This is separate from the Worker's runtime secrets.

## 9. Check the build token's database permission

The build token lets Cloudflare deploy the app. It also needs permission to update your existing
database. Keep the token already selected for this Worker and add the missing permission:

1. In the Worker's **Settings → Builds → API token**, note the selected token's name.
2. Open [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) in another tab.
3. Find that exact token and choose **Edit** from its menu.
4. Under **Permissions**, add **Account → D1 → Edit**. Keep its existing deployment permissions.
5. Check **Account Resources** includes the household's account, then save the token changes.

If you cannot find or edit the selected token, stop here and ask the account owner to grant access.
Do not replace it with the Access invitation token or paste a token into a public issue.

**Done when:** the selected build token can deploy the Worker and apply D1 migrations.
The invitation token used by the app is a different token; do not replace it.

## 10. Disable preview builds

In the same Worker's **Settings → Builds → Branch control**, turn off non-production branch
builds and save. These are previews of other branches; they must not update your family database.

**Done when:** only production `main` can run the production migration command.

## 11. Remove build path filters

In the same Worker's **Settings → Builds → Build watch paths**, keep the default that includes
all files. Remove custom include/exclude filters if you previously added them, then save.

**Done when:** changing `.wishlist-upstream.json` will also trigger a build.

## 12. Enable the update workflow

Open **your GitHub repository → Actions**. If prompted, choose
**I understand my workflows, go ahead and enable them**. Select **Update Family Wishlist** and
enable that workflow if GitHub shows an **Enable workflow** button.

**Done when:** **Update Family Wishlist** is listed in the Actions sidebar and has a **Run workflow**
button. Bookmark this page: you will use it to check updates or retry a failed run. If the workflow
is missing, stop and use [the existing-installation guide](REPAIR_UPDATES.md).

## 13. Run the updater once

On **Update Family Wishlist**, choose **Run workflow → main → Run workflow**.

**Done when:** a new run appears. The manual run also requests a rebuild when the code is current.

## 14. Verify the deployment

Open that workflow run and wait for it to finish. Its summary must say that the Cloudflare build
succeeded for the recorded repository commit. A run reporting an update to Git alone is insufficient.

**Done when:** the workflow is green, including **Check the Cloudflare build**. If it fails, follow
the specific error and retry. The workflow waits for Cloudflare for up to 25 minutes.

## 15. Check your family app

Open your usual wishlist address, sign in and confirm your existing lists are present. The footer
shows the installed application version. A repair from `main` may already contain changes newer
than the latest release; the updater keeps those until the release channel catches up.

**Done when:** the usual app and data work.

## 16. Enable automatic updates

In **your GitHub repository → Settings → Secrets and variables → Actions → Variables**, choose
**New repository variable**. Paste these into the web form.

Name:

```text
WISHLIST_AUTO_UPDATE
```

Value:

```text
true
```

Save the variable. Use the **Variables** tab, not **Secrets**. This setting belongs to GitHub,
not Cloudflare.

**Done when:** the variable is listed with value `true`. Only now will scheduled runs perform updates.
Manual mode leaves it absent or sets it to `false`.

## 17. Turn on failure notifications

Open [GitHub notification settings](https://github.com/settings/notifications). Under **Actions**,
enable email notifications for failed workflow runs and save your preference.

**Done when:** GitHub is configured to email you when an update fails. If you use manual updates,
this notification step is still useful; do not enable step 16's schedule.

## If a step fails

Stop at that step. Keep the existing Worker, database and project folder. Fix the cause below, then
repeat the failed step; do not restart the installation.

| What you see                                  | Next action                                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 7 reports `ENOENT`                       | The saved settings file is missing or you are in the wrong folder. Return to the original setup folder; do not create a replacement database. |
| GitHub has no **Run workflow** button         | Check that you opened your own fork, that `main` contains the workflow, and that Actions is enabled (step 12).                                |
| Workflow says the Cloudflare build is missing | Check that the existing Worker is connected to this exact fork and `main` (steps 2–3), then check the watch paths (step 11).                  |
| Cloudflare build fails                        | Open the Worker's **Deployments**, select the failed build and read its first error. Check build settings (steps 4–9), then retry step 13.    |
| Workflow reports custom changes               | Stop. Keep those changes and use [the custom-change instructions](REPAIR_UPDATES.md#if-the-updater-reports-custom-changes).                   |
| Workflow succeeds but the app fails           | Do not mark the update complete. Keep the database and follow [setup troubleshooting](DEPLOYMENT.md#when-something-fails).                    |

## What happens after setup

- The workflow checks every six hours. GitHub can delay scheduled jobs; updates are not instant.
- Only our gate-passed `stable` channel is used. Ordinary development pushes do not update households.
- If there are no releases, a small activity commit every 28 days prevents the public repository
  becoming inactive for 60 days. It also rebuilds and checks the current app.
- Every check verifies Cloudflare's build for the current household commit, so a failed deployment
  continues to fail subsequent checks instead of being labelled up to date.
- Application code is updated; household GitHub workflows and ignored installation settings are
  preserved. Custom application/configuration edits stop the update with an explanation.
- A failed build leaves the running Worker in place. A successful database migration is not undone
  if deployment fails, so releases must keep migrations compatible with the previous Worker.

To retry, use **Run workflow** on the same updater. To switch to manual updates, change
`WISHLIST_AUTO_UPDATE` to `false`; the manual button still works. This affects future scheduled runs;
let any running update finish before starting another. Set it back to `true` to resume automatic updates. The older separate installation-repository updater is legacy and has its
own [migration notes](INSTALLATION_UPDATES.md).

Platform references: [Cloudflare Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/),
[GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
