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
    |       +--> bounded public-page metadata fetch (app/lib/product-metadata.ts)
    |                  |
    |                  +--> optional cleaned-text fallback (Workers AI)
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
5. Forms post an explicit intent to an action. React Router verifies that the browser origin matches
   the request origin before the action validates the request shape, invokes a service mutation and
   redirects. The add form can instead request an editable draft from a product link without creating
   an item.
6. `/add?url=` is the bookmarklet landing route. It loads an editable product draft and all family
   list choices; its action inserts one independent item per selected list with a guarded D1 statement.
7. The Worker adds private caching, CSP and other defensive response headers to every response.

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

| Layer                                             | Responsibility                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `workers/app.ts`                                  | Production request boundary, Access enforcement, response headers and router entry |
| `app/lib/auth/access.ts`                          | Access JWT verification and tightly constrained local identity                     |
| `app/lib/context.ts`                              | Typed identity and binding handoff to loaders/actions                              |
| `app/routes/home.tsx`                             | HTTP-level loading, form intent dispatch and page composition                      |
| `app/routes/add.tsx`                              | Bookmarklet landing page, multi-list chooser and save action                       |
| `app/routes/bookmarklet.tsx`                      | Browser-button installation and visual drag guidance                               |
| `app/routes/product-details.ts`                   | Same-origin progressive-enhancement endpoint for product-link metadata             |
| `app/lib/bookmarklet.ts`, `public/bookmarklet.js` | Deployment-specific bookmarklet generation and safe browser installation           |
| `app/lib/product-metadata.ts`                     | Bounded public-page fetching, redirect policy and metadata extraction              |
| `app/lib/db/members.ts`                           | Identity normalisation and member/list provisioning                                |
| `app/lib/db/wishlists.ts`                         | Domain validation, reads, mutations, claim ownership and privacy                   |
| `migrations/`                                     | Append-only persistent schema history                                              |
| `app/root.tsx`, `app/app.css`, `app/components/`  | Document shell, design system and shared presentation                              |

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
  position, title, notes, product link, image link, price, priority
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

The product-link helper is the one progressively enhanced interaction: a small nonce-authorised,
self-hosted script starts the lookup after a link is pasted or changed. The ordinary “Fill from link”
form action remains the fallback when JavaScript is unavailable, and creating a wish never depends on
the script. The server remains authoritative. `unsafe-inline` and `unsafe-eval` are not acceptable
shortcuts.

The browser-button setup page exposes the bookmarklet and profile links to that page. React does not
server-render a `javascript:` link; a small nonce-authorised, self-hosted script copies a
server-generated, deployment-specific value from a data attribute into the draggable link. The
bookmarklet carries only the current page URL to `/add`; authentication, metadata lookup, validation
and saving all remain inside the protected Worker.

Multi-list adds use one parameter-bound `INSERT … SELECT` statement. A completeness check inside the
statement suppresses every insert when any selected wishlist no longer exists, avoiding partial saves.
The wishlist primary key and existing `(wishlist_id, position, created_at)` item index support the
selection join and per-list position lookup.

## Product-page extraction

Product import is deliberately staged:

1. Fetch at most 512 KiB from a public HTTP(S) target, with manual redirect validation and an
   eight-second timeout.
2. Detect verification and CAPTCHA pages before accepting any details or invoking AI. Retry once,
   using a clean canonical product URL where a retailer adapter can derive one, then leave the form
   available for manual entry if the product is still blocked.
3. Run the bounded HTML through one native `HTMLRewriter` evidence pass. Ordered rules prefer a
   retailer's explicit current/base price and primary product image, then JSON-LD, Open Graph,
   schema.org microdata and known visible product fields. Retailer adapters contain narrowly scoped
   rules such as Amazon UK title cleanup, price selection and high-resolution image selection;
   standard metadata remains the default for every other site.
4. If a reliable title or GBP price is still missing and AI is enabled, remove scripts, styles,
   navigation, site headers and footers, forms, cookie controls, adverts, recommendations, reviews,
   social controls and repeated text. Headings, price-adjacent lines and main product content are
   prioritised, deduplicated and capped at 10,000 characters. If deterministic rules found no image,
   collect at most eight public HTTPS image candidates from that same reduced page, rejecting obvious
   logos, icons, tracking pixels and small assets.
5. Ask the configured Workers AI model only for the missing fields and, when candidates exist, the
   index of the most likely primary product image. Page evidence is explicitly treated as untrusted
   data, not instructions. A returned title or price is accepted only when it appears in the reduced
   source text; an image selection is accepted only when its integer index resolves to the original
   validated candidate. The model cannot provide or invent an image URL.
6. Return an editable draft. AI timeouts, exhausted free allocation, capacity errors and invalid
   output quietly leave the deterministic result in place.

Product images remain HTTPS URLs rather than copied binary data. Deterministic metadata remains the
first choice; AI image selection happens only as part of an already-needed text fallback and only
from the page's bounded candidate list. Images are optional, editable and loaded with no cross-site
referrer. Literal local/private-network addresses and credential-bearing URLs are rejected because
an image loads automatically in the family member's browser. This keeps the feature within the
existing Worker and D1 setup; no R2 bucket or image-processing service is required.

No Access assertion, cookie, family data or requesting-user identity is sent to the model. The model
cannot fetch another URL, invoke a tool or persist anything. Only the ordinary add-wish action can
save the checked draft.

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
- **Workers AI:** optional fallback extraction for poorly marked-up public product pages.
- **Workers Logs:** operational logs without assertions, private claims or sensitive query strings.

R2, KV, Queues and application-managed email are intentionally absent. Introduce another service only
for a concrete requirement, with free-tier and setup impact documented. Product import continues to
work without Workers AI; the binding is included because it materially improves the existing helper
without becoming a new persistence or availability dependency.

## Security and caching baseline

- all application documents are `private, no-store`;
- CSP allows only the resources the application currently needs and no third-party scripts/fonts;
- form actions remain same-origin, with a `same-origin` referrer policy so browsers send a verifiable
  `Origin` header for ordinary HTML form posts;
- external product links accept only HTTP(S), reject embedded credentials and render safely;
- automatically loaded product images accept only HTTPS, reject embedded credentials and obvious
  local/private-network targets, and send no cross-site referrer;
- product metadata fetches accept only public HTTP(S) pages, validate each redirect, send no user
  credentials, stop after 8 seconds, inspect at most 512 KiB of HTML and reject verification pages;
- AI receives at most 10,000 characters of reduced public-page text, returns only draft fields and
  cannot override deterministic metadata or persist data;
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
