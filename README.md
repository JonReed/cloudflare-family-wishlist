<p align="center">
  <img src="public/favicon.svg" width="88" height="88" alt="Family Wishlist gift mark">
</p>

<h1 align="center">Family Wishlist</h1>

<p align="center">
  <strong>For your favourite people.</strong><br>
  Keep your family's gift ideas together and buying plans secret.<br>
  A private, open-source home for your family's wishes.
</p>

<p align="center">
  <a href="#why-cloudflare-rather-than-a-home-server-or-vps"><img src="docs/assets/runs-on-cloudflare.svg" height="20" alt="Runs on Cloudflare®"></a>
  <a href="https://github.com/JonReed/cloudflare-family-wishlist/releases/latest"><img src="https://img.shields.io/github/v/release/JonReed/cloudflare-family-wishlist?style=flat-square&amp;label=release&amp;color=24483E" height="20" alt="Latest stable release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-24483E?style=flat-square" height="20" alt="MIT licence"></a>
</p>

<p align="center">
  <a href="docs/DEPLOYMENT.md"><strong>Set up your own</strong></a>
  &nbsp;&middot;&nbsp;
  <a href="#install-with-codex">Install with Codex</a>
  &nbsp;&middot;&nbsp;
  <a href="https://familywishlist.org/">Website</a>
  &nbsp;&middot;&nbsp;
  <a href="docs/DEVELOPMENT.md">Develop locally</a>
</p>

<p align="center">
  <a href="https://familywishlist.org/"><img src="docs/assets/wishlist-overview.jpg" width="1200" alt="Family Wishlist showing gift-tag family navigation, a paper wishlist and its add form"></a>
</p>

<p align="center"><sub>The everyday workspace: choose someone, see their wishes and add another without leaving the page.</sub></p>

## Good ideas together. Surprises kept secret.

A wish only needs a name. Save something from any shop, a homemade cake, a day out or help in the
garden. Each person has one list, and everyone in your invited family can help keep those lists
useful. Buying plans stay hidden from the person receiving the gift.

- **Keep it in the family.** Private, invitation-only sign-in and a wishlist ready for each person.
- **Save it while you see it.** Add from a shopping link, your phone's Share menu or a browser button.
- **Make someone's day.** Coordinate gifts without spoiling the surprise or buying the same thing twice.
- **Let others join the giving.** Share a read-only list with friends or relatives, and stop sharing whenever you like.

