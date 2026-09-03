# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature for this repository so a suspected issue can be
investigated responsibly. Include the affected version, reproduction steps, expected impact and any
suggested mitigation you have already identified.

Reports receive thoughtful maintainer review as capacity allows. This small, community-minded project
operates outside a bug-bounty programme, and response timing follows maintainer availability.

## Secure deployment checklist

Each installation is operated by its deployer. Before storing family data, deployers must:

- place the application behind Cloudflare Access;
- use an exact allow-list of trusted email addresses;
- pair One-time PIN with exact-email admission rather than a login-method-wide Allow rule;
- set `INITIAL_ORGANISER_EMAIL` to the exact email in the first organiser's Allow rule before the
  first login;
- set the Access application authorization cookie to `SameSite=Lax` and keep `HttpOnly` enabled;
- keep Cloudflare credentials and Wrangler secrets out of the repository;
- apply database migrations and dependency/security updates.

The application validates Access assertions as a strong second layer alongside the correctly scoped
Access policy.
