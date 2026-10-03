# Set up your family's wishlist

This guide creates a private wishlist in **your own Cloudflare account**. You will get a free website
address, email-code sign-in and a wishlist for each invited family member. Cloudflare runs the app
and stores its database. Choose automatic or manual updates at the end of setup. You do not need
to know Cloudflare beforehand.

Follow the steps in order. Each numbered step has one action. Run each command separately and wait
for it to finish. If a command fails, stop at that step; see [When something fails](#when-something-fails).
You can close the terminal between steps. Keep the downloaded project folder so you can resume.

**Windows:** use PowerShell. **macOS:** use Terminal. **Linux:** use your terminal. The command blocks
below work in all three. On Windows, if PowerShell says `npm.ps1 cannot be loaded`, use Command Prompt
instead; these commands work there too. You do not need to change your computer's execution policy.
To open it on Windows, open Start and search for **PowerShell** or **Command Prompt**. On macOS,
press Command–Space, search for **Terminal**, then press Enter. Paste only the command inside a code
box, without the surrounding text or backticks.

An AI assistant can follow the same steps. Give it [these agent instructions](AGENT_INSTALLATION.md)
and the [starting prompt](../README.md#install-with-codex). You complete browser sign-in, account
consent, payment entry and email codes yourself. Keep API tokens out of chat.

A normal household is intended to fit Cloudflare's free plans. A domain and paid plan are optional.
Cloudflare may request payment details for **Zero Trust Free**, its sign-in service. Check that you
selected Free before agreeing. [Allowances and running costs](CLOUDFLARE_OPERATIONS.md#what-cloudflare-provides).

## Get the tools and project

### 1. Install Node.js

Download and run the **Node.js 24 LTS** installer from [nodejs.org](https://nodejs.org/en/download).
Keep npm enabled in the installer. If you already have Node.js 22.22 or newer, you can use it.

**Done when:** the installer finishes. Open a new terminal after installing.

### 2. Install Git

Use the installer for your operating system from [git-scm.com](https://git-scm.com/downloads).
On Windows, the default installer choices are sufficient for this guide.

**Done when:** the installer finishes. Close and reopen your terminal so it can find Git.

### 3. Create your GitHub copy

Open [Fork this project](https://github.com/JonReed/cloudflare-family-wishlist/fork), sign in to
GitHub and choose **Create fork**, copying only `main`. Keep the repository name
`cloudflare-family-wishlist`. This copy receives future tested releases for your household.

**Done when:** the repository address starts with your GitHub username.

### 4. Download your copy

Replace `YOUR-GITHUB-NAME` with the username shown on your fork, then run:

```sh
git clone https://github.com/YOUR-GITHUB-NAME/cloudflare-family-wishlist.git
```

**Done when:** a folder named `cloudflare-family-wishlist` exists. If it already exists from an
interrupted setup, keep it and continue there; do not clone over it.

### 5. Open that folder in the terminal

```sh
cd cloudflare-family-wishlist
```

**Done when:** the terminal prompt ends in `cloudflare-family-wishlist`. Run every remaining command
from this folder. An AI assistant should use the same folder as its workspace.

### 6. Install the project's tools, including Wrangler

```sh
npm ci
```

This installs the tested Wrangler version and prepares the application's generated types. Wrangler
is Cloudflare's tool for deploying this project and managing its database.

**Done when:** the command finishes without an error. The guide uses `npx wrangler` to select the
project's tested version. A separate [global Wrangler installation](#optional-global-wrangler-installation)
is optional.

### 7. Install Cloudflare's wider CLI

```sh
npm install --global cf@1.0.0-beta.12
```

The `cf` CLI manages Cloudflare account resources, including the sign-in rules. This is the beta
version checked for this guide on 3 October 2026. [Official CLI instructions](https://developers.cloudflare.com/cf/get-started/).

**Done when:** installation succeeds. If npm reports `EACCES` or a permission error, follow
[npm's global-install permission repair](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally/),
then repeat this step. Reinstalling the same macOS/Linux system installer may keep the same error.

## Choose your Cloudflare account

### 8. Create a Cloudflare account

Open [Cloudflare account signup](https://dash.cloudflare.com/sign-up) in your browser.
If you have an account, [sign in](https://dash.cloudflare.com/login) instead.

**Done when:** you can see the account dashboard. Use the account that should own your family's data.

### 9. Finish Workers onboarding

Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
Select your household account. If asked, choose the account's free `workers.dev` subdomain.
This becomes part of your website address.

**Done when:** Workers & Pages opens for that account. You do not need to create a Worker in the
browser; the deployment command will do that.

### 10. Sign Wrangler in

```sh
npx wrangler login
```

Approve the request in the browser using the account from step 8.

**Done when:** Wrangler reports that you are logged in.

### 11. Check the account Wrangler can use

```sh
npx wrangler whoami
```

Find your intended account in the output. Keep its **Account ID** handy: it is a 32-character value,
not your email address or account name. If the account is absent, repeat step 10 with the correct login.

**Done when:** your intended account appears. If several accounts appear, step 13 will explicitly
select one; setup does not assume the first is correct.

### 12. Sign `cf` in

```sh
cf auth login
```

Approve the browser request using the same Cloudflare login. `cf` keeps separate credentials from
Wrangler, so completing step 10 does not complete this step.

**Done when:** `cf` reports a successful login. If `cf` opens Cloud Foundry instead, use `cloudflare auth login`;
the Cloudflare npm package installs both command names.

## Create and check the app

### 13. Save your household settings and create its database

```sh
npm run setup:config
```

Paste the Account ID from step 11 when asked. Choose an unused app name, for example
`reed-family-wishlist`, or press Enter for `family-wishlist`. The command shows the selected account
before asking to create its database. Type `yes` only when it is correct.

If a database with that name already exists, the command shows its ID and asks before reusing it.
If this is a different project, stop and choose a different name. On a resumed setup, saved settings
must still match the live database.

**Done when:** it reports that household settings are saved and the database identity is verified.
The command writes the configuration for you; you do not edit `wrangler.jsonc` or copy database IDs.

### 14. Check the application

```sh
npm run quality
```

**Done when:** formatting, linting, types, tests and the production build all pass.

### 15. Check dependencies

```sh
npm run audit
```

**Done when:** the audit succeeds. If it fails, keep the error and stop; do not use `npm audit fix --force`
as a setup step.

### 16. Deploy

```sh
npm run deploy
```

Approve applying the database migrations if Wrangler asks. The command builds the app, applies
pending migrations to the selected database, then deploys the Worker. A Worker is simply the app
running on Cloudflare.

**Done when:** deployment succeeds and prints an `https://...workers.dev` address. Keep that address.
The site deliberately refuses to open until sign-in is configured; do not try to log in yet.

### 17. Check the database used by the deployed app

```sh
npm run setup:check -- --before-login
```

**Done when:** the database, migrations, first-login schema and deployed database identity checks pass.
The output will say Access setup is still required. That is expected at this stage.

## Set up private sign-in

### 18. Create a Zero Trust Free organisation

Open [Cloudflare Zero Trust](https://one.dash.cloudflare.com/). Choose the same account as step 11.
Follow the onboarding screens: choose a team name and select **Free**. Complete any account consent
or payment-details request yourself. You do not need to install WARP or the Cloudflare One Client.

**Done when:** the Zero Trust dashboard opens for that account.
[Cloudflare's onboarding instructions](https://developers.cloudflare.com/cloudflare-one/setup/).

### 19. Configure email-code sign-in

```sh
npm run setup:access-app
```

Enter the exact email address you will use as organiser, then paste the site address from step 16.
Review the displayed account and app name before typing `yes`.

The command uses `cf` to find your deployed app, enable one-time PIN if needed, and create or verify
Access protection for **all traffic** to that Worker. Only exact family email addresses are admitted.
It saves the IDs privately for the next command; you do not find an audience tag in the dashboard.

**Done when:** it reports that exact-email Worker protection is verified. If existing rules conflict,
it stops and identifies the problem rather than replacing them. Keep those resources while investigating.

### 20. Create the token used for family invitations

Open [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens), choose **Create Token**,
then **Create Custom Token**. Name it `Family Wishlist invitations`.

Set **Permissions** to **Account → Access: Apps and Policies → Edit**. Set **Account Resources** to
**Include → Specific account → your household account**. Continue to the summary and create the token.

**Done when:** Cloudflare displays the new token. Keep that page open for step 21. Do not paste the
token into chat, a command argument or a project file. The app keeps it as an encrypted Worker secret.
[Cloudflare's token instructions](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

### 21. Finish the app's sign-in configuration

```sh
npm run setup:access -- .private/access-setup.json
```

Paste the token into the terminal's **hidden input** prompt and press Enter. Nothing appearing while
you paste is expected. An AI assistant should let you enter it yourself, or use an already authorised
secret store.

The command rechecks the database and exact sign-in rules, sets the 30-day session, configures the
three public viewing-link paths, and installs all six app settings together. It obtains the correct
Access audience directly from Cloudflare. No `export`, `read -s` or `unset` commands are needed.

**Done when:** the infrastructure checks pass. This still needs a real browser login in step 22.

## Try it with your family

### 22. Sign in as the organiser

Open the site address from step 16 in a private/incognito browser window. Enter the exact organiser
email from step 19 and enter the emailed Cloudflare code yourself.

**Done when:** your empty wishlist appears. If you see “Something went a bit wonky”, follow the recovery
instructions below; do not disable sign-in protection.

### 23. Invite one person

In the app, open **Manage** and add one trusted person's name and exact email address.

**Done when:** they appear as **Not signed in yet** and their wishlist is available. Use **Copy
invitation** to share the address privately with them. The app does not send an invitation email itself.

### 24. Add a wish to their list

Choose the invited person's list and add a test wish before they sign in.

**Done when:** the wish appears on their list.

### 25. Have that person sign in

Ask them to open the invitation and sign in with their own email code.

**Done when:** they have the same wishlist and test wish, and **Manage** shows **Joined**.

### 26. Check that a claim stays secret

On their test wish, choose **I’ll get this** while signed in as yourself. Have them refresh their list.

**Done when:** you can see your claim and they cannot.

### 27. Check that a purchase stays secret

On that test wish, choose **Mark as bought** while signed in as yourself.

**Done when:** you can see it is bought, and they still cannot see the purchase state after refreshing.

### 28. Check a public viewing link

On the test list, choose **Share this list**. In **Manage**, check that the test list is selected,
name the link `Setup test`, choose **Create sharing link**, then copy it.

**Done when:** that copied link opens in a signed-out private browser without login and has no
editing or gift-claim controls.

### 29. Stop sharing the test link

In **Manage**, find `Setup test`, choose **Stop sharing this link**, then confirm with
**Yes, stop sharing this link**.

**Done when:** the old link no longer opens the list in a signed-out browser.

### 30. Check that another email cannot enter

Try an email address you control that has not been invited, using a signed-out private browser.

**Done when:** that address cannot reach the family lists. Cloudflare's login screen may give a generic
response; receiving an email alone is not evidence of admission.

### 31. Choose how to update

- **Automatic:** complete [automatic update setup](AUTOMATIC_UPDATES.md). Verify its first Cloudflare
  build and explicitly enable the schedule.
- **Manual:** follow [manual update setup](MANUAL_UPDATES.md). Leave the schedule off and bookmark
  the instructions for each release. You can use GitHub or deploy from your computer.

**Done when:** you have chosen an option, completed its setup and know how you will receive releases.
A working site alone does not prove that automatic updates are enabled.

The installation is complete after the app checks and your chosen update setup pass. Add other family members through
**Manage**. [Everyday use](USER_GUIDE.md) explains adding wishes, sharing lists and saving from a phone.

## When something fails

Keep the project folder and existing Cloudflare resources. Fix the failed step and repeat it.
The setup commands inspect saved and live state before proceeding. A failed deployment does not
undo database migrations; do not delete the database to start over.

| What you see                                          | What to do next                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm.ps1 cannot be loaded` on Windows                 | Open Command Prompt, enter the project folder with `cd`, then run the same command.                         |
| `node`, `npm` or `git` is not recognised              | Complete steps 1–2, close the terminal and open a new one.                                                  |
| `cf` is not recognised                                | Repeat step 7, then open a new terminal.                                                                    |
| `Wrangler is not signed in to the selected account`   | Repeat steps 10–11; use the intended account ID.                                                            |
| Database creation was interrupted                     | Rerun step 13. It checks whether that database was created before offering another create.                  |
| Missing installation settings or invalid placeholders | Run step 13. The old example JSON is not a working configuration.                                           |
| Deployed app uses a different D1 database             | Check the household settings, rerun step 16, then repeat step 17.                                           |
| No such table / no such column / pending migrations   | Run the migration command below, then repeat step 17.                                                       |
| `cf` cannot read Zero Trust                           | Check step 18 and repeat step 12. Wrangler login does not sign `cf` in.                                     |
| Existing Access configuration conflicts               | Stop and inspect the application named in the error. Do not create another or broaden the email rule.       |
| Token request gets 401 or 403                         | Check step 20's permission and specific account. Enter the corrected token at step 21.                      |
| “Authentication is not configured”                    | Finish steps 19–21 before trying to sign in.                                                                |
| “Something went a bit wonky” after the email code     | Run the two read-only checks below. A missing migration or wrong database can cause the first page to fail. |

Migration repair, using the saved household database:

```sh
npm run db:migrate:remote
```

Read-only database/deployment check:

```sh
npm run setup:check
```

Read-only Access check (enter the same scoped token privately when asked):

```sh
npm run setup:access -- .private/access-setup.json --check
```

If those pass but login still fails, [open your Worker](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
and inspect **Logs** for the failed request. Share the error type and step number with your assistant
or maintainer. Keep tokens, email codes, Access assertions, family data and sharing-link secrets out
of reports. The generic “wonky” message alone does not identify the cause.

Use `npm run db:migrate:remote` with this version of the project. Its Windows launcher has been fixed.
A bare `npx wrangler d1 migrations apply DB --remote` does not select the generated household config.
If troubleshooting with Wrangler directly, use the installation wrapper:

```sh
npm run installation:wrangler -- d1 migrations apply DB --remote
```

## Updates and optional features

Choose automatic or manual release updates in step 31. A custom domain remains optional.
Already installed using the old guide? Keep [updating manually](MANUAL_UPDATES.md), or
[enable automatic updates](REPAIR_UPDATES.md).

- [Back up and update your installation](BACKUP_RESTORE_UPGRADE.md).
- [Automatic updates](AUTOMATIC_UPDATES.md), [manual updates](MANUAL_UPDATES.md) and [optional custom domains](CLOUDFLARE_OPERATIONS.md#add-a-custom-domain-optional).
- [Cloudflare allowances and optional product-import services](CLOUDFLARE_OPERATIONS.md#what-cloudflare-provides).
- [Installation settings](INSTALLATION_CONFIG.md), if you need to move or restore the setup computer.

### Optional global Wrangler installation

If you also want a standalone `wrangler` command outside this project, install the checked version:

```sh
npm install --global wrangler@4.147.0
```

Continue using `npx wrangler` inside this project so its lockfile selects the version.

The commands and failure checks have local automated coverage. A fresh-account walkthrough on
Windows, macOS and Linux is still required before claiming the complete journey works on each.
[FRESH_DEPLOYMENT_ACCEPTANCE.md](FRESH_DEPLOYMENT_ACCEPTANCE.md) defines that check.
