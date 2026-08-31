# Cloudflare Family Wishlist

This is a private, self-hosted family wishlist for one household per deployment. It runs as a
Cloudflare Worker with D1 and sits behind Cloudflare Access. Work directly on `main`; successful
pushes are deployed automatically by Cloudflare Builds.

## Start here

Read these before making a material change:

1. [docs/PRODUCT.md](docs/PRODUCT.md) — the user model, supported workflows and non-goals.
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — request flow, data model and privacy boundaries.
3. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — setup, tests and safe change recipes.
4. [docs/DESIGN.md](docs/DESIGN.md) for interface or copy work.
5. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Cloudflare setup or operations.

The maintainer checkout may contain `.private/WRANGLER_PROFILE.md`. It is deliberately ignored and
contains account-specific operational context. Read it before using Wrangler against the reference
deployment, never quote its contents into public files, and never commit it.

## Stack

- React Router v8, React 19 and TypeScript
- Cloudflare Vite plugin and Wrangler
- Cloudflare D1
- Tailwind CSS 4
- Vitest with `@cloudflare/vitest-plugin`

Retrieve current Cloudflare and React Router documentation before relying on API signatures or configuration fields.

## Five-minute mental model

- Cloudflare Access is the admission list and login UI. The application does not store passwords or
  send login email.
- A successfully authenticated email is provisioned as one `member` plus one `wishlist` on first
  request. Access admission must happen before provisioning; there is no public sign-up flow.
- The first provisioned member has the `admin` role and is called the family organiser in the UI.
  Later members default to `member`; role currently controls only the `/family` admission page.
- Every admitted member can see and edit every wishlist. “Owner” and “gift-giver” are contextual
  relationships, not permission roles.
- Claims are separate rows. Other family members can see them; the wishlist owner must not receive
  them at all. The SQL join and the returned TypeScript union enforce this.
- React Router loaders and actions call the D1 service layer. Core flows use ordinary server-rendered
  forms and do not depend on client JavaScript.

## Code map

| Area                                                | Source of truth                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Worker entry, authentication gate, headers and CSP  | `workers/app.ts`                                                                                   |
| Access JWT validation and local-only identity       | `app/lib/auth/access.ts`                                                                           |
| Request context                                     | `app/lib/context.ts`                                                                               |
| First-login member/list provisioning                | `app/lib/db/members.ts`                                                                            |
| Family roles, waiting invitations and Access writes | `app/routes/family.tsx`, `app/lib/db/family-members.ts`, `app/lib/cloudflare/access-membership.ts` |
| Wishlist queries, mutations and claim privacy       | `app/lib/db/wishlists.ts`                                                                          |
| Form dispatch and current UI                        | `app/routes/home.tsx`                                                                              |
| App shell and error boundary                        | `app/root.tsx`                                                                                     |
| Visual system                                       | `app/app.css`, `app/components/`                                                                   |
| Database schema                                     | `migrations/`                                                                                      |
| Worker bindings and deployment config               | `wrangler.jsonc`                                                                                   |
| Workers-runtime test setup                          | `vitest.config.ts`, `test/apply-migrations.ts`                                                     |

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

For a normal change:

1. Read the relevant source, tests and documentation before editing.
2. Keep route code concerned with HTTP/forms and put database rules in `app/lib/db/`.
3. Add or update tests for invalid input, permission/privacy boundaries, concurrency and the happy path.
4. Update the relevant documentation when behaviour, setup or operational steps change.
5. Review `git diff`, then run `npm run quality` and `npm run audit`.

Do not apply remote D1 migrations, edit Access policy, alter DNS, deploy manually or otherwise mutate
the reference Cloudflare account unless the maintainer explicitly asks. Local migrations and local
development data are safe within this repository.

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
- The organiser adds exact emails through `/family`; the Worker uses a scoped Access policy API
  token and does not send invitation email.
- Keep the normal family deployment within Cloudflare's free tier and minimise setup.

## Definition of done

A change is not finished until its implementation, tests and documentation agree; the privacy
invariants still hold; the complete diff has been reviewed; and both required gates pass. For visual
work, also inspect desktop and narrow mobile layouts and exercise the affected form flow rather than
relying on a build alone.
