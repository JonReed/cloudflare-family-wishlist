<p align="center">
  <img src="public/favicon.svg" width="88" height="88" alt="Family Wishlist gift mark">
</p>

<h1 align="center">Cloudflare Family Wishlist</h1>

<p align="center">
  <strong>For your favourite people.</strong><br>
  A private, AI-assisted family wishlist designed to run comfortably on Cloudflare's free tier.
</p>

<p align="center">
  <a href="docs/DEPLOYMENT.md"><strong>Set up your own</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="docs/PRODUCT.md">See how it works</a>
  &nbsp;&middot;&nbsp;
  <a href="docs/DEVELOPMENT.md">Develop locally</a>
</p>

Each family member has one wishlist. Everyone in the invited family group can view and edit every list, while claims and purchases are hidden from the owner of the list so surprises stay surprising.
When someone outside the family wants ideas, a revocable read-only link can share one person's list
without giving them access to the private family space.

> [!NOTE]
> The project is in active development. Foundation, Cloudflare deployment, Access OTP, the family dashboard, item controls, add-from-anywhere tools and private claims are working; release hardening remains.

<p align="center">
  <img src="docs/assets/wishlist-overview.jpg" width="1200" alt="Family Wishlist showing gift-tag family navigation, a paper wishlist and its add form">
</p>

<p align="center"><sub>The everyday workspace: choose someone, see their wishes and add another without leaving the page.</sub></p>

## Turn a shopping link into a useful wish

Paste a product link—or share it from a phone or browser—and Family Wishlist can fill in an editable
product name, picture and GBP price. It reads reliable information published by the shop first; when
that is incomplete, Cloudflare Workers AI can help recover a missing name or price and choose the
most likely product picture from the page.

There is no separate AI account, API key or paid AI service to configure. The feature is designed to
fit within the Workers AI free allocation. The normal editable form remains fully usable if a shop
blocks extraction or the allowance is unavailable, and no suggestion is saved until a family member
confirms it.

## Why this exists

Most wishlist applications are either public, advertising-supported, complicated to self-host, or built around permissions this use case does not need. This project deliberately has a smaller model:

- invitation-only access;
- a family-organiser page showing who has joined and who is still waiting;
- one wishlist per family member;
- shared editing across the family;
- high, normal and low priorities that keep the most useful wishes at the top;
- AI-assisted, editable names, pictures and GBP prices from product links;
- iPhone/iPad Share Sheet and desktop browser tools for adding something to one or more lists while shopping;
- private claims that the recipient cannot see;
- revocable viewing links for relatives and friends outside the signed-in family;
- no application-managed passwords;
- no application email service;
- no paid infrastructure required for a normal family deployment.

## Stack

- [React Router](https://reactrouter.com/) in full-stack framework mode
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) and the Cloudflare Vite plugin
- [Cloudflare D1](https://developers.cloudflare.com/d1/) for SQLite-compatible storage
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) for free-tier product-detail assistance when ordinary page metadata is incomplete
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/) with email one-time PINs and an exact email allow-list
- TypeScript, React and Tailwind CSS
- Vitest running in the Cloudflare Workers runtime

## Documentation

- [Install and deploy](docs/DEPLOYMENT.md) — start with a free Cloudflare account, understand the
  live allowances, and finish with Access, D1, Workers AI and automatic deployments configured.
- [Product model](docs/PRODUCT.md) — who the application serves, core workflows and non-goals.
- [Architecture](docs/ARCHITECTURE.md) — request lifecycle, data model and privacy boundaries.
- [Development guide](docs/DEVELOPMENT.md) — local setup, testing and safe change recipes.
- [Design guide](docs/DESIGN.md) — family-first IA, visual language, copy and accessibility.
- [Roadmap](docs/ROADMAP.md) — completed phases and remaining release work.
- [Project stewardship and support](docs/STEWARDSHIP.md) — maintainer, funding, review provenance and
  optional support.

Agents and automated contributors should begin with [AGENTS.md](AGENTS.md).

## Local development

Requirements:

- Node.js 24 (Node.js 22.22 or newer is supported)
- npm 11 or newer

```sh
npm install
npm run db:migrate:local
npm run dev
```

Useful commands:

```sh
npm run format       # format the repository
npm run lint         # ESLint, with warnings treated as failures
npm run typecheck    # Worker bindings, route types and TypeScript
npm run test         # tests inside the Workers runtime
npm run build        # production Worker build
npm run quality      # complete local/CI quality gate
```

Wrangler creates local Cloudflare state under `.wrangler/`. Development requests to a localhost URL use a fixed local-only identity; production builds always require a valid Cloudflare Access assertion.

See the [development guide](docs/DEVELOPMENT.md) before changing the database, authentication or
Cloudflare configuration.

## Deployment model

`main` is the only working and deployment branch for now. The reference deployment is connected to Cloudflare Builds, so each push to `main` deploys the latest version after the repository checks pass. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to configure a fork.

A normal family installation needs a Cloudflare account but not a paid Cloudflare plan or a custom
domain. The [installation guide](docs/DEPLOYMENT.md) starts before account setup, links to the current
Workers, D1, Workers AI, Access and Builds allowances, and explains what happens if a free limit is
reached.

Do not expose a deployment containing family data until Cloudflare Access is configured with an **exact email allow-list**. Selecting “One-time PIN” as the only Access rule would allow any valid email address and is not sufficient.

The Worker also verifies Access JWTs itself and fails closed if the team domain, application audience or assertion is absent or invalid. Only the explicitly configured initial organiser can create the first member; after one
additional scoped Cloudflare API token is configured, they can add exact sign-in addresses from the
**Your family** page without using the Cloudflare dashboard. The application prepares an invitation
to copy but does not send email itself.

## Project status

See [docs/ROADMAP.md](docs/ROADMAP.md) for the phased implementation plan.

## Open source and contributions

This project is MIT licensed and intentionally fork-friendly. It is also maintainer-led: issues and ideas are welcome, but there is no promise that feature requests or pull requests will be accepted. See [CONTRIBUTING.md](CONTRIBUTING.md).

Development tooling was supported by Furls Digital Ltd. See
[project stewardship and support](docs/STEWARDSHIP.md) for the precise relationship, development
process and optional Buy Me a Coffee link.

## Security

An [AI-assisted adversarial security review](docs/SECURITY_REVIEW.md) was performed with OpenAI
Daybreak Blue on 1 September 2026. The original review found five actionable issues; all were fixed,
and a final review of commit `ad9571c` found no remaining actionable findings in the reviewed source.
The report preserves the original evidence, remediation record, exact commits, scope and limitations.
It is not an independent audit, certification or penetration test.

Please do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md) instead.
