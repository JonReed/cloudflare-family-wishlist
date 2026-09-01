# Cloudflare Family Wishlist

A private, self-hosted family wishlist designed to run comfortably on Cloudflare's free tier.

Each family member has one wishlist. Everyone in the invited family group can view and edit every list, while claims and purchases are hidden from the owner of the list so surprises stay surprising.

> [!NOTE]
> The project is in active development. Foundation, Cloudflare deployment, Access OTP, the family dashboard, item controls, add-from-anywhere tools and private claims are working; release hardening and item reordering remain.

## Why this exists

Most wishlist applications are either public, advertising-supported, complicated to self-host, or built around permissions this use case does not need. This project deliberately has a smaller model:

- invitation-only access;
- a family-organiser page showing who has joined and who is still waiting;
- one wishlist per family member;
- shared editing across the family;
- editable names, pictures and GBP prices filled from product links when shops publish them;
- iPhone/iPad Share Sheet and desktop browser tools for adding something to one or more lists while shopping;
- private claims that the recipient cannot see;
- no application-managed passwords;
- no application email service;
- no paid infrastructure required for a normal family deployment.

## Stack

- [React Router](https://reactrouter.com/) in full-stack framework mode
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) and the Cloudflare Vite plugin
- [Cloudflare D1](https://developers.cloudflare.com/d1/) for SQLite-compatible storage
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) for an optional product-page extraction fallback
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/) with email one-time PINs and an exact email allow-list
- TypeScript, React and Tailwind CSS
- Vitest running in the Cloudflare Workers runtime

## Documentation

- [Product model](docs/PRODUCT.md) — who the application serves, core workflows and non-goals.
- [Architecture](docs/ARCHITECTURE.md) — request lifecycle, data model and privacy boundaries.
- [Development guide](docs/DEVELOPMENT.md) — local setup, testing and safe change recipes.
- [Design guide](docs/DESIGN.md) — family-first IA, visual language, copy and accessibility.
- [Deployment guide](docs/DEPLOYMENT.md) — Cloudflare setup for a fork.
- [Roadmap](docs/ROADMAP.md) — completed phases and remaining release work.

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

Do not expose a deployment containing family data until Cloudflare Access is configured with an **exact email allow-list**. Selecting “One-time PIN” as the only Access rule would allow any valid email address and is not sufficient.

The Worker also verifies Access JWTs itself and fails closed if the team domain, application audience or assertion is absent or invalid. The first member becomes the family organiser; after one
additional scoped Cloudflare API token is configured, they can add exact sign-in addresses from the
**Your family** page without using the Cloudflare dashboard. The application prepares an invitation
to copy but does not send email itself.

## Project status

See [docs/ROADMAP.md](docs/ROADMAP.md) for the phased implementation plan.

## Open source and contributions

This project is MIT licensed and intentionally fork-friendly. It is also maintainer-led: issues and ideas are welcome, but there is no promise that feature requests or pull requests will be accepted. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Please do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md) instead.
