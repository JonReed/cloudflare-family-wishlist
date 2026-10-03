# Instructions for the assistant installing Family Wishlist

Use [the setup guide](DEPLOYMENT.md) as the shared human/agent sequence. Take one step at a time,
check its result, then continue. Do the terminal work yourself when tools are available. Ask the
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
  viewing-link exceptions on free plans, create or use their GitHub fork, connect that existing Worker
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

## Use the tools installed for this project

Run each command separately from the checkout. There are no shell-specific exports, hidden Bash
reads, command substitutions, pipelines or backslash line continuations in the normal flow.
The same command blocks work in PowerShell, Command Prompt and Unix terminals.

| Purpose                                          | Command                                 | Required result                                                                |
| ------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| Install project tools, including pinned Wrangler | `npm ci`                                | Dependencies and generated types complete                                      |
| Optional global Wrangler installation            | `npm install --global wrangler@4.147.0` | Standalone Wrangler installed                                                  |
| Install the checked Cloudflare CLI beta          | `npm install --global cf@1.0.0-beta.12` | Cloudflare `cf` installed                                                      |
| Authenticate Wrangler                            | `npx wrangler login`                    | Owner completes browser consent                                                |
| Inspect Wrangler identity                        | `npx wrangler whoami`                   | Intended account ID appears                                                    |
| Authenticate the wider API CLI                   | `cf auth login`                         | Owner completes its separate browser consent                                   |
| Inspect `cf` identity if needed                  | `cf auth whoami`                        | Correct login; later resource commands explicitly select the household account |

