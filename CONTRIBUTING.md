# Contributing

Thank you for taking an interest in Cloudflare Family Wishlist.

This is an open-source, maintainer-led project. Families can inspect it, deploy it and freely adapt
their own fork, while the upstream project follows a deliberately focused product direction.

## Shape a successful contribution

Please open an issue before starting a substantial change. Early discussion helps match ideas to the
project's small scope, simple setup and sustainable maintenance model. Contributions that fit that
direction are especially welcome; forks are encouraged for equally good ideas with a different
product vision.

## Project principles

- Keep setup easy for non-specialist family administrators.
- Stay viable on Cloudflare's free tier for normal family use.
- Keep claim information secret from the recipient at the server boundary.
- Prefer fewer services, dependencies and configuration steps.
- Keep the core experience accessible and usable without JavaScript.
- Preserve the calm, advertising-free experience and its freedom from tracking or affiliate links.

## Development

Run the complete gate before proposing a change:

```sh
npm install
npm run quality
npm run audit
```

Keep credentials, `.dev.vars`, Access tokens, personal database exports and private production
identifiers safely outside commits.
