# Set up automatic updates

Complete this once after the first deployment if you want automatic updates. Your GitHub copy then
checks for tested releases every six hours. When there is a new release, it updates your copy and
Cloudflare builds and deploys it.

Prefer to choose when updates happen? Follow [manual updates](MANUAL_UPDATES.md). Manual GitHub
updates use steps 1–15 below but skip step 16. Enabling Actions alone does not enable the schedule.

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

Under **Builds → Variables and secrets**, add a text build variable named `NODE_VERSION` with value `24`.

**Done when:** the variable appears in the build settings.

## 7. Display your saved installation settings

In the project folder, run:

```sh
node -e "console.log(require('node:fs').readFileSync('.wishlist-installation.json','utf8'))"
```

These are the account, Worker and database identifiers saved during setup, not API tokens.

**Done when:** a JSON object is printed. Keep it available for the next step.

## 8. Save those settings for future builds

Under **Builds → Variables and secrets**, add a **text** variable named `WISHLIST_INSTALLATION`.
Paste the complete JSON object from step 7 as its value, including both braces.

**Done when:** the build variable exists. This is separate from the Worker's runtime secrets.

## 9. Check the build token's database permission

Open **Builds → API token**. Use a token for this account with **Account → D1 → Edit**, in addition
to its Worker deployment permissions. Create or edit it through
[Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) if necessary.

**Done when:** the selected build token can deploy the Worker and apply D1 migrations.
The invitation token used by the app is a different token; do not replace it.

## 10. Disable preview builds

Disable builds for non-production branches in the Worker's build settings.

**Done when:** only production `main` can run the production migration command.

## 11. Remove build path filters

Leave **Build watch paths** at its default of building all changes. Remove any custom filters.

**Done when:** changing `.wishlist-upstream.json` will also trigger a build.

## 12. Enable the update workflow

Open **your GitHub repository → Actions**. If prompted, choose
**I understand my workflows, go ahead and enable them**. Select **Update Family Wishlist** and
enable that workflow if GitHub shows an **Enable workflow** button.

**Done when:** **Update Family Wishlist** is enabled. If it is missing, use the repair guide.

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

**Done when:** the usual app and data work. Keep GitHub Actions failure notifications enabled in
[your GitHub notification settings](https://github.com/settings/notifications).

## 16. Enable automatic updates

In **your GitHub repository → Settings → Secrets and variables → Actions → Variables**, choose
**New repository variable**. Enter `WISHLIST_AUTO_UPDATE` as the name and `true` as the value, then
save it. This is a repository variable, not a secret or Cloudflare build variable.

**Done when:** the variable is listed with value `true`. Only now will scheduled runs perform updates.
Manual mode leaves it absent or sets it to `false`.

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
