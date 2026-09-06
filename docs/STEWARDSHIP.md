# Project stewardship and support

Cloudflare Family Wishlist is an independent open-source project maintained by
[Jon Reed](https://github.com/JonReed). It exists to give families a small, private wishlist they can
run themselves comfortably on Cloudflare's free tier.

## How the work is supported

Development tooling and access to OpenAI Codex and Daybreak Blue were funded through
[Furls Digital Ltd](https://furls.co.uk/), providing a clear and transparent development provenance.

The reference deployment belongs to Jon's family. Other families operate their own independent
deployments, keeping their wishlist data within their chosen Cloudflare account. This is an
open-source project rather than a hosted Furls service.

## Public website and optional setup help

[familywishlist.org](https://familywishlist.org/) is the public product website, operated by Furls
Digital Ltd. It provides a screenshot tour, plain-language product information and an optional
[paid setup service](https://familywishlist.org/setup-help/). The application remains a separate,
MIT-licensed open-source project maintained by Jon Reed.

Setup work is supplied and invoiced by Furls Digital Ltd, with scope and price agreed in a quote
before work starts. The app and database run in the family's own Cloudflare account; any setup
access and handover are agreed with the customer. Ongoing maintenance, updates and support are
agreed separately, not included merely by using the software or paying for installation.

Self-hosting does not require purchasing help. The [installation guide](DEPLOYMENT.md) remains
freely available. The website's [setup terms](https://familywishlist.org/setup-terms/) and
[privacy notice](https://familywishlist.org/privacy/) cover that website and service; they are not
a privacy notice for every family's independent installation. Each operator remains responsible
for their installation's access, updates and backups.

## Development and review process

The project was built with substantial AI assistance under maintainer direction. Repository guidance,
automated tests, type checking, linting, production builds, dependency auditing and small, reviewable
commits make that work inspectable and give adopters concrete evidence they can review.

OpenAI Daybreak Blue performed an AI-assisted adversarial source review. The
[complete security report](SECURITY_REVIEW.md) preserves the reviewed commits, original findings,
remediation history, final verification and clearly defined review scope.

The project offers practical trust signals that anybody can inspect:

- the complete source and MIT licence;
- the published product, architecture and security boundaries;
- the original security findings and their fixes;
- automated Workers-runtime tests and CI checks; and
- exact commit references for the final security verification.

## Governance

The source is intentionally fork-friendly, while the upstream project follows a focused,
maintainer-led roadmap. Issues and ideas are welcome, with early discussion helping each proposal
find the best route upstream or in a specialised fork.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for the contribution policy and
[SECURITY.md](../SECURITY.md) for private vulnerability reporting.

## Optional support

Family Wishlist is free to use and self-host under the MIT licence. If it saves your family some time,
you can optionally [buy Jon a coffee](https://buymeacoffee.com/jonmreed). Contributions are a simple
thank-you; product decisions continue to follow the published family-first principles.
