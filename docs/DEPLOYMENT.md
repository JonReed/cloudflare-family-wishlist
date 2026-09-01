<p align="center">
  <img src="../public/favicon.svg" width="72" height="72" alt="Family Wishlist gift mark">
</p>

<h1 align="center">Install and deploy</h1>

<p align="center"><strong>One household. One Cloudflare deployment. No server to maintain.</strong></p>

This guide starts with an empty Cloudflare account and ends with a private family wishlist that
deploys from GitHub. One deployment is one household: there is no shared control plane, public
registration or application-managed password database.

The normal installation uses only Cloudflare's free plans. A domain is optional because every
Cloudflare account can publish the Worker at a free `workers.dev` address. If you later attach a
custom domain, the same Worker-level Access policy protects it.

> [!NOTE]
> **Expected running cost: £0 for a normal family.** No paid Cloudflare plan or custom domain is
> required. Cloudflare currently asks for payment details when a Zero Trust Free organisation is
> created, but states that the Free selection is not charged.

Cloudflare changes dashboard wording and allowances over time. The figures below were checked on
1 September 2026; follow the linked Cloudflare pages when a current dashboard differs from this
guide.

## The route through setup

1. **Prepare the account and source** — fork the project, choose a `workers.dev` address and bind
   Wrangler to the right Cloudflare account.
2. **Create the data and application** — provision D1, keep or disable the included AI assistance, run
   the checks and make the first deployment.
3. **Make it private** — put the whole Worker behind an exact-email Access policy, then configure the
   Worker's own JWT validation.
4. **Finish family setup** — give the organiser scoped invitation access, connect GitHub Builds and
   run the acceptance checks. A custom domain remains optional.

## What Cloudflare provides

