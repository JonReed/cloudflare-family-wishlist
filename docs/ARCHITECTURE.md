# Architecture

## Goals

The application should be secure, private, inexpensive and straightforward for a family to operate.
A normal family deployment should remain within Cloudflare's free allowances without a separate
server, database, identity store or email provider.

The product rules that shape this architecture are recorded in [PRODUCT.md](PRODUCT.md).

## System shape

```text
Family member
    |
    v
Cloudflare Access
exact email allow-list + emailed one-time PIN
    |
    v  Cf-Access-Jwt-Assertion
Cloudflare Worker (workers/app.ts)
JWT verification + security headers + React Router request handler
    |
    +--> loader/action (app/routes/home.tsx)
    |       |
    |       +--> member provisioning (app/lib/db/members.ts)
    |       +--> wishlist service (app/lib/db/wishlists.ts)
    |
    v
Cloudflare D1
members, wishlists, items and private claims
```

Cloudflare Access is the outer admission boundary. The Worker independently validates the Access JWT
signature, issuer, application audience, expiry and required identity claims before trusting the
email. Missing or invalid production configuration fails closed.

## Request lifecycle

1. Access rejects identities outside the deployment's exact email allow-list and handles the OTP UI.
2. `workers/app.ts` verifies the Access assertion and builds an immutable request context containing
   the verified identity and D1 binding.
3. The home loader calls `ensureMemberForEmail()`. Unique database constraints make concurrent first
   requests converge on one member and one wishlist.
4. The loader requests all family wishlists for the viewer. Their own list sorts first; `?list=` chooses
   the active list rendered in the document.
5. Forms post an explicit intent to the home action. The action validates the request shape, invokes a
   service mutation and redirects back to the selected list.
6. The Worker adds private caching, CSP and other defensive response headers to every response.

Authentication happens before provisioning. There is no application endpoint that accepts an email
address and creates a member without a verified Access identity.

## Framework decision

The project uses React Router v8 in full-stack framework mode with Cloudflare's Vite plugin.

Why:

- loaders and actions keep reads and mutations on the server, which is valuable for claim privacy;
- the Cloudflare Vite plugin runs local server code in the Workers runtime with local bindings;
- React Router and Cloudflare support this route as production-ready;
- it avoids the compatibility layer and larger surface area of Next.js;
- it avoids the duplicated client API/state layer of a Hono plus React SPA architecture; and
- it has a broad React ecosystem while remaining comparatively small.

SvelteKit was evaluated and is a sound option, but offered no material advantage here.

## Source boundaries

| Layer                                            | Responsibility                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `workers/app.ts`                                 | Production request boundary, Access enforcement, response headers and router entry |
| `app/lib/auth/access.ts`                         | Access JWT verification and tightly constrained local identity                     |
| `app/lib/context.ts`                             | Typed identity and binding handoff to loaders/actions                              |
| `app/routes/home.tsx`                            | HTTP-level loading, form intent dispatch and page composition                      |
| `app/lib/db/members.ts`                          | Identity normalisation and member/list provisioning                                |
| `app/lib/db/wishlists.ts`                        | Domain validation, reads, mutations, claim ownership and privacy                   |
| `migrations/`                                    | Append-only persistent schema history                                              |
| `app/root.tsx`, `app/app.css`, `app/components/` | Document shell, design system and shared presentation                              |

Keep security and database rules below the component layer. A visual condition is allowed to explain a
rule to the user, but it must not be the only enforcement of that rule.

## Data model

```text
members
  id (UUID) PK
  email UNIQUE
  display_name
       |
       | 1:1 (wishlists.owner_member_id is UNIQUE)
       v
wishlists
  id (UUID) PK
  owner_member_id FK
       |
       | 1:many
       v
items
  id (UUID) PK
  wishlist_id FK
  created_by_member_id FK -> members
  position, title, notes, product link, price, priority
       |
       | 1:0..1 (claims.item_id is the primary key)
       v
claims
  item_id PK/FK
  claimed_by_member_id FK -> members
  state: claimed | purchased
```

Tables are SQLite `STRICT` tables with foreign keys, length/state checks and indexes for wishlist
ordering and member claims. Externally visible IDs are UUIDs. A new schema change must be a new numbered
migration; applied migrations are immutable history.

## Claim privacy by construction

The most important boundary is implemented twice in the wishlist service:

1. `LIST_FAMILY_WISHLISTS` joins `claims` only when the wishlist owner is not the current viewer. D1
   therefore does not return the owner's claim row to application rendering code.
2. `WishlistItem` is a discriminated union. Owner items are
   `{ claimVisibility: 'hidden' }` and have no `claim` property; other items explicitly carry a visible
   claim value or `null`.

This is intentionally stronger than selecting all claims and hiding them in JSX. Future JSON routes,
logs, caching or UI refactors must preserve the same omission. Tests should fail if an owner's result
shape gains claim data.

Claims also use `item_id` as their primary key. The database, rather than a check-then-write sequence,
ensures two family members cannot both hold the same item. Release and purchase mutations verify the
current claimant so one member cannot change another member's claim.

## Server-first user interface

The application uses progressively enhanced server-rendered pages and ordinary HTML forms. Core
wishlist and claim operations work without browser JavaScript. This keeps the payload small, gives a
strong accessibility baseline and permits a strict Content Security Policy.

JavaScript can be introduced for an interaction with a clear benefit, but the server remains
authoritative. Inline scripts require a per-response CSP nonce; `unsafe-inline` and `unsafe-eval` are
not acceptable shortcuts.

## Local and production identity

Production accepts only a verified Access assertion for the configured team issuer and application
audience. It returns a generic authentication failure when the assertion is invalid and a service
configuration failure when required settings are missing.

Development can synthesise one fixed email only when both conditions are true:

- the bundle is running in Vite's development mode; and
- the request hostname is loopback (`localhost`, `127.0.0.1` or `[::1]`).

This mechanism avoids storing developer credentials and cannot be enabled through a production
environment variable.

## Cloudflare services

- **Workers:** application compute and server rendering.
- **D1:** relational application data and migrations.
- **Access:** invitation-only authentication using an exact email allow-list and one-time PINs.
- **Workers Logs:** operational logs without assertions, private claims or sensitive query strings.

R2, KV, Queues and application-managed email are intentionally absent. Introduce another service only
for a concrete requirement, with free-tier and setup impact documented.

## Security and caching baseline

- all application documents are `private, no-store`;
- CSP allows only the resources the application currently needs and no third-party scripts/fonts;
- form actions are same-origin;
- external product links accept only HTTP(S), reject embedded credentials and render safely;
- every user-controlled database value uses a prepared statement with `.bind()`;
- mutations validate type, length, UUID, ownership and allowed state at the server boundary;
- errors shown to users do not reveal internals;
- logs omit tokens, private claim surprises and query strings; and
- format, lint, type, Workers-runtime tests, build and dependency audit gate every push.

## Deployment boundary

`main` is connected to Cloudflare Builds for the reference deployment. Application deployments are
automatic after a push; Access membership, DNS and D1 migration changes are separate Cloudflare
operations. They must not be inferred from an application code request.

Public fork setup is documented in [DEPLOYMENT.md](DEPLOYMENT.md). The maintainer checkout may also
contain an ignored `.private/WRANGLER_PROFILE.md` with account-specific context; it must remain private.
