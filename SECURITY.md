# Security policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue or discussion.

Use GitHub's private vulnerability reporting feature for this repository. Include the affected version, reproduction steps, expected impact and any suggested mitigation you have already identified.

Reports will be acknowledged when practical. This is a small maintainer-led project and does not offer a bug bounty or guaranteed response time.

## Deployment responsibility

Each installation is operated by its deployer. Before storing family data, deployers must:

- place the application behind Cloudflare Access;
- use an exact allow-list of trusted email addresses;
- avoid an Access policy that includes every user of the One-time PIN login method;
- set `INITIAL_ORGANISER_EMAIL` to the exact email in the first organiser's Allow rule before the
  first login;
- set the Access application authorization cookie to `SameSite=Lax` and keep `HttpOnly` enabled;
- keep Cloudflare credentials and Wrangler secrets out of the repository;
- apply database migrations and dependency/security updates.

The application will validate Access assertions as defence in depth, but that does not replace a correct Access policy.
