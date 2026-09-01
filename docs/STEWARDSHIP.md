# Project stewardship and support

Cloudflare Family Wishlist is an independent open-source project maintained by
[Jon Reed](https://github.com/JonReed). It exists to give families a small, private wishlist they can
run themselves without paying for hosting.

## How the work is supported

Development tooling and access to OpenAI Codex and Daybreak Blue were funded through
[Furls Digital Ltd](https://furls.co.uk/). This is recorded to make the project's provenance clear,
not to present Furls as an independent security auditor or certification body.

The reference deployment is Jon's personal family deployment. Furls Digital Ltd does not host family
wishlists for other people, receive their wishlist data or offer a commercial service-level agreement
for this project.

## Development and review process

The project was built with substantial AI assistance under maintainer direction. Repository guidance,
automated tests, type checking, linting, production builds, dependency auditing and small, reviewable
commits are used to make that work inspectable rather than asking people to trust generated code on
reputation alone.

OpenAI Daybreak Blue performed an AI-assisted adversarial source review. The
[complete security report](SECURITY_REVIEW.md) preserves the reviewed commits, original findings,
remediation history, final verification and important limitations. It is not an independent audit,
certification or penetration test, and it cannot guarantee that either the source or a particular
Cloudflare deployment is vulnerability-free.

The most useful trust signals are therefore the ones anybody can inspect:

- the complete source and MIT licence;
- the published product, architecture and security boundaries;
- the original security findings and their fixes;
- automated Workers-runtime tests and CI checks; and
- exact commit references for the final security verification.

## Governance

The source is intentionally fork-friendly, while the upstream project remains maintainer-led. Issues
and ideas are welcome, but there is no promise that a feature request or pull request will be accepted.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for the contribution policy and
[SECURITY.md](../SECURITY.md) for private vulnerability reporting.

## Optional support

Family Wishlist is free to use and self-host under the MIT licence. If it saves your family some time,
you can optionally [buy Jon a coffee](https://buymeacoffee.com/jonmreed). Contributions are a thank-you
and do not purchase support, feature work or influence over the project roadmap.
