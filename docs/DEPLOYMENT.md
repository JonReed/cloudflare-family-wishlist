# Deployment

The application is designed for one family per Cloudflare deployment. The normal setup uses Workers,
D1, Workers AI and Access and should fit comfortably within the free allowances for family use.

## 1. Use a dedicated Wrangler profile

Named profiles prevent a command in one project from reaching the wrong Cloudflare account.

```sh
npx wrangler auth create personal
npx wrangler auth activate personal /absolute/path/to/cloudflare-family-wishlist
npx wrangler whoami
```

Pin the matching `account_id` in `wrangler.jsonc` as a second safety boundary.

## 2. Create D1

```sh
npx wrangler d1 create cloudflare-family-wishlist --location weur
```

Put the returned database ID in the `DB` binding in `wrangler.jsonc`, then apply the schema:

```sh
npm run db:migrate:local
npm run db:migrate:remote
npm run cf-typegen
```

Migration files are append-only after release. Never edit a migration that another deployment may already have applied.

Migration `0002_family_members.sql` assigns the earliest existing member the admin role and creates
the waiting-invitation table. Apply it before deploying application code that reads member roles.

Product pictures use validated remote HTTPS URLs stored in D1. They do not require an R2 bucket,
Cloudflare Images or another binding. Existing deployments upgrading from a version before item
images must run `npm run db:migrate:remote` before deploying the application code that reads the new
column.

## 3. Workers AI is enabled with the deployment

No API key, separate model deployment or additional account is required. The checked-in
`wrangler.jsonc` creates the `AI` binding and enables AI-assisted product extraction during the normal
Worker deployment. The default model is `@cf/google/gemma-4-26b-a4b-it`, which is available on the
Workers Free plan.

The two non-secret settings are kept with the deployment configuration:

- `PRODUCT_AI_ENABLED`: `true` by default; set it to `false` to use deterministic page metadata only.
- `PRODUCT_AI_MODEL`: the model used for the fallback. The application currently accepts the default
  Gemma model or `@cf/zai-org/glm-4.7-flash`, falling back to Gemma for an unrecognised value.

Workers AI is called only when reliable page metadata leaves a product title or GBP price missing.
Reaching the daily free allocation, a model being unavailable, or a page producing unusable output
does not stop product import: the application keeps anything it found deterministically and leaves the
remaining fields for the person to complete.

## 4. Deploy once before configuring Access

Apply the remote migrations, build, and deploy with the directory-bound Wrangler profile:

```sh
npm run db:migrate:remote
npm run build
npx wrangler deploy -c build/server/wrangler.json --domain wishlist.example.com --keep-vars
```

Replace `wishlist.example.com` with the hostname you want to use. Confirm that the Worker responds
with `503 Authentication is not configured`. That response is intentional: it verifies Worker, D1
and hostname routing without leaving an unprotected application online.

## 5. Connect GitHub `main`

In **Workers & Pages → Create → Import a repository**, select this repository and use:

- production branch: `main`;
- build command: `npm run build`;
- deploy command: `npx wrangler deploy --keep-vars`;
- root directory: `/`.

Leave preview builds disabled when following the initial direct-to-`main` workflow.

The repository CI runs formatting, lint, types, Workers-runtime tests, the production build and a production dependency audit. Cloudflare should deploy only commits from `main`.

The Worker deliberately returns `503 Authentication is not configured` until the Access settings below exist. This makes the first infrastructure deployment safe while Access is being connected.

## 6. Configure Cloudflare Access

Activate **Zero Trust Free**, then add **One-time PIN** under **Integrations → Identity providers**. Cloudflare may add its own account login method during onboarding; this is separate from OTP.

Create a self-hosted Access application with a **Workers** destination and select the deployed Worker.
Add an Allow policy containing only the **exact email address of the person setting up the family
wishlist**. Do not add the rest of the family yet: the first successfully provisioned member is
reserved as the family organiser. In the application's Authentication settings:

- turn off **Accept all available identity providers**;
- select only **One-time PIN**;
- enable instant authentication when Cloudflare offers it.

One-time PIN is only the login method. It is not an allow-list by itself: an Allow policy containing only the OTP method would admit any valid email address.

Add these text variables under **Worker → Settings → Runtime variables and secrets**:

- `ACCESS_TEAM_DOMAIN`: the full team domain, such as `your-team.cloudflareaccess.com`;
- `ACCESS_AUD`: the application audience tag shown by Access.

Neither value is a password, but both are deployment-specific and should be configured in Cloudflare rather than hard-coded into a reusable fork.

The repository's deployment command uses Wrangler's `--keep-vars` option so later source deployments preserve these dashboard-managed values.

Every request is first checked by Access and then checked again by the Worker. The Worker validates the JWT signature, issuer, audience, expiry, subject and email before any route or database operation runs.

Verify the boundary before logging in:

```sh
curl -sSI https://wishlist.example.com/
```

An unauthenticated request must redirect to the deployment's `cloudflareaccess.com` login page. The
organiser must now complete one OTP login and confirm that their wishlist appears rather than the
fail-closed `503` response. Treat this as a required setup step: do not admit anyone else until the
organiser's first login has succeeded.

## 7. Let the organiser add family members

The **Your family** page can add exact email addresses to this Access application without giving the
organiser access to the Cloudflare dashboard. It needs one narrowly scoped Cloudflare API token.

In **My Profile → API Tokens**, create a custom token with:

- permission: **Account → Access: Apps and Policies → Edit** (`Access: Apps and Policies Write` in
  the API documentation); and
- account resource: only the account containing this family wishlist.

Do not use the Global API Key. The custom token can change Access policy, so keep it out of source,
chat, shell history and `.dev.vars`. Store it through Wrangler's private interactive prompt:

```sh
npx wrangler secret put ACCESS_MANAGEMENT_API_TOKEN
```

The two identifiers are not sensitive, but they are deployment-specific. The simplest CLI-only
setup is to store them through the same encrypted prompt:

```sh
npx wrangler secret put ACCESS_MANAGEMENT_ACCOUNT_ID
npx wrangler secret put ACCESS_MANAGEMENT_APPLICATION_ID
```

Enter these values when prompted:

- `ACCESS_MANAGEMENT_ACCOUNT_ID`: the account ID already pinned as `account_id` in `wrangler.jsonc`;
- `ACCESS_MANAGEMENT_APPLICATION_ID`: the Access application's UUID. Open **Zero Trust → Access
  controls → Applications → Family Wishlist** and copy the application ID from its details/address.

The initial `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` variables remain required for JWT validation. The
management values serve a different purpose and do not replace them. `--keep-vars` preserves all
dashboard-managed variables and encrypted secrets during later deployments. If preferred, the two
identifiers can instead be ordinary text variables in the Worker dashboard; the application reads
either binding type identically.

Return to `/family`. The first member should see the page and every later member should be returned
to the wishlists if they enter its URL directly. Add a test address and confirm that:

1. it appears as **Waiting to join**;
2. **Copy invitation** produces the application address and exact sign-in email;
3. an unrelated address still receives no OTP and cannot enter; and
4. after the invited address completes OTP, it appears as **Joined** with one wishlist.

The application does not send an invitation email. Adding someone creates a single exact-email
application policy and records the waiting person in D1; the organiser shares the copied invitation
through their preferred private channel.

## 8. Remove family members

Removal is not yet exposed in the application. To prevent future access, delete that person's
exact-email policy from the Access application in Cloudflare. Policies created by the application are
named `Family Wishlist member` followed by the first eight characters of the invitation ID. Removing
Access does not delete the member's wishlist or historical data.
