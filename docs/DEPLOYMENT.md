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

Replace `wishlist.example.com` with the hostname you want to use. Confirm that the Worker responds with `503 Authentication is not configured`. That response is intentional: it verifies Worker, D1 and hostname routing without leaving an unprotected application online.

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

Create a self-hosted Access application with a **Workers** destination and select the deployed Worker. Add an Allow policy containing the **exact email addresses** of the family members. In the application's Authentication settings:

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

An unauthenticated request must redirect to the deployment's `cloudflareaccess.com` login page. Complete one OTP login with an allowed email and confirm that the application loads rather than returning its fail-closed `503` response.

## 7. Invite or remove family members

There is no application-managed invitation email or password. To invite someone, add their exact email address to the Access Allow policy and send them the application URL yourself. Their member record and single wishlist are created automatically after their first successful login.

To prevent future access, remove the email address from the Access policy. Removing Access does not delete the member's wishlist or historical data.
