# Development guide

This guide is the practical handoff for changing the application. Read [PRODUCT.md](PRODUCT.md) and
[ARCHITECTURE.md](ARCHITECTURE.md) first if the product or privacy model is unfamiliar.

## Prerequisites

- Node.js 24 (22.22 or newer is supported; `.nvmrc` selects 24)
- npm 11 or newer
- a checkout of the repository

Cloudflare credentials are not required for ordinary local development or tests. Remote bindings are
disabled in Vite and Vitest, so local product import exercises deterministic extraction and graceful
AI-unavailable behaviour without consuming a deployment's allowance.

## First local run

```sh
npm install
npm run db:migrate:local
npm run dev
```

Open the localhost URL printed by Vite. A fixed `local-development@family.invalid` identity is enabled
only in development and only for loopback hostnames. Its member and wishlist are provisioned in the
local D1 database on first request.

Wrangler keeps local Cloudflare state under `.wrangler/`, which is ignored. Local data is not copied
to production. If a migration is added, rerun `npm run db:migrate:local` before exercising the change.

## Commands

| Command                    | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `npm run dev`              | Start React Router in the local Workers runtime      |
| `npm run db:migrate:local` | Apply pending migrations to local D1                 |
| `npm run format`           | Write Prettier formatting                            |
| `npm run lint`             | Generate route types and run zero-warning ESLint     |
| `npm run typecheck`        | Check Wrangler bindings, route types and TypeScript  |
| `npm run test`             | Run Vitest in the Cloudflare Workers runtime         |
| `npm run test:watch`       | Run focused tests while developing                   |
| `npm run build`            | Produce the production Worker build                  |
| `npm run quality`          | Required format, lint, type, test and build gate     |
| `npm run audit`            | Required dependency vulnerability gate               |
| `npm run cf-typegen`       | Regenerate Worker binding types after config changes |

Run `npm run quality` and `npm run audit` before every commit or push. CI repeats those checks.

## How a request moves through the code

1. `workers/app.ts` receives the request, applies the production security boundary and validates the
   Cloudflare Access identity.
2. `app/lib/context.ts` makes the verified identity and D1 binding available to React Router.
3. `app/routes/home.tsx` provisions the member, loads the selected family wishlist and dispatches
   form intents.
4. `app/lib/product-metadata.ts` performs bounded public-page lookups for the optional link helper.
5. `app/lib/db/members.ts` and `app/lib/db/wishlists.ts` own database rules and validation.
   `app/routes/family.tsx`, `app/lib/db/family-members.ts` and
   `app/lib/cloudflare/access-membership.ts` own the organiser-only admission flow.
6. React Router renders the response through `app/root.tsx`; the current UI and forms are in
   `app/routes/home.tsx` with reusable brand/footer pieces in `app/components/`.

The route is intentionally server-first. Prefer a loader/action and an ordinary form over adding a
client state/API layer. Add browser JavaScript only when it materially improves an interaction and
the no-JavaScript path remains sound.

## Change recipes

### Product or form behaviour

- Start in `app/routes/home.tsx` to find the relevant loader/action intent.
- Put reusable validation and database invariants in `app/lib/`, not only in the component.
- Preserve the selected `?list=` query parameter after actions.
- Test malformed and missing `FormData`, ownership constraints, stale IDs and the successful path.
- Check the family-facing wording against [DESIGN.md](DESIGN.md).

The home route is currently large. When adding another substantial interaction, prefer extracting a
cohesive component or server helper rather than growing one more unrelated block in the route.

Product metadata lookup is progressive enhancement. Keep the ordinary `fetch-product` form intent
working without JavaScript, and keep `public/product-import.js` limited to the same-origin convenience
layer. Any outbound page fetch must preserve the timeout, response-byte cap, manual redirect checks,
public-target checks, member-scoped D1 lookup budget and credential-free request in
`app/lib/product-metadata.ts`. AI extraction must
remain optional, receive only reduced public-page text, accept only source-supported values and never
save a wish. Add general evidence rules before retailer-specific ones; keep retailer exceptions in a
hostname-matched adapter, and add a compact regression fixture for every new metadata shape. Challenge
pages must be rejected before AI is called. Product image rules must return a validated HTTPS draft.
When the AI enrichment pass is already needed, it may select only an integer index from a bounded list of
validated page-image candidates; never accept a model-provided URL or automatically load
private/local targets. Inject `ProductAiExtractor` in tests rather than connecting the test pool to
Workers AI. `ProductImageField` keeps its picture address in the submitted form while presenting a
thumbnail-first interface; every preview and saved picture must use the same-origin `/product-image`
proxy. Preserve its redirect validation, public-network enforcement, raster allowlist and 4 MiB cap.
`public/product-import.js` owns the optional live preview, change and remove conveniences across both
ordinary and multi-list forms.

The **Add from anywhere** page is presented by `app/routes/bookmarklet.tsx` at the existing
`/bookmarklet` URL. `app/lib/bookmarklet.ts` derives both the add-page address used by Apple Shortcuts
and the desktop bookmarklet from the current deployment origin. `public/pwa-install.js` registers the
cache-free service worker and progressively exposes Android installation; `public/bookmarklet.js`
handles the browser button, copy and clipboard conveniences. The manifest’s GET-only share target
lands on `app/routes/share-target.ts`, which accepts only a validated public product link before
redirecting to `app/routes/add.tsx`. All entry points must carry only the product URL and never
identity or family data. Do not add a service-worker fetch handler or cache authenticated HTML.
Clipboard and shared input must remain limited to credential-free HTTP(S) links. Preserve the visual
drag guidance, no-JavaScript add-form fallback, editable metadata fallbacks and the guarded,
all-or-nothing multi-list service mutation.

