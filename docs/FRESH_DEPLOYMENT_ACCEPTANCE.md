# Fresh-deployment acceptance

Use this procedure to prove that the installation guide works from an empty Cloudflare account. It
is a release acceptance exercise, not a shortcut for configuring the reference deployment.

## Safety boundary

Use a disposable Cloudflare account or a dedicated non-production account with no family data. Use a
disposable repository fork and a test hostname. Before creating or removing anything, record and
compare the Cloudflare account ID with the account under test.

Never run cleanup commands against the reference account, database, Worker, Access applications or
repository. Do not copy real family email addresses, tokens or database exports into the evidence
log.

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
   and must report no pending D1 migrations, all required deployed bindings, the 30-day Access
   session and exact narrow public-sharing applications.

4. Exercise every item in the installation guide's final acceptance checklist using the three test
   identities. In particular, verify that the unrelated address cannot enter and that a wishlist
   owner never receives their own item's claim or purchase state.
5. Push one harmless documentation-only commit to the disposable fork. Confirm exactly one successful
   Cloudflare Build and that the existing Worker remains reachable.
6. Re-run `npm run setup:check` without the Access environment variables. Confirm the Wrangler, D1 and
   deployed-binding checks still pass and that the output explicitly says the deep Access checks were
   skipped.

Treat any undocumented manual repair, ambiguous instruction, failed assertion or secret printed to
the terminal as a failed walkthrough. Fix the source or documentation, start again with empty
resources and record a new run rather than editing the evidence from the failed attempt.

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

If any displayed identifier differs from the evidence record, stop instead of deleting it.
