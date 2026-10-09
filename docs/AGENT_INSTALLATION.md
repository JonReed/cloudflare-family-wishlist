# Instructions for the assistant installing Family Wishlist

The assistant operates the terminal and browser; the owner should not have to translate instructions
or find resource IDs. Follow the numbered sequence below, check each result, then continue. Ask the
owner to act only for missing account choices, sign-in, service consent, payment entry, secret entry
or browser email codes. Do not send them a collection of Cloudflare concepts to interpret.

## Before creating anything

Determine whether this is a new installation, a resumed setup or an upgrade. For an upgrade, use
[BACKUP_RESTORE_UPGRADE.md](BACKUP_RESTORE_UPGRADE.md), not resource creation.

For installation, obtain only these missing decisions:

- the Cloudflare account that should own the app;
- the organiser's exact sign-in email;
- an unused Worker name (default `family-wishlist`);
- automatic or manual release updates; and
- approval to create this household's Worker, D1 database, exact-email Access application and narrow
  viewing-link exceptions on free plans, create or use their GitHub repository, connect that existing Worker
  to Builds if wanted, and enable scheduled updates only if they chose automatic updates.

Use `workers.dev` and respect the chosen update mode. Manual mode is a complete supported setup;
hand over [the repeatable update instructions](MANUAL_UPDATES.md). Offer a custom domain
only after sign-in works and if the owner wants it. Do not infer the household account from the Git
remote, existing maintainer credentials or a browser session. Do not alter paid plans, unrelated
resources, DNS or account-wide protection.

Inspect `.wishlist-installation.json` and `.private/access-setup.json` if present. Do not print tokens
or `.env` files. Check whether credential/account environment overrides are set without displaying
secret values. `CLOUDFLARE_API_TOKEN` takes precedence over CLI profiles; do not assume that a new
browser login changes the active token. Saved settings and live resource IDs must agree.

Once the owner has authorised the resources above, continue within that scope. The commands' `yes`
prompts are target checks; an agent can answer them after comparing the account and resource to the
approved plan. They do not require repeated permission requests.

## 1. Check tools and capture the approved plan