### Database query or mutation

- Read `migrations/0001_initial.sql` and the existing service tests first.
- Use D1 prepared statements and `.bind()` for every value.
- Validate UUIDs and bounded strings at the service boundary.
- Check that filters and ordering use an existing index; add an index in a new migration if needed.
- Keep claim data out of owner-visible result shapes at query/service level.
- Add Workers-runtime tests for invalid data, missing rows, competing operations and privacy branches.

### Schema change

1. Add a new numbered SQL file under `migrations/`; never rewrite a migration already applied to a
   shared database.
2. Update query/service types and test fixtures.
3. Apply it locally with `npm run db:migrate:local`.
4. Run the complete quality gate.
5. Update architecture, deployment or product docs if the persistent model changed.

`npm run db:migrate:remote` mutates production data. Run it only when explicitly authorised and only
after reading the account-specific private handoff and verifying the active Wrangler profile.

### Worker bindings or Cloudflare configuration

- Edit `wrangler.jsonc`, then run `npm run cf-typegen`.
- Use the generated binding types; do not hand-maintain an `Env` interface.
- Retrieve current Cloudflare documentation before trusting remembered Wrangler flags or config fields.
- Do not use another Wrangler profile merely because it is already logged in.
- Do not manually deploy the reference application unless the maintainer requests it; pushes to
  `main` deploy through Cloudflare Builds.

### Authentication or Access

- Treat `workers/app.ts` and `app/lib/auth/access.ts` as one security boundary.
- Verify signature, issuer, audience, expiry, subject and email before provisioning.
- Fail closed when production configuration or the assertion is missing.
- Keep the development identity restricted to a development build and a loopback hostname.
- Never log assertions, tokens or full authentication payloads.
- Keep family admission fail-closed: write a pending invitation before calling Cloudflare, create only
  an exact-email Allow policy, activate it only after Cloudflare succeeds, and never provision a later
  member from a pending or cleanup-required row.
- Treat `ACCESS_MANAGEMENT_API_TOKEN` as a secret. Keep the account and application identifiers in
  deployment configuration, not family-facing output.
- Preserve the bounded response reader, timeout and compensating policy deletion around Access API
  calls. Inject `fetch` in tests; never call the live API from the test suite.
- Cloudflare Access policy/DNS changes are external mutations and require explicit maintainer authority.

### Visual or copy change

- Follow [DESIGN.md](DESIGN.md); preserve the tactile parcel/paper language and avoid SaaS patterns,
  pills and generic product-spec copy.
- Use British English and direct family language.
- Keep semantic HTML, visible labels, keyboard focus and the JavaScript-free form path.
- Exercise the affected flow at desktop and narrow mobile widths. Check empty, populated, validation
  and error states where relevant.
- Optimise committed raster assets and provide meaningful alternative text only when the image conveys
  content; decorative imagery should remain hidden from assistive technology.

## Testing map

| Test                               | Protects                                                           |
| ---------------------------------- | ------------------------------------------------------------------ |
| `test/access-auth.test.ts`         | JWT signature/issuer/audience/expiry and local identity boundaries |
| `test/access-membership.test.ts`   | exact-email policy shape, bounded API handling and cleanup         |
| `test/add-route.test.ts`           | multi-list product drafts preserve edits and fill missing pictures |
| `test/bookmarklet.test.ts`         | safe, deployment-specific add-page and bookmarklet construction    |
| `test/family-members.test.ts`      | roles, admin checks, invitation state and first-login conversion   |
| `test/member-provisioning.test.ts` | email validation, idempotent first login and one-list constraint   |
| `test/product-image.test.ts`       | same-origin proxy types, redirects and response-byte boundary      |
| `test/product-lookups.test.ts`     | member lookup budget, reset and concurrent enforcement             |
| `test/product-metadata.test.ts`    | bounded public fetches, metadata extraction and optional AI safety |
| `test/product-url.test.ts`         | safe HTTP(S) links, credential rejection and size limits           |
| `test/request-security.test.ts`    | mutation origins, content types and request-body boundary          |
| `test/share-target.test.ts`        | safe Android shared-text and direct-link extraction                |
| `test/wishlist-service.test.ts`    | CRUD validation, ordering, claims, concurrency and owner privacy   |

`vitest.config.ts` runs tests through the Cloudflare pool. `test/apply-migrations.ts` applies every SQL
migration to the isolated test database, so migration and application code are tested together.

The product-page fetcher deliberately uses a small, coherent desktop-browser navigation header set.
Keep that profile central in `app/lib/product-metadata.ts` so initial requests, redirects and retailer
retries cannot drift apart. Never derive it from the incoming family request or add cookies,
authorisation, a referrer, client IP headers or an explicit compression header.

There are not yet automated browser tests. UI verification is therefore a deliberate manual step,
not something the unit suite proves.

## Generated and private files

Do not commit local/build state such as `.wrangler/`, `build/`, `.react-router/`, `.dev.vars`, database
exports or credentials. `worker-configuration.d.ts` is generated by Wrangler and should change only
through `npm run cf-typegen` when bindings change.

The reference maintainer checkout may have `.private/WRANGLER_PROFILE.md`. It exists to prevent use of
the wrong Cloudflare account, is ignored by Git, and must stay private.

## Before handing work back

- Read the complete diff, including generated or documentation changes.
- Confirm the product and claim-privacy invariants still hold.
- Run `npm run quality` and `npm run audit`.
- For UI work, test the real form flow on desktop and mobile.
- Explain changed behaviour, verification performed and any remaining risk.
