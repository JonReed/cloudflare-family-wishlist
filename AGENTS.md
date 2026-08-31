# Cloudflare Family Wishlist

Private family wishlist deployed as a Cloudflare Worker.

## Stack

- React Router v8, React 19 and TypeScript
- Cloudflare Vite plugin and Wrangler
- Cloudflare D1
- Tailwind CSS 4
- Vitest with `@cloudflare/vitest-plugin`

Retrieve current Cloudflare and React Router documentation before relying on API signatures or configuration fields.

## Commands

- `npm run dev` — local development in the Workers runtime
- `npm run format` / `npm run format:check` — formatting
- `npm run lint` — zero-warning ESLint
- `npm run typecheck` — generated bindings, route types and TypeScript
- `npm run test` — tests in the Workers runtime
- `npm run build` — production build
- `npm run quality` — required gate before every commit or push
- `npm run audit` — dependency vulnerability gate
- `npm run cf-typegen` — regenerate binding types after Wrangler config changes

## Workflow

- Work directly on `main`; do not create branches or pull requests unless the maintainer changes this policy.
- Plan first, implement second, review the complete diff third.
- Run `npm run quality` and `npm run audit` before every commit or push.
- Do not run a manual production deployment unless explicitly requested; `main` is connected to Cloudflare Builds.
- Preserve unrelated or user-authored changes.

## Security and privacy

- The owner of a wishlist must never receive claim or purchase data for their own items. Enforce this in server queries/services, not only in the UI.
- Validate the Cloudflare Access JWT signature, issuer and application audience. Fail closed if Access is missing or misconfigured.
- Use D1 prepared statements with `.bind()` for every user-controlled value. Never interpolate input into SQL.
- Use random UUIDs for externally visible identifiers.
- Validate all loader/action input at the server boundary.
- External item links must be HTTP(S), must not contain credentials and must be rendered safely.
- Never log Access assertions, tokens, private claim data or sensitive query strings.
- Never commit `.env`, `.dev.vars`, credentials or real database exports.
- Run `wrangler types` after changing bindings; do not hand-write binding interfaces.
- No mutable request-specific state at module scope and no floating promises.
- Do not weaken CSP with `unsafe-inline` or `unsafe-eval`. Wire a per-response nonce before adding browser scripts.

## Product scope

- One wishlist per member.
- All admitted family members can view and edit all wishlists.
- Claim state is visible to other gift-givers but hidden from the list owner.
- Authentication is Cloudflare Access email OTP with an exact email allow-list.
- Keep the normal family deployment within Cloudflare's free tier and minimise setup.