Check available tools yourself. Install missing [Node.js 24 LTS](https://nodejs.org/en/download),
[Git](https://git-scm.com/downloads) and, if using terminal GitHub operations,
[GitHub CLI](https://cli.github.com/). Use the owner’s browser instead if GitHub CLI is unavailable.
Do not ask the owner to install tools that already work. Windows PowerShell restrictions on `npm.ps1`
can be avoided by running the same commands in Command Prompt.

Record the approved account, organiser email, Worker name and update choice in
`.private/INSTALLATION_PROGRESS.md` in the installation folder once it exists. Record completed
checks and the next action after each stage. Do not put tokens, codes, family records or sharing
links in this note. Inspect existing settings before deciding this is a new installation.

**Done when:** Node 24 (or at least 22.22), npm and Git are available, the owner has approved the
household target and resource scope, and you know whether this is a new install or a resumption.

## 2. Download released code

For a new install, run in the parent folder where the owner wants the project stored:

```sh
git clone --branch stable --single-branch https://github.com/JonReed/cloudflare-family-wishlist.git
```

**Done when:** the new folder exists. If it already exists, inspect it and resume; never delete it.

## 3. Select the installation folder

```sh
cd cloudflare-family-wishlist
```

**Done when:** this is the agent's working directory. Run all remaining terminal commands here.

## 4. Name the household branch

For a new clone only:

```sh
git branch -m main
```

**Done when:** the household branch is `main`, containing released source. Never sync upstream
`main` to obtain installer changes. For upgrades, use [UPDATES.md](UPDATES.md).

## 5. Install the project tools

```sh
npm ci
```

**Done when:** dependencies and generated types complete. This installs the project's Wrangler;
no global Wrangler is required. If one is wanted, its separate optional installation command is:

```sh
npm install --global wrangler@4.147.0
```

## 6. Install the Cloudflare API CLI

```sh
npm install --global cf@1.0.0-beta.12
```

**Done when:** the installation succeeds. Use this CLI for resource setup, and the project's
Wrangler for deployment. Do not run `cf init` or `cf migrate` during installation.

## 7. Sign Wrangler in

```sh
npx wrangler login
```

**Done when:** the owner completes browser consent and Wrangler reports success. Reuse an existing
verified login instead of prompting again. Never expose credential environment values.

## 8. Verify the account

```sh
npx wrangler whoami
```

**Done when:** the approved account appears. The agent records its ID as `ACCOUNT_ID` for step 10.
If there are multiple accounts, resolve the owner's choice; do not pick the maintainer's account.
A `CLOUDFLARE_API_TOKEN` override takes precedence over browser login and must be accounted for.

## 9. Sign the API CLI in

```sh
cf auth login
```

**Done when:** the owner completes its separate consent and the command succeeds. Wrangler and
`cf` do not share logins. Reuse verified credentials on resumption. If an installed beta command
changes, consult [Cloudflare's CLI reference](https://developers.cloudflare.com/cf/get-started/).

## 10. Prepare household settings

The agent substitutes `ACCOUNT_ID` with the approved ID from step 8 and `WORKER_NAME` with the
approved unused name. These are non-secret identifiers. `--yes` uses approval already obtained;
it does not authorise an unrelated account or resource.

```sh
npm run setup:config -- --account-id ACCOUNT_ID --worker-name WORKER_NAME --yes
```

**Version check:** these explicit-input flags were added after v1.1.1. On v1.1.1, run
`npm run setup:config` in the agent's interactive terminal and answer the prompts itself. Check
`npm run setup:config -- --help` if unsure. Do not switch to development `main` or invent API calls.
If the agent has no interactive terminal and the installed release lacks these flags, report that
capability limit rather than asking the owner to hand-write configuration JSON.

The command verifies Wrangler access to that account, selects it explicitly for database operations, lists D1 databases,
then creates or explicitly reuses one. It reads the UUID from the live JSON response and writes the
ignored installation file. It never edits shared `wrangler.jsonc`.

Do not accept reuse based on a name alone: compare the displayed account and UUID with the owner's
intended resource or the existing private record. A saved mismatch must stop setup. On an interrupted
create, rerun the command so it discovers the live database before trying another create.

The command checks for an existing Worker before creating a new installation. In explicit-input
mode, an already-existing database is not silently adopted. After verifying it belongs to this
household, the agent can repeat step 10 with `--reuse-database-id DATABASE_UUID`, replacing
`DATABASE_UUID` with the exact verified live ID. That option refuses to create a replacement if
the specified database is absent. A saved installation is checked against live state on every run.
Use `--database-name DATABASE_NAME` only when the approved database name differs from the Worker.

**Done when:** `.wishlist-installation.json` exists with verified account, Worker and database IDs,
and the command reports success. Do not edit shared `wrangler.jsonc` or maintain parallel settings.

## 11. Run the quality gate

```sh
npm run quality
```

**Done when:** all checks pass. Stop on failure; do not skip tests to make deployment appear successful.

## 12. Run the dependency gate

```sh
npm run audit
```

**Done when:** the audit passes. Stop on failure; do not change dependencies with `audit fix --force`.

## 13. Deploy the approved Worker

```sh
npm run deploy
```

The command verifies the built account, Worker and D1 target, applies pending migrations, then deploys
with `--keep-vars`. Record the actual address printed. Do not manually apply SQL to the maintainer's
reference account. A successful migration is not undone by a later deployment failure.

**Done when:** deployment succeeds and its actual site address is recorded privately.

## 14. Verify first-login database readiness

```sh
npm run setup:check -- --before-login
```

Require no pending migrations, readable member/wishlist/invitation tables including
`members.first_signed_in_at`, and the intended D1
UUID on every traffic-bearing Worker version. The site should still fail closed before Access
configuration. That intermediate state is not a completed installation.

**Done when:** every before-login infrastructure check passes.

## 15. Complete Zero Trust Free onboarding

Give them [this direct link](https://one.dash.cloudflare.com/) and the exact selected account.
They choose a team name, **Free**, and complete any account consent/payment entry. No WARP client is
required. Verify that the organisation exists before continuing. Do not change an existing team's
name or settings merely to fit an example.

**Done when:** the approved account has a Zero Trust organisation. Reuse an existing one.

## 16. Configure email-code sign-in

Replace `ORGANISER_EMAIL` with the approved exact email and `HOSTNAME` with the host from step 13
(for example `family-wishlist.example.workers.dev`, without a path).

```sh
npm run setup:access-app -- --organiser-email ORGANISER_EMAIL --hostname HOSTNAME --yes
```

On v1.1.1 use `npm run setup:access-app` in the agent's interactive terminal; the explicit-input
flags were added later. The account comes from the verified settings saved in step 10.
This command uses the installed `cf` with the saved account explicitly selected. It reads all resource
pages, finds the exact Worker ID, reuses or creates one `onetimepin` identity provider, then reuses or
creates one self-hosted Access application. It verifies the application and attached policies and
writes `.private/access-setup.json`.

Its required configuration is:

- one destination `{ "type": "worker", "worker_id": "the verified Worker ID" }`, protecting production
  and previews; no `preview_worker`, `all_workers` or unrelated destinations;
- only the verified one-time PIN provider in `allowed_idps`;
- `session_duration: "720h"`, HttpOnly cookies and SameSite `lax`; and
- Allow policies containing exact emails only, including the organiser, with no shorter policy session.

On existing mismatches, stop and explain the precise conflicting resource. Do not widen or rewrite
an admission rule to get through setup.

**Done when:** the command reports verified protection and writes `.private/access-setup.json`.
The agent must not assemble API payloads or copy application IDs by hand. Existing saved email,
hostname and live resource identities must match; a conflict stops the command before replacement.

## 17. Create the scoped invitation token

Give them [the token page](https://dash.cloudflare.com/profile/api-tokens) and these exact choices:
**Create Token → Create Custom Token**, permission **Account → Access: Apps and Policies → Edit**,
resource **Include → Specific account → the approved household account**.

The token is separate from either CLI's login. Do not store the broad setup login as the application's
runtime token. Let the owner keep the token page open for the next private terminal prompt.

**Done when:** the owner has the scoped token ready privately. Do not request it in chat.

## 18. Finish sign-in configuration

```sh
npm run setup:access -- .private/access-setup.json
```

The owner enters the token in the hidden terminal prompt. When an authorised secret store already
supplies it, the command can read `ACCESS_MANAGEMENT_API_TOKEN` from that process environment.
Never place a token in a command argument, echoed pipeline, checklist or tool output.

This command rechecks database readiness and exact Access rules, configures the 30-day session and
narrow sharing exceptions, then sends all six runtime values to Wrangler over stdin in one bulk
secret request. It does not write a secret file. It finally runs the full infrastructure checks,
including the Access API checks. It is suitable for resuming a partially completed configuration.

The public exception is exactly `/shared/*`, `/shared-assets/*` and `/favicon.svg` for the selected
hostname. Do not expose `/assets/*`, private pages, the generic image proxy or whole domains.

**Done when:** the command verifies the database, Access settings and all six runtime values. If
there is no secure input channel, pause for one; never expose the token to avoid that pause.

## 19. Verify what the owner actually experiences

Run these checks in order in the deployed app. Each person enters their own email codes; the agent
can operate the remaining browser controls. Ask the owner to perform a check only when the agent
cannot access that browser session.

1. Open the site in a private browser and sign in as the organiser. **Done when:** their wishlist appears.
2. In **Manage**, add one approved test family member by exact email. **Done when:** the list exists and says **Not signed in yet**.
3. Add a test wish to that member's list. **Done when:** the wish appears before they sign in.
4. Have that member sign in. **Done when:** the same list and wish appear and **Manage** says **Joined**.
5. As the organiser, choose **I’ll get this** on the test wish. **Done when:** the organiser sees the claim but its owner does not after refreshing.
6. Choose **Mark as bought** on that wish. **Done when:** only the gift-giver sees its purchase state.
7. In **Manage → Sharing**, create a link for the test list. **Done when:** it opens signed out without wish-editing controls and allows guest reservations.
8. Stop sharing that link in **Manage**. **Done when:** the old link no longer opens the list.
9. Try an uninvited email controlled by a tester. **Done when:** it cannot reach family lists.

Record each actual result, including checks awaiting another person's participation. Do not keep
an agent running for hours waiting for a tester or GitHub's first scheduled event. Leave a precise
resumption checkpoint instead of marking the unchecked behaviour as passed.

## 20. Create the household repository

For GitHub updates, open [Create repository](https://github.com/new) in the owner's account. Create
`cloudflare-family-wishlist` with no README, licence or .gitignore. Use the owner's chosen visibility;
recommend Private. The agent can use an authenticated GitHub CLI instead of the browser if available.
On resumption, reuse the verified existing repository.

**Done when:** the empty repository exists in the approved household account. For terminal-only
manual updates, skip steps 20–23; keep the schedule off and hand over [MANUAL_UPDATES.md](MANUAL_UPDATES.md).

## 21. Select the upload destination

Replace `YOUR-GITHUB-NAME` with the confirmed owner from step 20. In the installation folder, run:

```sh
git remote set-url origin https://github.com/YOUR-GITHUB-NAME/cloudflare-family-wishlist.git
```

**Done when:** the remote points to the household's repository, not the maintainer's.

## 22. Upload released source

```sh
git push -u origin main
```

**Done when:** the owner's GitHub repository contains the released files on `main`. On rejection,
inspect the remote changes; never force-push. Let the owner complete GitHub sign-in if requested.

## 23. Connect and verify updates

The assistant performs [automatic update setup](AUTOMATIC_UPDATES.md), using the already-deployed
Worker and saved settings. That single numbered checklist covers the Cloudflare build connection,
commands, token permissions and update verification for both GitHub modes. Do not send the owner
away to perform the checklist; operate the browser yourself where available. Manual GitHub mode
skips steps 16 and 18 of that guide. Only enable the schedule for an owner who chose automatic updates.

**Done when:** the first manual updater run and its matching Cloudflare build pass and the chosen
automatic/manual setting is verified. For automatic mode, separately record the first real `schedule`
event when it arrives. It may take hours; a manual run is not scheduled-delivery proof. Leave that
check pending in the handoff without keeping the owner waiting for the scheduler.

## If a check fails

A successful build or infrastructure check does not prove that OTP login works. Report incomplete
browser checks explicitly. Do not diagnose “Something went a bit wonky” from the message alone.

For a reported first-login failure, first run:

```sh
npm run setup:check
```

Then, with private token input:

```sh
npm run setup:access -- .private/access-setup.json --check
```

Inspect Worker logs only if those checks do not explain the failure. Report the failing layer and
next action, omitting assertions, token values, sensitive query strings and family data. On this
version, `npm run db:migrate:remote` launches the installed Wrangler JS with Node on every OS;
a bare Wrangler migration command can bypass installation settings and must not be offered as a
Windows workaround.

## 24. Leave a resumable handoff

Keep a private note at `.private/INSTALLATION_PROGRESS.md` with the source commit, selected account,
Worker name/ID, D1 name/ID, hostname, Access application/provider IDs and completed step numbers.
Record the dated result of each check and the next action. Never put tokens, OTPs, assertions, raw
sharing links, family records or exports in it.

On resumption, verify live IDs before repeating creates. Treat conflict or ambiguous pagination as
a reason to investigate, not a reason to create duplicates or delete resources.

End with the site address, source version, verified checks, outstanding checks and how to invite
family. **Done when:** the owner has the site address, an honest check summary and the next action, if any.
Record the chosen update mode. For GitHub updates, record the household repository, first
successful updater run and matching Cloudflare build. For automatic mode, also record the explicit
`WISHLIST_AUTO_UPDATE=true` setting; mention any unobserved scheduled run. For terminal-only manual
mode, hand over [MANUAL_UPDATES.md](MANUAL_UPDATES.md) and confirm the owner has their checkout,
installation settings and release notifications. Manual mode does not require an automatic update
connection. Never report a successful Git push as a verified live deployment.
