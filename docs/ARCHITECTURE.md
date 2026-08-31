# Architecture

## Goals

The application should be secure, private, inexpensive and straightforward for a family to operate. A normal family deployment should remain within Cloudflare's free allowances without relying on a separate server, database or email provider.

## System shape

```text
Family member
    |
    v
Cloudflare Access
exact email allow-list + emailed one-time PIN
    |
    v
Cloudflare Worker
Access JWT validation -> React Router loaders/actions
    |
    v
Cloudflare D1
members, wishlists, items and private claims
```

Cloudflare Access is the outer access boundary. The Worker also validates the Access JWT and its audience before trusting the email identity. Missing or invalid Access configuration fails closed.

## Framework decision

The project uses React Router v8 in full-stack framework mode with Cloudflare's Vite plugin.

Why:

- loaders and actions keep reads and mutations on the server, which is valuable for claim privacy;
- the Cloudflare Vite plugin runs local server code in the Workers runtime with local bindings;
- React Router and Cloudflare support this route as production-ready;
- it avoids the compatibility layer and larger surface area of Next.js;
- it avoids the duplicated client API/state layer of a Hono plus React SPA architecture;
- it has a broad, well-understood React ecosystem while remaining comparatively small.

SvelteKit was evaluated and is a sound option, but offered no material advantage for this application. The React Router scaffold also began with a clean dependency audit.

## Server-first user interface

The application starts with progressively enhanced server-rendered pages and ordinary HTML forms. Core wishlist and claim operations must work without browser JavaScript. This keeps the initial payload small, provides a strong accessibility baseline and permits a strict Content Security Policy.

JavaScript can be added later for interactions where it creates a clear benefit. Any inline scripts must use a per-response CSP nonce; `unsafe-inline` and `unsafe-eval` are not acceptable shortcuts.

## Data and privacy invariants

These rules are architectural, not merely presentational:

1. A member has exactly one wishlist.
2. Only identities admitted by the deployment's Cloudflare Access policy can enter the application.
3. All admitted members may view and edit all family wishlists.
4. The owner of a wishlist must never receive claim or purchase information for their own items—not in HTML, loader data, API responses, logs or errors.
5. Other members may see claim state so they can avoid duplicate gifts.
6. All database values are passed through D1 prepared statements; user input is never interpolated into SQL.
7. Public resource identifiers use random UUIDs rather than sequential database identifiers.

Claim privacy is enforced in the server query/service layer: the owner-facing query cannot join claim rows, and owner item objects omit the claim field entirely. UI hiding alone is not considered a security boundary.

## Cloudflare services

- **Workers:** application compute and server rendering.
- **D1:** relational application data and migrations.
- **Access:** invitation-only authentication using an exact email allow-list and one-time PINs.
- **Workers Logs:** sampled operational logs. Logs must not contain Access tokens, item claim surprises or sensitive query strings.

R2, KV, Queues and application-managed email are intentionally absent from the first release. They can be introduced only when a concrete requirement justifies the extra setup.

## Security baseline

- strict CSP, with no third-party scripts or fonts;
- private, no-store responses for application documents;
- no secrets in source, Wrangler variables or client bundles;
- generated Wrangler binding types;
- schema validation at all mutation boundaries;
- same-origin actions and safe HTTP(S)-only external product links;
- structured server errors without leaking internals;
- dependency, lint, type, test and production build gates.
