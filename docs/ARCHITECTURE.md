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
    |                  +--> cleaned product-detail enrichment (Workers AI)
    |
    +--> organiser-only family route (app/routes/family.tsx)
            |
            +--> exact-email policy creation (Cloudflare Access API)
    |
    v
Cloudflare D1
members, pending family invitations, wishlists, items and private claims
```

Cloudflare Access is the outer admission boundary. The Worker independently validates the Access JWT
signature, issuer, application audience, expiry and required identity claims before trusting the
email. Missing or invalid production configuration fails closed.

The only exception is a deliberately configured, path-specific Access Bypass for revocable viewing
links. The Worker independently recognises only read-only `/shared/<secret>` list and image paths;
all neighbouring paths and every mutation still require a valid Access identity. More-specific Access
paths also expose only the compiled stylesheet under `/shared-assets/*` and the favicon needed to
render that public page. Authenticated JavaScript bundles, the web manifest and install icons remain
behind Access.

Before creating a viewing token, the authenticated action calls
`ensurePublicSharingAccess()` with the request hostname. It lists every Access application, accepts
only the deterministic application containing exactly those three public destinations and one
Everyone Bypass policy, or creates that exact application. Configuration drift fails closed before
D1 changes. The setup command calls the same function, so installation preflight and runtime
enforcement cannot disagree.

## Request lifecycle

1. Access rejects identities outside the deployment's exact email allow-list and handles the OTP UI.
2. `workers/app.ts` verifies the Access assertion and builds an immutable request context containing
   the verified identity and D1 binding.
3. A route calls `ensureMemberForEmail()`. Unique database constraints make concurrent first
   requests converge on one member and one wishlist. Only the email in `INITIAL_ORGANISER_EMAIL` can
   create the first admin; subsequent people require a completed exact-email invitation.
4. The loader requests all family wishlists for the viewer. Their own list sorts first; `?list=` chooses
   the active list rendered in the document.
5. Forms post an explicit intent to an action. Before authentication or routing, the Worker requires
   a non-opaque `Origin` that exactly matches the request origin and reads at most 32 KiB of supported
   form data. React Router repeats its own origin check before the action validates the request shape,
   invokes a service mutation and redirects. The add form can instead request an editable draft from
   a product link without creating an item.
6. `/share-target` extracts a validated web link from Android share parameters and redirects to
   `/add?url=`. That add route is also the landing route for the iPhone/iPad Share Sheet Shortcut,
   copied links and the desktop bookmarklet. It loads an editable product draft and all family list
   choices; its action inserts one independent item per selected list with a guarded D1 statement.
7. The Worker adds private caching, CSP and other defensive response headers to every response.
8. A read-only shared-list request skips identity validation only when its method and path exactly
   match the public route boundary. It hashes the URL secret and runs a separate D1 query that does
   not reference `claims`. Shared pictures require the same secret plus an item belonging to that
   list, pass through the bounded raster proxy and consume both a capability-holder budget and a
   higher list-wide emergency budget. A HEAD request verifies membership but does not fetch or count
   the upstream picture.

The organiser-only `/family` action is the one flow that changes the Access admission boundary. It
validates the organiser role and proposed name/email and writes a non-admitting `pending` invitation
before creating a single exact-email application policy through Cloudflare's API. It marks the row
`active` only after Cloudflare succeeds. If activation fails, it attempts to delete the policy; a
failed rollback is retained as `cleanup_required` with the policy ID. Neither `pending` nor
`cleanup_required` can provision a member, so Access and D1 failures remain fail-closed. The API token
is a Worker secret and is never returned to loaders, HTML or logs.

The family page exposes interrupted `pending` and `cleanup_required` invitations to the organiser.
Repair first obtains a pagination-verified complete list of the application's Access policies and
reuses only one exact policy-name and exact-email match; otherwise it creates a fresh exact-email
policy. Duplicate or incomplete results fail closed.
Removing an ordinary member first sets `members.disabled_at`, so a still-valid Access session cannot
reach application data, then deletes the exact-email policy and revokes every session for this Access
application. The final D1 state retains the member, wishlist and history while removing admission.
An interrupted removal remains visible and can be finished safely; deleting an already absent policy
is idempotent.

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
| `app/routes/add.tsx`                             | Product-link draft landing page, multi-list chooser and save action                |
| `app/routes/bookmarklet.tsx`                     | Android, Share Sheet Shortcut, clipboard and browser-button setup                  |
| `app/routes/share-target.ts`                     | Safe Android shared-text/link handoff to the editable add route                    |
| `app/routes/family.tsx`                          | Organiser-only joined/waiting member administration                                |
| `app/routes/profile.tsx`                         | Personal details and persistent active viewing-link management                     |
| `app/routes/product-details.ts`                  | Same-origin progressive-enhancement endpoint for product-link metadata             |
| `app/lib/bookmarklet.ts`, `public/*.js`          | Deployment-specific add links, installation and progressively enhanced setup tools |
| `app/lib/cloudflare/access-membership.ts`        | Bounded, exact-email Cloudflare Access policy creation and cleanup                 |
| `app/lib/product-metadata.ts`                    | Bounded public-page fetching, redirect policy and metadata extraction              |
| `app/lib/db/members.ts`                          | Identity normalisation and member/list provisioning                                |
| `app/lib/db/family-members.ts`                   | Admin checks, waiting invitations and family roster reads                          |
| `app/lib/db/wishlists.ts`                        | Domain validation, reads, mutations, claim ownership and privacy                   |
| `app/lib/db/shared-wishlists.ts`                 | Hashed viewing links, active-link inventory, public reads and image budgets        |
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
  role: admin | member
  disabled_at, nullable
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

family_invitations
  id (UUID) PK
  email UNIQUE
  display_name
  access_policy_id UNIQUE, nullable while pending
  status: pending | active | cleanup_required | revocation_required | revoked
  invited_by_member_id FK -> members

wishlist_share_links
  id (UUID) PK
  wishlist_id FK -> wishlists (maximum 5 active rows)
  name (private family-facing label, 1..80 characters)
  token_hash UNIQUE
  created_by_member_id FK -> members
  created_at

shared_image_fetch_limits
  wishlist_id PK/FK -> wishlists
  list-wide minute/day counters

shared_image_requester_limits
  wishlist_id + capability-scoped requester hash PK
  requester minute/day counters
```

Tables are SQLite `STRICT` tables with foreign keys, length/state checks and indexes for wishlist
ordering and member claims. Externally visible IDs are UUIDs. A new schema change must be a new numbered
migration; applied migrations are immutable history.

Wishlist reads order items by a priority rank (`high`, `normal`, `low`) and then by descending
creation time. The item expression index mirrors that exact rank expression and includes
`wishlist_id`, `created_at DESC` and `id DESC`, so D1 can search each list's items in the required
order. The family-wide result may still perform a small outer sort to keep the viewer's list first
and the remaining family names alphabetical.

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

## Read-only sharing boundary

A sharing URL carries 16 random bytes encoded as a 22-character URL-safe secret. D1 stores only its
SHA-256 hash, so a database read cannot recover a working link. Each row has a private family-facing
name and a separate internal UUID; an atomic conditional insert enforces at most five active rows per
wishlist. Stopping sharing deletes only the selected UUID. Unknown and removed links return the same
not-found result.

The public query selects the list owner and ordinary item fields directly from `wishlists`, `members`
and `items`. It neither joins nor selects `claims`. Its TypeScript result has no claim field. Shared
image routes look up the stored image only when both the hashed secret and item membership match,
then reuse the public-network, redirect, type and size checks of the signed-in image proxy. A D1-backed
20-per-minute and 100-per-day capability-holder budget prevents one recipient from consuming the
whole allowance. A higher 60-per-minute and 500-per-day list-wide ceiling remains as an emergency
cost bound. The requester key is a SHA-256 derivation salted by the bearer capability; raw network
addresses and reusable cross-link identifiers are never stored.

Public responses remain `private, no-store`, use `Referrer-Policy: no-referrer`, carry a site-wide
`X-Robots-Tag` no-indexing directive and load no third-party scripts or fonts. Application logs redact
capability-bearing paths. Cloudflare's edge can necessarily see the requested URL, so families should
treat each link like an invitation and stop sharing it if it travels beyond the intended people.

## Server-first user interface

The application uses progressively enhanced server-rendered pages and ordinary HTML forms. Core
wishlist and claim operations work without browser JavaScript. This keeps the payload small, gives a
strong accessibility baseline and permits a strict Content Security Policy.

The product-link helper is the one progressively enhanced interaction: a small nonce-authorised,
self-hosted script starts the lookup after a link is pasted or changed. The ordinary “Fill from link”
form action remains the fallback when JavaScript is unavailable, and creating a wish never depends on
the script. The server remains authoritative. `unsafe-inline` and `unsafe-eval` are not acceptable
shortcuts.

The top navigation exposes the **Add from anywhere** setup page. The web app manifest registers an
installed Android PWA as a GET-only share target; `/share-target` validates a dedicated URL or finds
one in Android’s shared text before redirecting to `/add`. The Apple-validated shortcut in
`public/Wishlist.shortcut` uses a one-time import question to store the server-generated
`/add?url=` prefix locally; the matching manual recipe remains a recovery path. The optional clipboard
helper validates a credential-free HTTP(S) link before navigating. React does not server-render the
desktop `javascript:` link; a small nonce-authorised, self-hosted script copies a server-generated,
deployment-specific value from a data attribute into the draggable link. These entry points carry
only the product URL to `/add`; authentication, metadata lookup, validation and saving all remain
inside the protected Worker.

A minimal service worker enables installation but has no fetch handler and creates no caches. The
manifest link uses `crossorigin="use-credentials"` because Cloudflare Access protects that resource
too. Family HTML, identity state and wishlist data therefore remain online-only and continue to
receive `private, no-store`. CSP permits only same-origin workers.

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
first choice; AI image selection happens only as part of an already-needed enrichment pass and only
from the page's bounded candidate list. Browser markup uses the same-origin `/product-image` route,
not the remote address. That route requires a completed family membership, validates every redirect,
relies on Workers public-network fetch enforcement, accepts only five raster formats, buffers at most
4 MiB and caches the safe response for one day in the member's private browser cache. SVG and
ambiguous response types are rejected. This
prevents family browsers from exposing
their address or cookies to an arbitrary picture host and keeps CSP `img-src` same-origin. No R2
bucket or image-processing service is required.

Before any outbound image request, the route consumes a member-scoped D1 budget of 60 fetches per
minute and 500 per UTC day. One atomic upsert checks both limits, so parallel requests cannot step
past either cap.

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
- **Access:** invitation-only authentication using an exact email allow-list, one-time PINs and a
  setup-enforced 30-day application session.
- **Access API:** organiser additions create one exact-email Allow policy using a narrowly scoped
  Worker secret; it does not send invitation email.
- **Workers AI:** product-detail enrichment for incomplete public page metadata.
- **Workers Logs:** operational logs without assertions, private claims or sensitive query strings.

R2, KV, Queues and application-managed email are intentionally absent. Introduce another service only
for a concrete requirement, with free-tier and setup impact documented. Product import continues to
work without Workers AI; the binding is included because it materially improves the existing helper
without becoming a new persistence or availability dependency.

## Security and caching baseline

- all application documents are `private, no-store`;
- CSP allows only the resources the application currently needs and no third-party scripts/fonts;
- form actions remain same-origin, with a `same-origin` referrer policy so browsers send a verifiable
  `Origin` header for ordinary HTML form posts; opaque, missing and cross-origin mutations are rejected
  before authentication, and mutation bodies are capped at 32 KiB;
- external product links accept only HTTP(S), reject embedded credentials and render safely;
- automatically loaded product images pass through the bounded same-origin raster proxy and never
  cause a family browser to contact the remote image host directly;
- product metadata fetches accept only public HTTP(S) pages, validate each redirect and use the same
  restrained desktop-browser navigation profile for initial requests and retries. They never forward
  user headers, credentials, cookies or referrers, stop after 8 seconds, inspect at most 512 KiB of
  HTML and reject verification pages;
- AI receives at most 10,000 characters of reduced public-page text, returns only draft fields and
  cannot override deterministic metadata or persist data;
- every metadata/AI entry point shares a D1-backed budget of 12 lookups per member per minute;
- every user-controlled database value uses a prepared statement with `.bind()`;
- only an authenticated admin member can create a family invitation, the Access API request can create
  only the exact-email policy shape constructed by the server, and only an active D1 invitation can
  provision any member after the first organiser;
- mutations validate type, length, UUID, ownership and allowed state at the server boundary;
- errors shown to users do not reveal internals;
- logs omit tokens, private claim surprises and query strings;
- public viewing secrets are hashed at rest, redacted from application logs and can read only one
  claim-free wishlist;
- public sharing Access applications are hostname-specific, idempotently created from the same
  bounded implementation used by setup, and rejected if their destinations or policy drift; and
- format, lint, type, Workers-runtime tests, build and dependency audit gate every push.

## Deployment boundary

`main` is connected to Cloudflare Builds for the reference deployment. Application deployments are
automatic after a push; the initial organiser policy, Access-management API token, DNS and D1
migration changes remain separate Cloudflare operations. The setup command and first viewing-link
action use that scoped token to configure only the documented public paths. Later exact-email
additions are deliberately performed by the organiser from `/family`.

Public fork setup is documented in [DEPLOYMENT.md](DEPLOYMENT.md). The maintainer checkout may also
contain an ignored `.private/WRANGLER_PROFILE.md` with account-specific context; it must remain private.