Run your own independent installation in your own Cloudflare account. No always-on home server,
application password database or separate AI account to manage. A normal family deployment is
designed for the free tier; [hosting allowances and limits](docs/DEPLOYMENT.md#what-cloudflare-provides)
still apply.

The app has no advertising or analytics scripts and does not add affiliate codes to shop links.
Links you paste may already contain tracking parameters; Cloudflare still processes requests to
host and protect your installation.

**Ready for everyday family use.** [v1.0.0 is released](docs/releases/v1.0.0.md), with private sign-in,
shared wishlists, surprise-preserving gifts and public viewing links. The optional
[automatic upstream updater](docs/INSTALLATION_UPDATES.md) remains experimental.

## Turn a shopping link into a useful wish

Paste a product link—or share it from a phone or browser—and Family Wishlist can fill in an editable
product name, picture and GBP price. It reads reliable information published by the shop first; when
an ordinary request is blocked or returns only an empty application shell, Cloudflare Browser Run
can make one rendered-page attempt. When the resulting page is still incomplete, Cloudflare Workers
AI can help recover a missing name or price and choose the most likely product picture from the page.

Browser Run and Workers AI arrive through the same Cloudflare deployment, with no separate account,
API key or paid service to configure. The feature is designed to fit within their free allocations.
Every result remains an editable suggestion, and the dependable manual form is always ready when a
shop shares only limited product information.

## Thoughtful details, built in

The family organiser can prepare someone's wishlist before they first sign in, see who has joined,
and share a personal invitation through the family's preferred private channel. Top wishes rise to
the beginning of a list; optional notes, pictures and GBP price guidance make choosing easier.

Claim a gift, mark it bought or change your mind. Buying something never silently removes the wish:
its owner decides when it is no longer needed. Core forms work even without client JavaScript.
See the [complete product guide](docs/PRODUCT.md) for the everyday workflows and privacy model.

## Why Cloudflare rather than a home server or VPS?

You still run your own independent installation. Cloudflare manages the underlying infrastructure,
so the family does not need an always-on home computer, operating-system maintenance or an exposed
home network. The app runs on [Cloudflare's global network](https://developers.cloudflare.com/workers/),
and Access supplies private email-code sign-in without an application password database.

D1 includes [automatic point-in-time recovery](https://developers.cloudflare.com/d1/reference/time-travel/)—currently seven days on the Free plan—and [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
and [Browser Run](https://developers.cloudflare.com/browser-run/limits/) provide optional product-import help within their free allocations. Hosting, sign-in,
the database and deployments live in one account. Free plans still have limits; independent database
exports and tested recovery remain important.

The trade-off is a Cloudflare-specific application, dependent on its availability, policies and data
processing. This is not an offline or home-server deployment. See the
[architecture rationale](docs/ARCHITECTURE.md#why-cloudflare) and
[hosting allowances](docs/DEPLOYMENT.md#what-cloudflare-provides).

## Install with Codex

You can ask Codex to guide you through the [installation guide](docs/DEPLOYMENT.md). Open a local
checkout of this repository in Codex and paste:

```text
Help me install Family Wishlist in my own Cloudflare account. Follow AGENTS.md and
docs/AGENT_INSTALLATION.md, using the wishlist-install skill if available. Check what
is already set up, confirm my intended account and organiser email, and explain the
plan before creating resources. Use the free-tier setup and a workers.dev address
unless I choose otherwise. Keep a resumable checklist and verify the complete family
sign-in and deployment flow. Tell me what I need to do myself and anything unverified.
```

No extra plugin is needed. The small installation skill is included in the repository; if it is not
listed, ask Codex to read `.agents/skills/wishlist-install/SKILL.md` directly. The same
[agent installation guide](docs/AGENT_INSTALLATION.md) can be followed by other coding assistants.

You still handle account sign-in, passkeys, email codes, payment details if Cloudflare requests them,
and permission approvals yourself. Do not paste credentials into chat. Codex needs access to your
local checkout and authorised tools to perform setup; where a dashboard is unavailable it can guide
you through that step. Codex access is separate from the app's expected Cloudflare running costs.

Cloudflare Builds deploys changes to **your connected repository**; it does not automatically keep a
fork up to date. The separate [upstream updater](docs/INSTALLATION_UPDATES.md) has passed real build
and migration tests, but scheduled delivery and clean-account acceptance remain unverified. Codex
should explain that distinction before choosing an update route.

## Stack

- [React Router](https://reactrouter.com/) in full-stack framework mode
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) and the Cloudflare Vite plugin
- [Cloudflare D1](https://developers.cloudflare.com/d1/) for SQLite-compatible storage
- [Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/) for free-tier rendered-page assistance on difficult product pages
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) for free-tier product-detail assistance when ordinary page metadata is incomplete
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/) with email one-time PINs and an exact email allow-list
- TypeScript, React and Tailwind CSS
- Vitest running in the Cloudflare Workers runtime

## Documentation

- [Install and deploy](docs/DEPLOYMENT.md) — start with a free Cloudflare account, understand the
  live allowances, and finish with Access, D1, Browser Run, Workers AI and automatic deployments
  configured.
- [Product model](docs/PRODUCT.md) — who the application serves, core workflows and focused scope.
- [Architecture](docs/ARCHITECTURE.md) — request lifecycle, data model and privacy boundaries.
- [Development guide](docs/DEVELOPMENT.md) — local setup, testing and safe change recipes.
- [Fresh-deployment acceptance](docs/FRESH_DEPLOYMENT_ACCEPTANCE.md) — validate the installation
  guide safely in disposable Cloudflare resources.
- [Agent-assisted installation](docs/AGENT_INSTALLATION.md) — a resumable setup checklist for Codex
  and other assistants, using the same deployment guide and verification commands.
- [Backup, restore and upgrade](docs/BACKUP_RESTORE_UPGRADE.md) — protect family data, practise
  recovery and update an installation safely.
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
npm run setup:check  # read-only validation of a configured deployment
npm run test         # tests inside the Workers runtime
npm run build        # production Worker build
npm run quality      # complete local/CI quality gate
```

Wrangler creates local Cloudflare state under `.wrangler/`. Development requests to a localhost URL use a fixed local-only identity; production builds always require a valid Cloudflare Access assertion.

See the [development guide](docs/DEVELOPMENT.md) before changing the database, authentication or
Cloudflare configuration.

## Deployment model

`main` is the development channel and continues to power the reference installation. `stable` is the recommended release channel: publishing a stable GitHub release runs both repository gates and advances it to the tested tagged commit. The first successful release creates the branch. See [Release channels](docs/RELEASES.md) for promotion, channel selection and the remaining independent-account delivery work. Fork owners manage their own updates.

A normal family installation runs with a free Cloudflare account and the included `workers.dev`
address; a paid plan and custom domain are optional. The [installation guide](docs/DEPLOYMENT.md) starts before account setup, links to the current
Workers, D1, Browser Run, Workers AI, Access and Builds allowances, and explains what happens if a
free limit is reached.

Configure Cloudflare Access with an **exact email allow-list** before adding family data. One-time PIN
provides the friendly sign-in method, while exact-email rules keep admission invitation-only.

The Worker also verifies Access JWTs itself and fails closed if the team domain, application audience or assertion is absent or invalid. Only the explicitly configured initial organiser can create the first member; after one
additional scoped Cloudflare API token is configured, they can add exact sign-in addresses from the
**Your family** page without using the Cloudflare dashboard. The application prepares an invitation
to copy but does not send email itself.

## Release progress

See [docs/ROADMAP.md](docs/ROADMAP.md) for the phased implementation plan.

## Open source and contributions

This project is MIT licensed, intentionally fork-friendly and guided by a focused maintainer-led
roadmap. Issues and ideas are welcome, and [CONTRIBUTING.md](CONTRIBUTING.md) explains how to shape a
proposal for the best fit.

Development tooling was supported by Furls Digital Ltd. See
[project stewardship and support](docs/STEWARDSHIP.md) for the precise relationship, development
process and optional Buy Me a Coffee link.

## Optional setup help

Follow the [free installation guide](docs/DEPLOYMENT.md), or ask
[Furls Digital Ltd for a setup quote](https://familywishlist.org/setup-help/). The software remains
free and the app and database run in your own Cloudflare account. Paid help covers the work agreed
in your quote; ongoing maintenance, updates and support are agreed separately.

## Security

An [AI-assisted adversarial security review](docs/SECURITY_REVIEW.md) was performed with OpenAI
Daybreak Blue on 1 September 2026. All five original findings were fixed, and the final review of
commit `ad9571c` found no remaining actionable findings in the reviewed source. The transparent
report preserves the evidence, remediation record, exact commits, scope and review boundaries.

Suspected vulnerabilities have a dedicated private reporting route in [SECURITY.md](SECURITY.md).

---

<sub>Family Wishlist is an independent project, not affiliated with or endorsed by Cloudflare, Inc.
Cloudflare and Cloudflare Workers are trademarks and/or registered trademarks of Cloudflare, Inc.
in the United States and other jurisdictions. The “Runs on Cloudflare” badge is a text-only platform
reference, not an official Cloudflare logo. See <a href="https://www.cloudflare.com/trademark/">trademark guidance</a>.</sub>
