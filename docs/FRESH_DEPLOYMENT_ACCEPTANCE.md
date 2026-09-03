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
- a disposable GitHub fork if automatic Builds are in scope;
- Git, Node.js and npm versions supported by [the installation guide](DEPLOYMENT.md); and
- an optional test domain in the same account if custom-domain behaviour is in scope.

Record only non-secret identifiers: date, tested commit, Cloudflare account ID, Worker name, D1 name
and ID, Access application ID, production hostname and tester. Keep API tokens and OTPs out of the
record.

## Procedure

1. Start with a clean checkout of the tested commit and no project-specific environment variables.
2. Follow [Install and deploy](DEPLOYMENT.md) from the prerequisites through automatic deployments,
   in order and without undocumented corrections.
3. At step 10, keep all four setup environment variables exported and run:

   ```sh
   npm run setup:check
   ```

   Save the pass/fail lines, but never shell history or environment output. The command is read-only
   and must report no pending D1 migrations, all required bindings on every traffic-bearing Worker
   version, the 30-day Access session and exact narrow public-sharing applications.

4. Exercise every item in the installation guide's final acceptance checklist using the three test
   identities. In particular, verify that the unrelated address cannot enter and that a wishlist
   owner never receives their own item's claim or purchase state.
5. Push one harmless documentation-only commit to the disposable fork. Confirm exactly one successful
   Cloudflare Build and that the existing Worker remains reachable.
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
Cloudflare account ID (non-secret):
Worker name and hostname:
D1 name and ID:
Access application ID:
Optional custom hostname tested: yes/no
Installation guide completed without correction: pass/fail
setup:check with Access environment: pass/fail
Final acceptance checklist: pass/fail
Cloudflare Build from disposable fork: pass/fail
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
