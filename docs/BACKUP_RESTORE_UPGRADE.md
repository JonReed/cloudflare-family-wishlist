# Backup, restore and upgrade

This runbook protects one deployment's family data and keeps application and schema updates in a
safe order. D1 contains names, wishlists, items, invitations, viewing links and private claim state;
treat every export as sensitive family data.

Cloudflare D1 [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) is always
enabled on production-backend databases. It retains seven days on Workers Free and 30 days on
Workers Paid. A portable SQL export is still useful before a significant update and for retention
beyond that window. An export blocks other database requests while it runs, so take it during a
quiet maintenance window.

## Create a recovery point

Run these steps from the original project folder before bringing in a new release. These commands
work in PowerShell, Command Prompt, macOS Terminal and Linux. Run one command at a time; stop on an
error. If this is the maintainer's deployment, read `.private/WRANGLER_PROFILE.md` first.

### 1. Check the working folder

```sh
git status --short
```

**Done when:** no changed files are printed. Preserve and review any listed changes before continuing.

### 2. Check your Cloudflare account

```sh
npm run installation:wrangler -- whoami --json
```

**Done when:** the account ID matches `accountId` in your `.wishlist-installation.json`.

### 3. Check the existing deployment

```sh
npm run setup:check
```

**Done when:** the deployment checks pass. Stop on a mismatch or unexpected pending migration.

### 4. Get a recovery bookmark

```sh
npm run installation:wrangler -- d1 time-travel info DB
```

**Done when:** Wrangler prints the bookmark. Copy it and the current UTC time into a private note.
The bookmark identifies a recoverable database state; it is not a downloaded backup.

### 5. Export a portable backup (optional)

For a significant update or longer retention, choose a private folder outside this repository.
Replace `BACKUP-FILE` below with a **new, unused full filename** in that folder, keeping the quotes.
For example, Windows might use `C:/Users/Alex/Private Backups/wishlist-2026-10-03.sql`;
macOS might use `/Users/alex/Private Backups/wishlist-2026-10-03.sql`;
Linux might use `/home/alex/private-backups/wishlist-2026-10-03.sql`.
Use your own username and date. The parent folder must already exist.

```sh
npm run installation:wrangler -- d1 export DB --remote --output="BACKUP-FILE"
```

**Done when:** Wrangler reports success and the SQL file exists in that private folder. The file
contains private family data; keep it encrypted or in an access-controlled location.

### 6. Record the backup checksum (optional)

Replace `BACKUP-FILE` with the same full filename used in step 5. Keep the quotes.

```sh
node -e "const fs=require('node:fs'); const c=require('node:crypto'); console.log(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "BACKUP-FILE"
```

**Done when:** a 64-character checksum is printed. Keep it with the backup record so you can check
later that the file has not changed. This command works on Windows without installing `shasum`.

Never place an export in the checkout, commit it, attach it to a public issue or store it unencrypted
in a public cloud folder. The Time Travel bookmark is a recovery coordinate, not a portable backup.

## Restore a recent production state

First identify the UTC time immediately before the bad write or migration and preview its bookmark:

```sh
npm run installation:wrangler -- d1 time-travel info DB --timestamp="2026-09-03T12:00:00Z"
```

Inspect the timestamp and account again before continuing. A restore overwrites the production
database in place, cancels in-flight queries and discards writes after the chosen point from the
active state. It is a production mutation and requires explicit maintainer approval:

```sh
npm run installation:wrangler -- d1 time-travel restore DB --timestamp="2026-09-03T12:00:00Z"
```

Save the `previous_bookmark` reported by Wrangler; it can undo the restore. Then run:

```sh
npm run installation:wrangler -- d1 execute DB --remote --command="PRAGMA quick_check;"
npm run setup:check
```

Exercise sign-in, wishlist loading and claim privacy before reopening normal use. If a schema change
caused the incident, deploy compatible Worker code or a reviewed forward-fix migration as part of
the same recovery; restoring data alone does not change the deployed Worker.

