# Deployment

The application is designed for one family per Cloudflare deployment. The normal setup uses Workers, D1 and Access and should fit comfortably within the free allowances for family use.

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

## 3. Connect GitHub `main`

In **Workers & Pages → Create → Import a repository**, select this repository and use:

- production branch: `main`;
- deploy command: `npm run deploy`;
- root directory: `/`.

The repository CI runs formatting, lint, types, Workers-runtime tests, the production build and a production dependency audit. Cloudflare should deploy only commits from `main`.

The Worker deliberately returns `503 Authentication is not configured` until the Access settings below exist. This makes the first infrastructure deployment safe while Access is being connected.

## 4. Configure Cloudflare Access

Create a self-hosted Access application for the Worker's hostname. Enable the **One-time PIN** login method, then create an Allow policy containing the **exact email addresses** of the family members.

One-time PIN is only the login method. It is not an allow-list by itself: an Allow policy containing only the OTP method would admit any valid email address.

Add these Worker variables in the Cloudflare deployment settings:

- `ACCESS_TEAM_DOMAIN`: the full team domain, such as `your-team.cloudflareaccess.com`;
- `ACCESS_AUD`: the application audience tag shown by Access.

Neither value is a password, but both are deployment-specific and should be configured in Cloudflare rather than hard-coded into a reusable fork.

Every request is first checked by Access and then checked again by the Worker. The Worker validates the JWT signature, issuer, audience, expiry, subject and email before any route or database operation runs.

## 5. Invite or remove family members

There is no application-managed invitation email or password. To invite someone, add their exact email address to the Access Allow policy and send them the application URL yourself. Their member record and single wishlist are created automatically after their first successful login.

To prevent future access, remove the email address from the Access policy. Removing Access does not delete the member's wishlist or historical data.
