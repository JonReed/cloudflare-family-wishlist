# Agent-assisted installation

This guide helps Codex or another assistant install one household's Family Wishlist, or resume an
interrupted setup. It is a checklist around [DEPLOYMENT.md](DEPLOYMENT.md), not a second installer.
That guide owns setup commands, permission requirements and the final acceptance checks. Read its
relevant sections before acting, and retrieve current official Cloudflare documentation when the
dashboard or installed command differs. Do not guess a replacement security setting.

For the copyable starting prompt, see [Install with Codex](../README.md#install-with-codex).
The repository includes a small [installation skill](../.agents/skills/wishlist-install/SKILL.md).
Codex supports [repository-local skills](https://learn.chatgpt.com/docs/build-skills) and
[AGENTS.md instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md); direct reading
of this guide is sufficient when skill discovery is unavailable. No plugin is required.

## Establish the installation target

Inspect the checkout, Git remotes, local installation settings and available authenticated tools
without exposing secret values. Ask only for missing decisions:

- Is this a new installation, resumed setup, or an upgrade of an existing family instance?
- Which Cloudflare account and GitHub owner/repository should own it?
- What is the organiser's exact email address, and which Worker name and hostname should be used?
- Which update route does the owner want?

Prefer the documented free-tier setup and included `workers.dev` address unless the owner chooses
otherwise. Paid services, domain registration and unrelated account changes require their own
explicit authorisation; they are not implied by a request to install the application.
Explain the proposed resources and changes and obtain approval for that scope before remote writes.
Do not repeatedly ask for approval already given for the same scoped work. A diagnostic or planning
request alone does not authorise installation.

The reference maintainer's account, credentials and repository are not defaults for other families.
Verify the active account from the actual working directory and compare it with the selected account
ID before remote operations. Follow the deployment guide's profile guidance, including physical paths
on macOS. A browser login does not prove the CLI is using the same account.

## Choose the update route explicitly

- **Self-managed fork:** follow [DEPLOYMENT.md](DEPLOYMENT.md). Cloudflare Builds automatically
  deploys changes in the connected fork, including pending migrations. The owner still syncs upstream
  changes into that fork.
- **Version-pin installation:** follow [INSTALLATION_UPDATES.md](INSTALLATION_UPDATES.md) for the
  small generated repository and its build commands; use the deployment guide for account, D1 and
  Access prerequisites. Explain the current limits in [RELEASE_READINESS.md](RELEASE_READINESS.md)
  before proceeding. It is not yet certified as a fully unattended installation.

If the owner prefers manual deployments, follow the deployment guide's CLI route and record that
automatic deployments and upstream updates are not enabled; do not require a GitHub connection.

Do not mix the two repositories' deploy commands or connect a second Worker accidentally. Record the
source version and selected channel. Verify a release or `stable` branch actually exists before
offering it; do not invent a first release. For an existing installation upgrade, use
[BACKUP_RESTORE_UPGRADE.md](BACKUP_RESTORE_UPGRADE.md) before changing data or code.

## Keep one resumable checklist

Keep a short private note at `.private/INSTALLATION_PROGRESS.md` in the application checkout (already
ignored by Git), or in an owner-approved private location. It is an operational note, not executable
configuration. Keep household settings in the location defined by
[INSTALLATION_CONFIG.md](INSTALLATION_CONFIG.md); do not modify shared `wrangler.jsonc` to select an
account or database.

Record the selected account ID, repository, source commit, Worker name, D1 name/ID, hostname and Access
application ID as they become known. Include each stage's status, dated evidence, any owner action
needed and the next safe step. Do not record API tokens, assertions, passwords, OTPs, raw sharing
links, family records or database exports. Keep the organiser's email in its intended configuration,
not a public test report.

Use `not started`, `in progress`, `verified`, `blocked` or `skipped` for these stages:

| Stage                             | Source of truth and completion evidence                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Account and checkout              | Deployment steps 1–3; supported tools, intended Git remote and matching account identity             |
| Installation settings and D1      | Steps 3–5 and installation settings guide; matching database ID/name and migrations                  |
| First deployment                  | Step 6; required gates pass and correct Worker deployed; expected fail-closed response before Access |
| Private sign-in                   | Steps 7–9; exact-email policy, correct JWT configuration and organiser login                         |
| Invitations and sharing           | Steps 9a–10; session/sharing configuration verified and invited member flow exercised                |
| Automatic deployment/update route | Step 11 or version-pin guide; saved build configuration, successful actual build and deployment      |
| Acceptance and handoff            | Step 13; recorded results, owner-only checks and any remaining limitations                           |

On resumption, read the note and verify current state before repeating a stage. List and inspect
existing resources before creating them; a matching name alone is insufficient. Reuse only resources
whose account, identifiers and intended purpose match. Do not overwrite conflicting configuration,
create a duplicate to evade a failure, or delete resources to start again without approval.

## Use the existing tools and owner-assisted steps

Reuse `installation:configure`, installation-aware Wrangler commands, `access:configure-session`,
`access:configure-sharing` and `setup:check` as documented. Inspect a failure and re-read live state
before retrying; do not repeatedly create resources or broaden permissions to make an error vanish.
If completion needs a new permission, account choice or payment decision, explain the exact blocker
and request that decision. Continue independent safe checks where useful.

The owner completes sign-in, passkeys, OTPs, payment entry and account consent in the service's own
UI. Never ask them to paste secrets into chat or put a token in a command argument. Use the private
input and secret-storage methods in the deployment guide. If browser control or a connector is
unavailable, give the owner one precise dashboard step and verify the saved result afterward. Do not
require a plugin to finish setup.

Keep Access and application JWT validation enabled. The documented pre-Access `503` is an expected
intermediate state, not a completed installation. Public sharing must retain only the exact narrow
exceptions in the deployment guide. Missing permissions are not a reason to widen the email allow-list
or expose private pages.

## Verify and hand over

Run `setup:check` with the documented Access setup environment to include the deeper checks; if those
values are unavailable, report the checks as skipped rather than claiming a complete pass. Follow
the deployment guide's final acceptance list with owner-approved test identities and records. In
particular, observe organiser sign-in, invitation and first login, a wish added before first login,
unrelated-email denial, claim privacy and sharing/revocation. Do not request other people's login
codes; have the owner or invited tester complete those steps.

Verify saved build settings and an actual build/deployment in the intended repository and account.
A green GitHub updater job or changed version pin alone is not delivery evidence. A manually started
job is not evidence that a schedule fired. Do not restore D1 automatically after a deployment failure;
successful migrations are not undone by a failed Worker deployment.

End with the application address, selected update route, source version, verified checks, skipped or
blocked checks, and where the private operational note lives. Explain how the owner invites family
and how future updates arrive. Do not call setup complete while sign-in or a required check remains
unverified. Offer to remove only specifically identified temporary test records with approval; retain
the family's actual installation. For a requested disposable release test, use
[FRESH_DEPLOYMENT_ACCEPTANCE.md](FRESH_DEPLOYMENT_ACCEPTANCE.md) and its separately scoped cleanup.