| Service                                                                                      | What this application uses it for                                | Current free allowance                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Workers](https://developers.cloudflare.com/workers/platform/limits/)                        | React Router server rendering, validation and product-page fetch | 100,000 requests per day, 10 ms CPU per request and 50 external subrequests per request                                                                                       |
| [D1](https://developers.cloudflare.com/d1/platform/pricing/)                                 | Members, wishlists, items, claims and lookup budgets             | 5 million rows read and 100,000 rows written per day; [500 MB per database, 5 GB total and 10 databases](https://developers.cloudflare.com/d1/platform/limits/)               |
| [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)                 | AI-assisted product-detail enrichment                            | 10,000 Neurons per day; the default [Gemma model remains available on Workers Free](https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/) |
| [Cloudflare Access](https://www.cloudflare.com/plans/zero-trust-services/)                   | Exact-email admission and email one-time PIN login               | $0 for up to 50 users                                                                                                                                                         |
| [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) | Build and deploy each push to `main`                             | 3,000 build minutes per month, one concurrent build and a 20-minute limit per build                                                                                           |

The application does not need R2, Cloudflare Images, KV, Queues, a paid email service or a separate
AI account. Product pictures remain remote HTTPS resources and are delivered to signed-in family
members through the bounded same-origin Worker proxy.

Most allowances in the table are shared by all projects in one Cloudflare account. The CPU limit is
per Worker request and the 500 MB D1 limit is per database. If the account already runs busy Workers,
databases or AI applications, check its dashboards rather than assuming the whole allowance remains
available to this family.

### Why a family should fit

The Workers and D1 allowances are several orders of magnitude above normal traffic from one
household. D1 scales to zero and has no data-transfer fee. Claims and wishlist items are small rows,
and the application's indexed queries avoid large table scans.

Workers AI is not called for every page. Deterministic retailer rules, JSON-LD, Open Graph and visible
product fields run first; AI receives a reduced excerpt only when a title or GBP price is still
missing. The default model currently costs 9,091 Neurons per million input tokens and 27,273 per
million output tokens. An illustrative upper-sized English prompt with 4,000 input tokens plus the
application's maximum 180-token output is about 41 Neurons, or roughly 240 such AI-assisted lookups inside the
daily free allocation. URLs and languages tokenise differently, so that is a scale estimate rather
than a guaranteed request count, but it leaves ample room for ordinary family use.

If the AI allocation is exhausted or inference fails, the deterministic draft is kept and the person
can finish it by hand. The application also limits each member to 12 product lookups per minute.

Free-plan limits are hard service limits, not automatic paid overages: Workers, D1 or AI operations
fail when their allowance is exhausted and resume after the relevant reset. Workers, D1 and Workers
AI daily allowances reset at 00:00 UTC. If you deliberately upgrade to Workers Paid, consult the
[current Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) because usage
above included allowances can then be billed.

The effect depends on which allowance is reached:

- a Workers request or CPU limit can make an application request fail;
- a D1 daily or storage limit prevents database operations until the allowance resets or space is
  freed;
- a Workers AI limit only removes the optional AI prefill—the deterministic scraper and manual form
  remain;
- a Workers Builds limit stops new builds, but the last successful deployment keeps running; and
- the Access Free plan is intended for at most 50 users, far beyond one household.

The 10 ms Workers CPU limit is per request, not a daily pool. Waiting for D1, product pages or AI does
not count as CPU time. If Cloudflare consistently reports error `1102`, inspect CPU use before deciding
whether this household needs Workers Paid.

## Before you begin

You need:

- a [Cloudflare account](https://dash.cloudflare.com/sign-up); the default Workers Free plan is enough;
- a GitHub account and a fork of this repository if you want automatic deployments;
- Git, Node.js 24 (Node.js 22.22 or newer is supported) and npm 11 or newer on the setup computer; and
- the exact email address of the first family organiser.

A custom domain is optional. If you want one, it must be an active zone in the same Cloudflare account
before you attach it to the Worker. Domain registration itself is not part of the free allowances.

The Zero Trust Free payment-details requirement is separate from upgrading the account to Workers
Paid.

## 1. Fork, clone and install the project

Fork the repository on GitHub, then clone your fork. Use your fork's address in place of the example:

```sh
git clone https://github.com/YOUR-NAME/cloudflare-family-wishlist.git
cd cloudflare-family-wishlist
npm ci
```

`npm ci` installs the checked-in Wrangler 4 release locally. No global Wrangler installation is
required. Confirm the local tools before changing Cloudflare:

```sh
node --version
npm --version
npx wrangler --version
```

If you do not want GitHub deployment, download or clone the source directly and follow the same CLI
steps. You can run `npm run deploy` manually for future releases.

## 2. Create the Cloudflare account and Workers subdomain

Create or sign in to the Cloudflare account that will own this family's deployment. In **Workers &
Pages**, complete the Workers onboarding and choose the account's [`workers.dev` subdomain](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
if Cloudflare asks for one. The final free address will look like:

```text
https://cloudflare-family-wishlist.YOUR-SUBDOMAIN.workers.dev
```

You do not need to add a website or change DNS to use this address.

## 3. Authenticate Wrangler to the correct account

Use a directory-bound named profile so commands from this checkout cannot silently target another
Cloudflare account:

```sh
npx wrangler auth create family-wishlist
npx wrangler auth activate family-wishlist /absolute/path/to/cloudflare-family-wishlist
npx wrangler whoami
```

The first command opens Cloudflare authorization in a browser. Check the account name and copy the
account ID printed by `whoami`. Wrangler currently labels named profiles experimental, but this
repository pins a release that supports them. If profile creation is unavailable, use
`npx wrangler login` and make the `whoami` check before every remote command.

Open `wrangler.jsonc` and make these installation-specific changes:

1. replace `account_id` with your Cloudflare account ID;
2. optionally change `name` if that Worker name already exists in your account; and
3. leave the `DB` binding name, AI binding and product AI settings unchanged for now.

The account and D1 IDs checked into the upstream repository belong to its reference deployment. They
are not secrets, but a fork must replace them before its first deployment. Keeping your own
`account_id` in the configuration is a useful second guard against deploying to the wrong account.

## 4. Create and migrate D1

Create one database. `weur` is a sensible location hint for a UK or European family; choose another
[D1 location hint](https://developers.cloudflare.com/d1/configuration/data-location/) if appropriate.

```sh
npx wrangler d1 create cloudflare-family-wishlist --location weur
```

Copy the returned database UUID into `database_id` for the `DB` binding in `wrangler.jsonc`. If you
changed the database name, update `database_name` too. Then generate bindings and apply every checked-in
migration to the remote database:

```sh
npm run cf-typegen
npm run db:migrate:remote
```

Applying remote migrations changes the production database. On a new empty database this is expected.
For later upgrades, migration files are append-only: never edit a migration that a deployment may
already have applied.

Local development is optional during installation. To test against an isolated local D1 database:

```sh
npm run db:migrate:local
npm run dev
```

The localhost build uses a fixed local-only identity. It does not use production family data or
consume Workers AI.

## 5. Understand the included AI binding

There is no AI API key or separate model deployment. The checked-in `AI` binding is attached during
the ordinary Worker deployment. These non-secret settings live in `wrangler.jsonc`:

- `PRODUCT_AI_ENABLED` is `true` by default; set it to `false` for deterministic extraction only.
- `PRODUCT_AI_MODEL` defaults to `@cf/google/gemma-4-26b-a4b-it`. The application also accepts
  `@cf/zai-org/glm-4.7-flash`; both are currently available on Workers Free.

Cloudflare has moved some resource-intensive models to Workers Paid, so do not replace the model
without checking the [current Workers AI catalog and pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
An unrecognised configured value falls back to the checked-in Gemma model.

AI only prefills an editable draft. It never creates or changes a saved wish, and quota, capacity,
timeout or extraction failures leave the ordinary page-scraping result available.

## 6. Check and make the first deployment

Run the repository gates before publishing:

```sh
npm run quality
npm run audit
```

Then deploy:

```sh
npm run deploy
```

Wrangler prints the new `workers.dev` address. Before Access is configured, opening it should return:

```text
503 Authentication is not configured.
```

That response is intentional. It proves the Worker and D1 binding exist while the application itself
still fails closed. Do not remove the application's JWT validation just because Access will also run
in front of the Worker.

## 7. Enable Zero Trust Free and one-time PIN login

In the Cloudflare dashboard, open **Zero Trust** and create a Zero Trust organisation:

1. choose a unique team name, which creates `YOUR-TEAM.cloudflareaccess.com`;
2. select **Zero Trust Free**;
3. complete the requested payment details; Cloudflare says the Free plan remains $0; and
4. finish onboarding without installing the Cloudflare One Client—the family uses browser login only.

New Zero Trust organisations no longer enable email one-time PIN automatically. Under **Integrations
→ Identity providers**, add **One-time PIN**. Cloudflare sends login codes itself, so this project does
not need an email provider. See Cloudflare's [one-time PIN setup and behaviour](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/).

## 8. Put the whole Worker behind Access

Use Cloudflare's Worker-level integration rather than protecting only one hostname:

1. go to **Workers & Pages** and select your Worker;
2. open its **Access** tab;
3. select **Protect this Worker behind Access**;
4. choose **All traffic**, not previews only;
5. create an Allow policy whose Include rule contains only the organiser's **exact email address**;
6. select only **One-time PIN** as the application's login method; and
7. apply Access.

Worker-level Access protects the production Worker, its `workers.dev` address, custom domains, routes
and preview deployments together. Cloudflare documents this as the safest and most straightforward
way to protect a Worker in [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

Do not use **Login Methods → One-time PIN** as the only Include rule. Cloudflare explicitly warns that
this admits anyone with a valid email address. OTP is the authentication mechanism; exact email rules
are the admission list.

In the Access application's advanced cookie settings, keep `HttpOnly` enabled and set the application
cookie's `SameSite` attribute to **Lax**. The Worker independently rejects cross-origin mutations.

At this point an unauthenticated request should redirect to Cloudflare's login page:

```sh
curl -sSI https://cloudflare-family-wishlist.YOUR-SUBDOMAIN.workers.dev/
```

## 9. Configure the Worker's Access JWT validation

Access now blocks outsiders, but the Worker will continue returning its fail-closed `503` after login
until it knows which Access issuer and application audience to trust.

Find these values in Cloudflare:

- `ACCESS_TEAM_DOMAIN`: the complete team domain from Zero Trust settings, for example
  `your-team.cloudflareaccess.com`;
- `ACCESS_AUD`: the **Application Audience (AUD) Tag** shown in the Access application's details.

Add both as ordinary text variables under **Workers & Pages → your Worker → Settings → Variables and
Secrets**. They are deployment identifiers rather than passwords. Keep them out of reusable upstream
source so forks cannot accidentally trust the wrong Access application.

The first person to complete a successful OTP login is provisioned as the family organiser. Log in
now using the exact address from the initial Access policy and confirm that an empty wishlist appears.
Do this before admitting any other address.

Every request is checked twice: Access validates its policy at the edge, then the Worker validates the
JWT signature, issuer, audience, expiry, subject and email before touching D1.

## 10. Allow the organiser to invite family members

This step is required for a multi-person family. Without it, the first organiser can use the wishlist
but the **Your family** page cannot safely update both Access and the application's invitation state.

Create a [custom Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with:

- permission **Account → Access: Apps and Policies → Edit**; and
- account resource limited to the account containing this Worker.

Do not use the Global API Key. The custom token can change Access policies, so store it only as an
encrypted Worker secret. In the Worker dashboard's **Variables and Secrets** settings, add:

| Binding name                       | Type   | Value                                           |
| ---------------------------------- | ------ | ----------------------------------------------- |
| `ACCESS_MANAGEMENT_API_TOKEN`      | Secret | the narrowly scoped custom API token            |
| `ACCESS_MANAGEMENT_ACCOUNT_ID`     | Text   | the account ID already used in `wrangler.jsonc` |
| `ACCESS_MANAGEMENT_APPLICATION_ID` | Text   | the UUID of the Worker-level Access application |

The application UUID is in **Zero Trust → Access controls → Applications → your application**. It is
different from the audience tag.

If you prefer the CLI, use the private interactive prompt for the token so it never enters shell
history:

```sh
npx wrangler secret put ACCESS_MANAGEMENT_API_TOKEN
```

Do not pipe or pass the token as a command argument. The deployment command uses `--keep-vars`, so
later source deployments preserve dashboard-managed variables and secrets.

Open **Your family**, add one test address and confirm that:

1. it appears as **Waiting to join**;
2. **Copy invitation** includes the application address and exact sign-in email;
3. an unrelated address receives no OTP and cannot enter; and
4. after the invited address completes OTP, it appears as **Joined** with one wishlist.

The application does not send invitation email. It creates one exact-email Access policy, records the
waiting invitation in D1 and gives the organiser text to share through a private channel.

## 11. Connect automatic deployments

The first CLI deployment created the correctly named Worker and its bindings. Connect that existing
Worker to your fork rather than importing a second Worker.

First commit the installation-specific `wrangler.jsonc` changes to your fork so Cloudflare does not
build with the upstream reference account and database IDs:

```sh
git add wrangler.jsonc worker-configuration.d.ts
git commit -m "Configure family deployment"
git push origin main
```

Account and database IDs are identifiers, not credentials. Never commit Access API tokens, `.env`,
`.dev.vars`, database exports or other secrets.

Now connect the build:

1. go to **Workers & Pages → your Worker → Settings → Builds**;
2. select **Connect** and authorise Cloudflare's GitHub integration for your fork;
3. use production branch `main`;
4. use build command `npm run build`;
5. use deploy command `npx wrangler deploy --keep-vars`; and
6. use repository root `/`.

Disable preview builds for the simple direct-to-`main` workflow. If you enable them later, the
Worker-level Access policy protects them too.

Workers Builds now deploys each push to `main`. Cloudflare's [Git integration guide](https://developers.cloudflare.com/workers/ci-cd/builds/)
requires the Worker name in the dashboard to match `name` in `wrangler.jsonc`.

Builds do not apply D1 migrations. Before pushing a release containing a new migration, authenticate
the correct profile and run:

```sh
npm run db:migrate:remote
```

Apply all pending migrations before the matching application code reaches production. Existing
migrations include family roles, invitation admission state, item images and the product-lookup
budget.

## 12. Add a custom domain (optional)

The free `workers.dev` address is sufficient. For a friendlier address, first add a domain to the same
Cloudflare account as an active zone. Then open **Workers & Pages → your Worker → Settings → Domains &
Routes → Add → Custom Domain** and enter a hostname such as `wishlist.example.com`.

Cloudflare creates the DNS record and certificate. A custom domain cannot replace an existing CNAME
and must belong to a zone you control. See Cloudflare's [Custom Domains requirements](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

No application setting needs changing: links and Add from anywhere tools derive their origin from the
current request. Because Access protects the Worker itself, the custom domain is already covered.

## 13. Final acceptance check

Before relying on the installation, verify all of these:

- a signed-out browser is redirected to Access;
- only exact email addresses added by the organiser receive a usable OTP;
- the organiser and invited member each receive exactly one wishlist;
- an ordinary wish can be added, edited and deleted;
- **Fill from link** only prefills an editable draft and manual entry still works;
- an optional product picture is served from the application's `/product-image` address;
- one family member can claim an item and the wishlist owner cannot see that claim or purchase state;
- `/family` is available only to the organiser; and
- a push to `main` completes one Cloudflare build and deployment.

Check D1 migrations at any time with:

```sh
npx wrangler d1 migrations list DB --remote
```

Usage is visible in **Workers & Pages → your Worker**, **D1 → your database**, **Workers AI**, and
**Workers Builds**. These dashboards are the source of truth for the account's remaining allowances.

## Updating an installation

Review the release and migration notes before updating. Bring the desired upstream changes into your
fork using GitHub or Git, then from the deployment checkout run:

```sh
npm ci
npm run quality
npm run audit
npm run db:migrate:remote
```

Push the reviewed update to your fork's `main` only after its migrations are applied; Workers Builds
will deploy it. If the source is already updated on `main`, do not create an empty commit solely to
trigger a build—use the Worker dashboard's retry/redeploy controls. Never rewrite an applied
migration.

## Removing a family member

Removal is not yet exposed in the application. To prevent future access, delete that person's
exact-email policy from the Access application in Cloudflare. Policies created by the application are
named `Family Wishlist member` followed by the first eight characters of the invitation ID. Removing
Access does not delete the member's wishlist or historical data.
