# Fresh-deployment acceptance

Use this procedure to demonstrate the complete installation journey from an empty Cloudflare account
to a release-ready family wishlist. It gives every tagged release clear, repeatable deployment
evidence.

## Safety boundary

Use a disposable Cloudflare account or a dedicated non-production account with empty test data,
together with a disposable repository fork and test hostname. Record the account ID before every
create or cleanup step so all activity stays confidently isolated from the reference deployment.

Use dedicated test email addresses and keep tokens, OTPs and database exports out of the evidence
log. These clear boundaries make the resulting record safe to share with a release review.

## Test identities and prerequisites

Prepare:

- one organiser mailbox, one invited-member mailbox and one unrelated mailbox;
- a new Cloudflare account with Workers, D1, Zero Trust and a `workers.dev` subdomain available;
- a disposable GitHub fork for testing automatic and manual GitHub updates;
- Git, Node.js and npm versions supported by [the installation guide](DEPLOYMENT.md); and
- an optional test domain in the same account if custom-domain behaviour is in scope.

Record only non-secret identifiers: date, tested commit, Cloudflare account ID, Worker name, D1 name
and ID, Access application ID, production hostname and tester. Keep API tokens and OTPs out of the
record.

## Procedure

1. Start with a clean checkout of the tested commit and no project-specific environment variables.
   Record the operating system, shell, Node, npm, Wrangler and `cf` versions. Run separate
   walkthroughs on Windows PowerShell (and Command Prompt if `npm.ps1` is blocked), macOS Terminal
   and a Linux terminal. A source-level Windows launcher test is not a Windows walkthrough.
2. Follow [Install and deploy](DEPLOYMENT.md) from tools through the family checks,
   in order and without undocumented corrections. Use one command per step. Include GitHub
   release updates and the final workflow/build verification.
3. At step 17, run `npm run setup:check -- --before-login` before configuring Access. Require the
   first-login schema and deployed D1 UUID checks to pass. At step 21, use the private prompt in:

   ```sh
   npm run setup:access -- .private/access-setup.json
   ```

   Save pass/fail lines without recording token input. The final checks must report no pending D1
   migrations, the intended database on every traffic-bearing version, all runtime bindings,
   the 30-day Access session and exact narrow public-sharing applications.

   After configuration, repeat in read-only mode:

   ```sh
   npm run setup:access -- .private/access-setup.json --check
   ```

   Check that no remote resources, policies or Worker settings change. Close the terminal between
   selected steps and verify that the saved files allow resumption. Interrupt a database or Access
   create once; rerunning must inspect live state and avoid duplicates.

4. Exercise installation guide steps 22–30 using the three test
   identities. In particular, verify that the unrelated address cannot enter and that a wishlist
   owner never receives their own item's claim or purchase state.
5. Test both update choices. Start with [manual GitHub updates](MANUAL_UPDATES.md): leave
   `WISHLIST_AUTO_UPDATE` absent or `false`, verify scheduled jobs skip updates and a manual run
   deploys successfully. Then complete [automatic updates](AUTOMATIC_UPDATES.md), explicitly setting
   the variable to `true`. Verify the build uses its
   `WISHLIST_INSTALLATION` settings without tracked household-specific changes to `wrangler.jsonc`.
   Require a manual updater run, then an observed real Cloudflare scheduled event dispatching an
   automatic GitHub run, to trigger a successful Cloudflare build. A CLI setup-check dispatch is not
   timer evidence. Remove GitHub scheduling from the household workflow; there is one timer. Using disposable source/releases, exercise a new stable release and an intentional build
   failure; confirm subsequent checks keep reporting that failure, a retry succeeds, and synthetic
   family records remain intact. Never advance the real stable branch just to manufacture test data.
6. Re-run `npm run setup:check` without the Access environment variables. Confirm the Wrangler, D1 and
   deployed-binding checks still pass and that the output explicitly says the deep Access checks were
   skipped.

Any undocumented repair, ambiguous instruction, failed assertion or exposed secret becomes a useful
release finding. Improve the source or documentation, restart with empty resources and record a fresh
run so a passing record always represents the complete journey.

## Evidence record

Create a release issue or private test note containing:

```text
Commit:
Date and tester:
Operating system and shell:
Node, npm, Wrangler and cf versions:
Cloudflare account ID (non-secret):
Worker name and hostname:
D1 name and ID:
Access application ID:
Optional custom hostname tested: yes/no
Installation guide completed without correction: pass/fail
Before-login database/schema checks: pass/fail
setup:access full checks: pass/fail
setup:access --check makes no remote changes: pass/fail
Interrupted setup resumes without duplicates: pass/fail
Final acceptance checklist: pass/fail
Cloudflare Build from disposable fork: pass/fail
Manual updater run and matching Cloudflare build: pass/fail
Observed scheduled updater event and matching build: pass/fail
New release, failed build and successful retry preserve data: pass/fail
setup:check without Access environment: pass/fail
Observed allowance usage or warnings:
Defects and follow-up links:
```

Screenshots must exclude tokens, OTPs, email inbox contents and private family data.

## Cleanup

Cleanup is deliberately manual so every target can be compared with the recorded identifiers. While
signed into the disposable account:

1. verify the account ID again;
2. disconnect the disposable GitHub Builds integration;
3. remove only the recorded narrow public-sharing and main Access applications;
4. remove only the recorded Worker and D1 database;
5. remove the test hostname or zone if it was created solely for the walkthrough;
6. revoke the scoped Access management token; and
7. archive or delete the disposable fork and evidence after retaining the release result required by
   the project.

Proceed with each cleanup only when its displayed identifier matches the evidence record exactly.