## Practise recovery safely

Test restores against a newly created, disposable D1 database. This keeps production available while
giving the family concrete confidence in every export.

```sh
npm run installation:wrangler -- d1 create family-wishlist-recovery-test --location weur
npm run installation:wrangler -- d1 execute family-wishlist-recovery-test --remote --file=/absolute/private/path/family-wishlist-YYYY-MM-DD.sql
npm run installation:wrangler -- d1 execute family-wishlist-recovery-test --remote --command="PRAGMA quick_check; SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name;"
```

Compare row counts for `members`, `wishlists`, `items`, `claims` and `wishlist_share_links` with the
source using aggregate queries only; do not print their rows into logs. Verify the restored migration
history and run a private functional test if the recovery database is temporarily attached to a
non-production Worker. Record the recovery test, then remove only the disposable resources after
rechecking their account IDs and database UUIDs.

Test recovery at least before the first tagged release and after material schema or runbook changes.
Delete expired exports according to the household's agreed retention policy.

Both SQL-export recovery and Time Travel were exercised with synthetic data on 6 September 2026;
see the [release-readiness evidence](RELEASE_READINESS.md). This proves the recovery operations, not
the completeness of any particular household's backup or its separately managed Access settings.

## Automatic release updates

Households that choose automatic updates follow [AUTOMATIC_UPDATES.md](AUTOMATIC_UPDATES.md). The scheduled
fork workflow receives tested stable releases and Cloudflare runs pending migrations before deploying.
Users installed with the earlier guide can [enable automatic updates](REPAIR_UPDATES.md) or keep
using [manual updates](MANUAL_UPDATES.md). D1 Time Travel
provides the platform recovery window described above; keep periodic private exports for longer-term
recovery. Release authors must test migrations against the previous app before promoting stable.

## Manually repair or upgrade an installation

For routine household updates, use the step-by-step [manual update guide](MANUAL_UPDATES.md).
Use the following procedure for a controlled operator-led upgrade or recovery. It is not a checklist
each family must repeat for every automatic release.

1. On the currently deployed revision, run `npm run setup:check` to prove the installation starts
   with no drift or previously pending migration.
2. Capture a Time Travel bookmark and, for a significant update, a portable export as above.
3. Bring the desired source into the deployment checkout. Read the release notes and every new file
   under `migrations/`; applied migrations are append-only, so never edit, rename or squash them.
4. Run:

   ```sh
   npm ci
   npm run quality
   npm run audit
   ```

5. Push the reviewed commit to the fork's `main`. With production deploy command
   `npm run deploy:production`, Cloudflare Builds applies pending migrations before deploying and
   stops deployment if a migration fails. No manual SQL step is needed. Existing installations must
   switch that command once and ensure the build token has Account / D1 / Edit permission. If the
   source is already on `main`, use the dashboard's retry or redeploy control instead of an empty
   commit.
6. After the build succeeds, rerun `npm run setup:check` and the affected items in the installation
   guide's final acceptance checklist. Confirm the deployment status checks every version receiving
   traffic, which matters during a gradual deployment.

Rolling back Worker code does not roll back D1. Prefer a forward-fix for an additive schema problem.
Keep migrations compatible with the previous Worker until the new deployment is healthy. A failed
deployment after successful migration leaves that migration applied; fix and retry, do not restore
the database automatically.
Use Time Travel only when restoring the whole database to an earlier state is the intended recovery.
Do not apply down migrations to an existing installation.

## Complete the recovery picture

A D1 backup covers the family's application data. The reviewed repository plus the privately backed-up
installation settings covers non-secret application configuration, while the family's password manager or approved secret
store protects secret values. [Install and deploy](DEPLOYMENT.md) provides the repeatable route for
reconstructing Access applications and policies, Worker variables, custom domains, Builds settings
and Wrangler authentication.
