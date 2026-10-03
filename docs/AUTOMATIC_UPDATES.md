# Set up automatic updates

Use this guide if your family's wishlist already works and you want future releases installed
for you. Once set up, it checks for a new release every six hours and updates the same website
your family already uses.

Prefer to choose when updates happen? Follow [manual updates](MANUAL_UPDATES.md). Manual GitHub
updates use steps 1–15 below, then step 29 for notifications. Skip steps 16–28.
Cloudflare supplies the timer; both choices use the same GitHub update workflow.

## Before you start

Have these ready:

- The website address your family uses for its wishlist.
- The Cloudflare and GitHub accounts used to install it.
- The `cloudflare-family-wishlist` folder downloaded to your computer during installation.

Most steps happen in your browser. Step 7 uses a terminal: PowerShell or Command Prompt on Windows,
Terminal on macOS, or your Linux terminal. Node.js must still be installed from the original setup;
if needed, [download Node.js 24](https://nodejs.org/en/download) and reopen your terminal.
Paste each command separately and wait for it to finish. If it reports an error, stop at that step.

Open [GitHub](https://github.com/) and select your `cloudflare-family-wishlist` repository from the
repository list. This is your saved copy of the app's files; GitHub calls it a **repository**.
Keep that tab open. The address should start with `https://github.com/` followed by your username
(or the organisation that owns your copy). The project's `JonReed` page is not your household's copy.
Whenever this guide says “your GitHub repository”, it means your own copy.

Already using the app? Start with [Choose your update option](UPDATES.md).

**Verification status:** the update tools have passed local tests. A complete scheduled update on
a separate household installation has not yet been verified. These instructions should not be read
as a claim that automatic updates have already been proven to work for every household.

## 1. Open your wishlist website in Cloudflare

Cloudflare calls a hosted app a **Worker**. Here, that means your existing wishlist website.

Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and select your
wishlist app. Check that its website address matches the address your family normally uses. If the
address is not on the overview, open **Domains** to see its website addresses. In older versions
of the dashboard, this is under **Settings → Domains & Routes**.

**Done when:** you have opened the Cloudflare page for your existing wishlist website. Keep this
tab open for steps 2–11. If you cannot find that website, check which account you are signed into;
do not create another app.

## 2. Connect your GitHub copy

On the Cloudflare page from step 1, open **Settings → Builds → Connect**. Select **GitHub** and
allow Cloudflare to read your `cloudflare-family-wishlist` repository when asked. Select your copy
of the project. If a repository is already connected, check that the displayed link opens your copy.

**Builds** is the Cloudflare feature that turns those saved files into your working website.

**Done when:** the Builds page shows a link to your own `cloudflare-family-wishlist` repository.

## 3. Select the production branch

On the same **Builds** page, set **Production branch** to:

```text
main
```

A branch is a named set of files in your GitHub copy. This setting tells Cloudflare which files
to use. The update tool puts published releases into **your** `main`; it does not follow every
change to the project's development branch.

**Done when:** the saved **Production branch** field says `main`.

## 4. Set the build command

On the same **Builds** page, paste this into the **Build command** field and save. This is a web
form value; do not run it in your terminal for this step:

```sh
npm run build
```

**Done when:** the **Build command** field says `npm run build`. Leave **Root directory** at its
default; do not select a subfolder such as `app`.

## 5. Set the deploy command

On the same **Builds** page, paste this into the **Deploy command** field and save:

```sh
npm run deploy:production
```

This tells Cloudflare how to install a new version. It includes any required changes to how the
app stores your lists.

**Done when:** the **Deploy command** field says `npm run deploy:production`.

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

**Done when:** the build settings show a row named `NODE_VERSION` with value `24`.

## 7. Display your saved installation settings

Open a terminal in the `cloudflare-family-wishlist` folder used for the original installation.
On Windows, open that folder in File Explorer, click the address bar, type `cmd` and press Enter.
On macOS, right-click the folder in Finder and choose **Services → New Terminal at Folder**.
On Linux, right-click the folder and choose **Open in Terminal**, if your file manager offers it.

Paste this command. It displays the saved settings for your website:

```sh
node -e "console.log(require('node:fs').readFileSync('.wishlist-installation.json','utf8'))"
```

The file was created during installation. It tells the update tool which existing website and
stored family lists to use. You do not need to find the file in your file manager or edit its contents.

**Done when:** the terminal prints text beginning with `{` and ending with `}`, with labels such as
`accountId` and `workerName` inside. Copy that entire block for step 8. These are settings, not passwords.
If the command says `ENOENT`, the file is not in this folder: stop and check you opened the original
installation folder. Do not make up replacement values.

## 8. Save those settings for future builds

Under **Settings → Builds → Variables and secrets**, add a **text** variable. Paste this into **Name**:

```text
WISHLIST_INSTALLATION
```

Paste the complete output from step 7 into **Value**, including both braces, then save. Do not paste
only the database ID or include the terminal prompt.

**Done when:** the **Builds** settings show a row named `WISHLIST_INSTALLATION` containing the
text from step 7. Keep this under **Builds**; do not change the separate website sign-in settings.

## 9. Allow Cloudflare to update your stored lists

An **API token** is a permission key. Cloudflare already uses one to publish your website. It also
needs permission to update the database where your family lists are stored. Use the existing key:

1. In the Worker's **Settings → Builds → API token**, note the selected token's name.
2. Open [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) in another tab.
3. Find that exact token and choose **Edit** from its menu.
4. Under **Permissions**, add **Account → D1 → Edit**. Keep its existing deployment permissions.
5. Check **Account Resources** includes the household's account, then save the token changes.

If you cannot find or edit the selected token, stop here and ask the account owner to grant access.
Do not replace it with the Access invitation token or paste a token into a public issue.

**Done when:** the saved permissions include **Account → D1 → Edit** for the account containing
your wishlist website. Leave all other permissions as they were. **D1** is Cloudflare's name for
the database service that stores your family lists.

## 10. Disable preview builds

In the same Worker's **Settings → Builds**, select **Previews Base** and turn off
**Builds for Preview branches**. Save if a **Save** button appears. In older dashboard layouts,
this switch is under **Branch control** and is called non-production branch builds.
These are previews of other branches; they must not update your family database.

**Done when:** the setting for non-production branch builds is off. Updates to other branches
will not run this website's update command.

## 11. Remove build path filters

In the same Worker's **Settings → Builds**, select **Production**, then find **Build watch paths**.
Keep the default that includes
all files. Remove custom include/exclude filters if you previously added them, then save.

**Done when:** there are no custom exclusions, and the include setting covers all files. This
allows Cloudflare to notice every update made by the update tool.

## 12. Enable the update tool

GitHub calls an automated task a **workflow**. The one for this website is called **Update Family Wishlist**.

Open **your GitHub repository → Actions**. If prompted, choose
**I understand my workflows, go ahead and enable them**. Select **Update Family Wishlist** and
enable that workflow if GitHub shows an **Enable workflow** button.

**Done when:** **Update Family Wishlist** is listed in the Actions sidebar and has a **Run workflow**
button. Bookmark this page: you will use it to check updates or retry a failed run. If the workflow
is missing, stop and use [the existing-installation guide](UPDATES.md).

## 13. Run the updater once

On **Update Family Wishlist**, choose **Run workflow**, select **main**, leave **Automatic timer
check** unchecked and **Cloudflare timer time** empty, then press **Run workflow**.

**Done when:** a new entry appears in the list of runs. Starting it also asks Cloudflare to republish
the website if there is no newer release, so you can check the connection works.

## 14. Wait for Cloudflare to finish updating the website

Open the new entry from step 13, then open the job named **update** to see its steps. Wait for
**Check the Cloudflare build** to finish. This checks whether Cloudflare successfully published the website.

**Done when:** the workflow is green, including **Check the Cloudflare build**. If it fails, follow
the specific error and retry. The workflow waits for Cloudflare for up to 25 minutes.

## 15. Check your family app

Open your usual wishlist address, sign in and confirm your existing lists are present. The footer
shows the installed version number. If you installed a development version newer than the latest
release, the tool keeps it until a newer release becomes available.

**Done when:** you can sign in at your usual address and see your family's existing lists and wishes.

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

**Done when:** GitHub shows `WISHLIST_AUTO_UPDATE` with value `true`. This allows the workflow
to accept automatic checks. Complete the remaining steps to connect the Cloudflare timer.

## 17. Open GitHub's update-key page

Open [Create a fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new).
Sign in with the GitHub account that owns your household repository. A token is a permission key:
Cloudflare uses this one to start the update workflow in your copy of the app.

**Done when:** the page is headed **New fine-grained personal access token**. Do not choose a classic token.

## 18. Name the key

In **Token name**, paste:

```text
Family Wishlist automatic updates
```

**Done when:** that name appears in the field.

## 19. Choose the expiry

In **Expiration**, choose **No expiration** if your account allows it. This lets unattended updates
continue without renewing the key. If your organisation requires an expiry, choose an allowed date
and record it privately; repeat steps 17–25 with a replacement key before that date.

**Done when:** the selected expiry matches your choice. An expired key cannot start updates.

## 20. Select the repository owner

In **Resource owner**, select the username or organisation shown in your household repository's
address. For `https://github.com/yourname/cloudflare-family-wishlist`, select `yourname`.

**Done when:** the owner matches your household copy.

## 21. Limit the key to your household copy

Under **Repository access**, select **Only select repositories**, then select your household's
`cloudflare-family-wishlist` repository.

**Done when:** only your household repository is selected. Do not select **All repositories**.

## 22. Allow the key to start updates

Under **Permissions**, choose **Repositories → Add permissions → Actions**. Set its **Access** to **Read and write**. GitHub includes
**Metadata → Read-only** automatically. Leave other permissions unselected.

**Done when:** Actions is **Read and write** and the selected repository is still only your copy.
The key does not need permission to edit your app files or access your Cloudflare database.

## 23. Create the key

Press **Generate token**. Complete GitHub's account confirmation if asked. If an organisation must
approve the key, wait for that approval before continuing.

**Done when:** GitHub displays a key beginning with `github_pat_`.

## 24. Copy the key

Use GitHub's **Copy** button beside the key. Keep this page open until step 25 succeeds; GitHub
only displays the value once. Do not paste it into chat, a document or a command argument.

**Done when:** the key is on your clipboard, ready for the hidden terminal prompt.

## 25. Save the key on your existing website

Return to the terminal in your original project folder. Replace `YOUR-GITHUB-NAME` below with the
owner selected in step 20. If your repository has a different name, use that name too.

```sh
npm run updates:configure -- YOUR-GITHUB-NAME/cloudflare-family-wishlist
```

When the command asks for the key, paste it and press Enter. Nothing appears while you paste;
that is intentional. The command checks the existing Worker and database, starts a GitHub setup
check, then saves the key as the Worker's encrypted `WISHLIST_UPDATE_CONFIG` secret. It does not
write the key to a file. The scoped key goes only to GitHub for the check and to your existing
Cloudflare Worker for future checks.

**Done when:** the command reports **Update key saved on** followed by your existing website's
name. Stop if it reports an error. Do not create another Worker or database.

## 26. Check the key works

Open the bookmarked GitHub **Update Family Wishlist** page. Open the run named
**Automatic release check setup-check** and its **update** job.

**Done when:** **Get the next tested release** and **Check the Cloudflare build** are green.
A skipped job is not a passing check. This tests the key and update connection; it is not a timer event.

## 27. Check the Cloudflare timer

On your existing Worker's Cloudflare page, open **Settings → Trigger events → Cron triggers**.
Older dashboard layouts call this section **Triggers**.
Look for:

```text
37 */6 * * *
```

This means Cloudflare starts a release check at 00:37, 06:37, 12:37 and 18:37 UTC each day. Cloudflare
may display the next run in your local time. The app's deploy command installs this timer; you do
not need to create a second scheduled task on GitHub. New Cloudflare timer settings can take up to
15 minutes to take effect.

**Done when:** that timer appears on the Worker. If it is missing, stop and check step 14 deployed
v1.1.1 or later, using the build/deploy commands in steps 4–5.

## 28. Check the first timed run

Return to GitHub after the next time shown in step 27. Look for **Automatic release check** followed
by a date and time, rather than **setup-check**. Open that run and its **update** job.

**Done when:** both update steps are green. This is the first complete timer check. On Cloudflare,
**Observability → Events** should also show `automatic_update_trigger` with `result` equal to `dispatched` and the
same timer time. If no run appears, use the troubleshooting table below. You can finish setup and
return for this check; do not claim the timer has been verified until it has actually run.

## 29. Turn on failure notifications

Open [GitHub notification settings](https://github.com/settings/notifications). Under **Actions**,
enable email notifications for failed workflow runs and save your preference.

**Done when:** GitHub is configured to email you when an update fails. This is useful for manual
updates too. A failure to contact GitHub is recorded in the Cloudflare Worker's **Observability → Events**, so inspect
those logs if an expected automatic run is missing.

## If a step fails

Stop at that step. Keep the existing Worker, database and project folder. Fix the cause below, then
repeat the failed step; do not restart the installation.

| What you see                                  | Next action                                                                                                                                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No automatic run appears after the timer time | Open the existing Worker’s **Observability → Events**. A GitHub HTTP 401/403 usually means the update key expired, lost repository access or lacks Actions read/write. Repeat steps 17–25 with the correct key. Check the GitHub opt-in variable and that the workflow is enabled. |
| Setup check reports HTTP 422                  | The household workflow is old or does not accept the timer inputs. Follow [existing-installation setup](UPDATES.md) to install the released workflow before retrying.                                                                                                              |
| Step 7 reports `ENOENT`                       | The saved settings file is missing or you are in the wrong folder. Return to the original setup folder; do not create a replacement database.                                                                                                                                      |
| GitHub has no **Run workflow** button         | Check that you opened your own fork, that `main` contains the workflow, and that Actions is enabled (step 12).                                                                                                                                                                     |
| Workflow says the Cloudflare build is missing | Check that the existing Worker is connected to this exact fork and `main` (steps 2–3), then check the watch paths (step 11).                                                                                                                                                       |
| Cloudflare build fails                        | Open the Worker's **Deployments**, select the failed build and read its first error. Check build settings (steps 4–9), then retry step 13.                                                                                                                                         |
| Workflow reports custom changes               | Stop. Keep those changes and use [the custom-change instructions](UPDATES.md#if-the-updater-reports-custom-changes).                                                                                                                                                               |
| Workflow succeeds but the app fails           | Do not mark the update complete. Keep the database and follow [setup troubleshooting](DEPLOYMENT.md#when-something-fails).                                                                                                                                                         |

## What happens after setup

- Cloudflare starts the workflow every six hours. The release is installed after its Cloudflare build succeeds; updates are not instant.
- Only published releases that passed our checks are installed. Everyday changes to the project's development files are not installed.
- Even when there is no new release, the tool republishes the current version about once a month
  to exercise the deployment connection. The automatic timer runs on Cloudflare.
- If Cloudflare fails to publish an update, later checks keep reporting that failure until it is fixed.
- Your saved website settings stay in place. If you have changed the app's files yourself, the tool
  stops rather than overwriting those changes.
- A failed build leaves the current website running. Changes already made to the database are not
  automatically undone; keep the database and follow the reported error rather than starting over.

To retry, use **Run workflow** on the same updater. To switch to manual updates, change
`WISHLIST_AUTO_UPDATE` to `false`, then remove the timer key from the terminal:

```sh
npm run installation:wrangler -- secret delete WISHLIST_UPDATE_CONFIG
```

The manual button still works. Let any running update finish first. To resume automatic updates,
repeat steps 16–28. The older separate installation-repository updater is legacy and has its
own [migration notes](INSTALLATION_UPDATES.md).

Platform references: [Cloudflare Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/),
[Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/),
[GitHub workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).
