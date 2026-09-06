---
name: wishlist-install
description: Guide a household through installing Family Wishlist in its own Cloudflare account, or resume an interrupted installation. Use for account setup, deployment configuration and installation verification, not ordinary application development or unrelated Cloudflare projects.
---

# Install Family Wishlist

Use the existing setup tools and docs; do not build another installer or require a plugin.

1. Read [the agent installation guide](../../../docs/AGENT_INSTALLATION.md) and follow its resumable
   checklist. Read the relevant sections of [the deployment guide](../../../docs/DEPLOYMENT.md)
   before each setup stage; it owns commands, permissions and Access configuration.
2. Confirm the intended household account, resources and update route before remote changes. An
   installation request does not authorise changing the maintainer's instance, unrelated resources,
   paid plans or account-wide permissions. Honour the user's explicit choices and approval scope.
3. Inspect recorded and live state before resuming or retrying. Reuse matching resources; stop on
   mismatches or missing authority. Keep secrets out of the checklist, chat and committed files.
4. Reuse the repository's configuration and verification scripts. Guide owner-only sign-in and
   approval steps when necessary; never weaken Access to get past a setup problem.
5. Finish with observed results, not just a successful build: follow the guide's acceptance checks,
   mark skipped checks honestly, and leave a concise handoff with the next action if incomplete.

The skill supports the user's request; it does not grant remote-write permission or start an
installation merely because it was loaded. No other installed skills are required.