Retrieve current official docs if an installed command differs:
[Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/),
[`cf` installation and credential order](https://developers.cloudflare.com/cf/get-started/),
[`cf` resource commands](https://developers.cloudflare.com/cf/get-started/resources/).

`cf` remains beta. It can manage API resources alongside this Wrangler project. Do not run `cf migrate`,
`cf init` or replace the Vite/build/deployment configuration during installation. Use `npm run deploy`
for the application; use `cf` for Access resources. The CLIs do not share login credentials.

## Start from released source

Follow setup steps 3–5c: create an empty household GitHub repository, clone the upstream `stable`
branch, rename the local branch to `main`, select the household remote and push normally. Do not
fork or sync upstream `main` for installation. Existing installations use [UPDATES.md](UPDATES.md),
which fast-forwards released source while preserving their saved settings and refuses conflicts.
Do not downgrade an older development installation if it is newer than the latest release.

## Prepare the database and deploy

### A. Prepare household settings

```sh
npm run setup:config
```

Run in an interactive terminal. Supply the approved account ID and Worker name. The command verifies
Wrangler access to that account, selects it explicitly for database operations, lists D1 databases,
then creates or explicitly reuses one. It reads the UUID from the live JSON response and writes the
ignored installation file. It never edits shared `wrangler.jsonc`.

Do not accept reuse based on a name alone: compare the displayed account and UUID with the owner's
intended resource or the existing private record. A saved mismatch must stop setup. On an interrupted
create, rerun the command so it discovers the live database before trying another create.

Before the first deploy, ensure the chosen Worker name is unused or explicitly belongs to the
installation being resumed:

```sh
npm run installation:cf -- workers scripts search --name family-wishlist
```

Replace `family-wishlist` with the approved name. This API search includes partial matches; compare
`script_name` exactly. Do not deploy over an unrelated Worker. The wrapper explicitly sets the account
from installation settings, including when the login can access several accounts.

For tools that cannot run interactive prompts, an agent may create D1 with `cf` using the approved
account in the tool's environment, capture its JSON result, then write these four fields to
`.wishlist-installation.json`:

```json
{
  "accountId": "32-character account ID",
  "workerName": "approved-worker-name",
  "databaseId": "D1 UUID returned by Cloudflare",
  "databaseName": "approved-database-name"
}
```

Those strings describe required values; they are not usable defaults. Write actual verified values,
then run `npm run installation:configure`. Never ask a human to repair this JSON to make the agent's
commands work. A complete `WISHLIST_INSTALLATION` build override takes precedence over the file;
use one installation source at a time.

### B. Run the quality gate

```sh
npm run quality
```

Stop on a failure. Do not skip tests to make deployment appear successful.

### C. Run the dependency gate

```sh
npm run audit
```

Stop on a failure. Do not change dependencies with `audit fix --force` during setup.

### D. Deploy the approved Worker

```sh
npm run deploy
```

The command verifies the built account, Worker and D1 target, applies pending migrations, then deploys
with `--keep-vars`. Record the actual address printed. Do not manually apply SQL to the maintainer's
reference account. A successful migration is not undone by a later deployment failure.

### E. Verify first-login database readiness

```sh
npm run setup:check -- --before-login
```

Require no pending migrations, readable member/wishlist/invitation tables including
`members.first_signed_in_at`, and the intended D1
UUID on every traffic-bearing Worker version. The site should still fail closed before Access
configuration. That intermediate state is not a completed installation.

## Configure sign-in

### F. Have the owner complete Zero Trust Free onboarding

Give them [this direct link](https://one.dash.cloudflare.com/) and the exact selected account.
They choose a team name, **Free**, and complete any account consent/payment entry. No WARP client is
required. Verify that the organisation exists before continuing. Do not change an existing team's
name or settings merely to fit an example.

### G. Create or verify Worker-level email-code protection

```sh
npm run setup:access-app
```

In an interactive terminal, supply the approved organiser email and actual deployed address. This
command uses the installed `cf` with the saved account explicitly selected. It reads all resource
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

For non-interactive tools, use the same `cf` resource operations through the installation wrapper.
Discover a changed beta command with an anonymous resource/action query, inspect its help/schema,
then preview its request before an authorised write:

```sh
cf cli search "create Access application for a Worker"
```

```sh
cf schema zero-trust access applications create
```

Read operations used by the setup command:

```sh
npm run installation:cf -- zero-trust organization get
```

```sh
npm run installation:cf -- zero-trust identity-providers list --page 1 --per-page 100
```

```sh
npm run installation:cf -- zero-trust access applications list --page 1 --per-page 100
```

Continue pages until the list is complete. Never conclude that an app is absent from only its first
page. Create only absent, approved resources. For request bodies, write non-secret JSON privately
and pass `--body @.private/request.json`, avoiding shell-specific quoting. The exact app body is built
by `accessApplicationBody()` in `scripts/setup-access-application.ts`; use it as the shared contract,
not a remembered API signature. Check the installed `cf` help and official
[Worker Access API examples](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#protect-one-worker).

After verified readback, save this **non-secret** setup file using actual values:

```json
{
  "applicationId": "verified Access application UUID",
  "workerId": "verified 32-character Worker ID",
  "teamDomain": "actual-team.cloudflareaccess.com",
  "hostname": "actual-worker.actual-subdomain.workers.dev",
  "organiserEmail": "the owner's exact email",
  "otpId": "verified onetimepin provider UUID"
}
```

Store it at `.private/access-setup.json`. Do not confuse the application UUID with the audience tag,
the Worker name with its ID, or the OTP provider type with its UUID. The next command reads the
Access audience itself.

### H. Have the owner create the scoped invitation token

Give them [the token page](https://dash.cloudflare.com/profile/api-tokens) and these exact choices:
**Create Token → Create Custom Token**, permission **Account → Access: Apps and Policies → Edit**,
resource **Include → Specific account → the approved household account**.

The token is separate from either CLI's login. Do not store the broad setup login as the application's
runtime token. Let the owner keep the token page open for the next private terminal prompt.

### I. Finish configuration and verify it before first login

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

## Verify what the owner actually experiences

Follow setup guide steps 22–30, then complete step 31 for the chosen update mode. For automatic
updates, require [update verification](AUTOMATIC_UPDATES.md); for manual updates, record the chosen
procedure and confirm the schedule is off. Require observed organiser login, invitation, a wish prepared before
first login, invited-member login to that same list, hidden claims/purchases, public sharing and
revocation, and denial of an unrelated email. The owner/testers enter their own codes.

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

## Leave a resumable handoff

Keep a private note at `.private/INSTALLATION_PROGRESS.md` with the source commit, selected account,
Worker name/ID, D1 name/ID, hostname, Access application/provider IDs and completed step numbers.
Record the dated result of each check and the next action. Never put tokens, OTPs, assertions, raw
sharing links, family records or exports in it.

On resumption, verify live IDs before repeating creates. Treat conflict or ambiguous pagination as
a reason to investigate, not a reason to create duplicates or delete resources.

End with the site address, source version, verified checks, outstanding checks and how to invite
family. Record the chosen update mode. For GitHub updates, record the household repository, first
successful updater run and matching Cloudflare build. For automatic mode, also record the explicit
`WISHLIST_AUTO_UPDATE=true` setting; mention any unobserved scheduled run. For terminal-only manual
mode, hand over [MANUAL_UPDATES.md](MANUAL_UPDATES.md) and confirm the owner has their checkout,
installation settings and release notifications. Manual mode does not require an automatic update
connection. Never report a successful Git push as a verified live deployment.
