# Installation settings

Application source and household settings are separate. Updating shared code must not require
merging a family's Cloudflare identifiers back into `wrangler.jsonc`.

## What goes where

- `wrangler.jsonc` contains the shared entry point, compatibility flags, binding names, migration
  directory, observability and product defaults. Its D1 ID is deliberately local-only.
- `.wishlist-installation.json` contains one installation's account ID, Worker name, D1 ID and name.
  It is ignored by Git. Start from `installation.example.json`; replace its invalid placeholders.
- `WISHLIST_INSTALLATION` is the build-environment equivalent: the complete JSON object as one text
  variable. It takes precedence over the local file as a whole, never field by field.
- `wrangler.installation.json` is generated and ignored. Never edit it or keep it as the only copy
  of the installation's settings.
- Access identity settings, organiser email and the Access management token remain in the Worker's
  dashboard variables/secrets. They do not belong in the installation JSON.

Only the four documented installation fields are accepted. Installation input cannot override code,
bindings, routes, security settings or arbitrary Wrangler options. Keep a private backup of the
settings alongside operational records; database exports remain separate.

## Local setup

For a new household, use `npm run setup:config` from the [setup guide](DEPLOYMENT.md). It
selects the account explicitly, creates or verifies D1 and writes the ignored settings. No JSON
editing is required. The Access setup commands save non-secret IDs in `.private/access-setup.json`
and install runtime settings through a hidden token prompt; they do not save the token locally.

For an automated build or an existing installation whose IDs are already known, write the four
verified fields shown in `installation.example.json` to `.wishlist-installation.json`. Run:

```sh
npm run installation:configure
```

This validates settings and writes the generated config; it makes no Cloudflare requests.
`npm run build` and `npm run dev` select it automatically through Vite. Contributors need no
installation file: local development, tests and builds also work against the shared local-only
configuration without Cloudflare credentials.

Use installation-aware commands for remote operations:

```sh
npm run setup:check
npm run installation:wrangler -- d1 info DB --json
npm run db:migrate:remote
npm run deploy
```

The last two commands mutate Cloudflare and require the operator's normal approval. The wrapper
selects the generated configuration. Do not supply `--config` or `--env`; use another complete
installation file or build variable for another deployment. For initial authentication, ordinary `npx wrangler login` remains available.
`setup:config` explicitly selects the chosen account for D1 creation before its UUID exists.
The Wrangler wrapper launches the installed JavaScript entry with Node, including on Windows;
it does not execute `npx.cmd` directly. Use `npm run installation:cf -- <resource command>` for
account-scoped `cf` operations with the saved account. `cf` and Wrangler need separate logins.

## Cloudflare Builds

Before the first build of this version, add a text variable under **Settings → Builds → Variables
and secrets** named `WISHLIST_INSTALLATION`, containing the complete installation JSON.
This is a **build** variable, not a Worker runtime binding. Keep build command `npm run build` and
deploy command `npm run deploy:production`. The configured Worker name must match the connected
Worker. Disable non-production builds unless they have separate installation settings and credentials;
never run production migrations for a preview.

The production command validates that the built Worker targets the same account, Worker and database
as the current settings **before** applying migrations. Missing settings, an unconfigured build or
a different installation stops the command without a migration or deployment. Changing settings after
building requires a new build. Failed migrations stop deployment; successful migrations are not
undone if deployment subsequently fails. Dashboard runtime variables are kept with `--keep-vars`.

`CLOUDFLARE_ACCOUNT_ID`, when supplied, must match the installation. `CLOUDFLARE_ENV` is not an
installation selector: use separate installation settings instead.

## Migrate an existing installation

Before taking this update, copy the old configuration's values:

| Old `wrangler.jsonc` field                     | Installation JSON field |
| ---------------------------------------------- | ----------------------- |
| `account_id`                                   | `accountId`             |
| `name`                                         | `workerName`            |
| `d1_databases` entry for `DB`: `database_id`   | `databaseId`            |
| `d1_databases` entry for `DB`: `database_name` | `databaseName`          |

Save the ignored local file, add the build variable, then take the source update and run the normal
checks. This transition requires no new database, migration, Access application or domain change.
Do not push this change to a connected installation before setting its build variable. Never commit
a private settings file just to make a build work.

The version-pin installation-repository work can supply the same environment JSON without patching
upstream source. This separation does not itself implement upstream delivery, scheduled updates or
deployment-result tracking.
