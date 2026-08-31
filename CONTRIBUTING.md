# Contributing

Thank you for taking an interest in Cloudflare Family Wishlist.

This is an open-source, maintainer-led project. The source is available so families can inspect it, deploy it and fork it—not as a promise that every proposed feature or pull request will be merged.

## Before writing code

Please open an issue before starting a substantial change. Unsolicited pull requests may be closed when they do not match the project's deliberately small scope or current direction. The maintainer may decline a change for any reason, including ongoing maintenance cost, added setup or a preference for a simpler product.

That is not a judgement on the quality of the contribution. Forks are welcome and encouraged when a different direction is useful.

## Project principles

- Keep setup easy for non-specialist family administrators.
- Stay viable on Cloudflare's free tier for normal family use.
- Keep claim information secret from the recipient at the server boundary.
- Prefer fewer services, dependencies and configuration steps.
- Keep the core experience accessible and usable without JavaScript.
- Do not add advertising, tracking or affiliate links.

## Development

Run the complete gate before proposing a change:

```sh
npm install
npm run quality
npm run audit
```

Never commit credentials, `.dev.vars`, Access tokens, database exports containing personal data or production identifiers that should remain private.
