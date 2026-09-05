<p align="center">
  <img src="../public/favicon.svg" width="72" height="72" alt="Family Wishlist gift mark">
</p>

<h1 align="center">Install and deploy</h1>

<p align="center"><strong>One household. One Cloudflare deployment. No server to maintain.</strong></p>

This guide starts with an empty Cloudflare account and ends with a private family wishlist that
deploys from GitHub. Each household gets an independent deployment, invitation-only membership and
Cloudflare-managed sign-in.

The normal installation uses only Cloudflare's free plans. A domain is optional because every
Cloudflare account can publish the Worker at a free `workers.dev` address. If you later attach a
custom domain, the same Worker-level Access policy protects it.

> [!NOTE]
> **Expected running cost: £0 for a normal family.** The free `workers.dev` address and Cloudflare's
> free plans provide everything required. A paid plan and custom domain remain optional. Cloudflare
> currently asks for payment details when a Zero Trust Free organisation is created, while confirming
> that the Free selection is not charged.

Cloudflare changes dashboard wording and allowances over time. The figures below were checked on
3 September 2026; follow the linked Cloudflare pages when a current dashboard differs from this
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
| [Browser Run](https://developers.cloudflare.com/browser-run/pricing/)                        | Rendered-page assistance for difficult product pages             | 10 browser minutes per day; [one Quick Action every 10 seconds](https://developers.cloudflare.com/browser-run/limits/) on Workers Free                                        |
| [Cloudflare Access](https://www.cloudflare.com/plans/zero-trust-services/)                   | Exact-email admission and email one-time PIN login               | $0 for up to 50 users                                                                                                                                                         |
| [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) | Build and deploy each push to `main`                             | 3,000 build minutes per month, one concurrent build and a 20-minute limit per build                                                                                           |

The compact platform footprint keeps setup simple: Workers, D1, Browser Run, Workers AI, Access and
Builds cover the complete product. Product pictures remain remote HTTPS resources and are delivered
through the bounded same-origin Worker proxy. Read-only viewing links use a separate per-link image budget.
Their picture route also applies a lower capability-holder budget so one recipient cannot normally
consume the list-wide allowance for everyone else.

Most allowances in the table are shared by all projects in one Cloudflare account. The CPU limit is
per Worker request and the 500 MB D1 limit is per database. If the account already runs busy Workers,
databases or AI applications, check its dashboards rather than assuming the whole allowance remains
available to this family.

### Why a family should fit

The Workers and D1 allowances are several orders of magnitude above normal traffic from one
household. D1 scales to zero and has no data-transfer fee. Claims and wishlist items are small rows,
and the application's indexed queries avoid large table scans.

Browser Run and Workers AI are not called for every page. Ordinary bounded fetching and retailer
fallbacks run first. Browser Run is attempted once only when the result is blocked or unusable; its
Quick Action blocks heavy image, media and font downloads and reuses Cloudflare's short content cache.
It may still be identified and blocked as automation, in which case the form remains available.

Deterministic retailer rules, JSON-LD, Open Graph and visible product fields then run before AI. AI
receives a reduced excerpt only when a title or GBP price is still missing. The default model
currently costs 9,091 Neurons per million input tokens and 27,273 per
million output tokens. An illustrative upper-sized English prompt with 4,000 input tokens plus the
application's maximum 180-token output is about 41 Neurons, or roughly 240 such AI-assisted lookups inside the
daily free allocation. URLs and languages tokenise differently, so that is a scale estimate rather
than a guaranteed request count, but it leaves ample room for ordinary family use.

When AI reaches its allocation or cannot enrich a page, the deterministic draft stays ready for the
person to finish. The application also gives each member 12 product lookups per minute.
The same-origin picture proxy separately allows 60 image fetches per member per minute and 500 per
UTC day, which is ample for ordinary family browsing while bounding free-tier abuse.

Free-plan limits protect the account from automatic paid overages. Services resume after the relevant
allowance reset; Workers, D1 and Workers AI daily allowances reset at 00:00 UTC. If you deliberately upgrade to Workers Paid, consult the
[current Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) because usage
above included allowances can then be billed.

The product degrades predictably if an allowance is reached:

- a request exceeding the per-request Workers CPU limit receives a clear platform error, while the
  daily request allowance resumes after its reset;
- D1 operations resume after the daily reset or after storage space is freed;
- Browser Run and Workers AI remain optional enhancements—the deterministic scraper and manual form
  continue to work;
- the last successful deployment keeps running if the Builds allowance is reached; and
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

The address works immediately, with no website or DNS changes required.

## 3. Authenticate Wrangler to the correct account

Use a directory-bound named profile to give every command from this checkout a clear, consistent
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

The account and D1 IDs checked into the upstream repository identify its reference deployment. A fork
replaces them before its first deployment, and keeping the family's own `account_id` in configuration
adds a valuable account-selection check.

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
For later upgrades, migration files form an append-only history. A fresh installation and an existing
installation both use the same single command above: Wrangler records and applies each pending
numbered file in order. Preserve applied filenames and contents so every installation can advance
cleanly.

Local development is optional during installation. To test against an isolated local D1 database:

```sh
npm run db:migrate:local
npm run dev
```

The localhost build uses a fixed local-only identity. It does not use production family data or
consume Browser Run or Workers AI.

## 5. Understand the included browser and AI bindings

The checked-in `BROWSER` binding uses Browser Run's `content` Quick Action only after ordinary
product-page fetching fails. It needs no API token or separate resource creation. Local development
does not consume the remote allowance; production deployments attach the binding automatically.
The browser receives only the public product URL and never the signed-in person's cookies or Access
assertion.

Workers AI is included directly through the checked-in `AI` binding, with no separate API key or
model deployment. These non-secret settings live in `wrangler.jsonc`:

- `PRODUCT_AI_ENABLED` is `true` by default; set it to `false` for deterministic extraction only.
- `PRODUCT_AI_MODEL` defaults to `@cf/google/gemma-4-26b-a4b-it`. The application also accepts
  `@cf/zai-org/glm-4.7-flash`; both are currently available on Workers Free.

Cloudflare's model catalogue spans free and paid availability, so confirm the
[current Workers AI catalog and pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) before choosing a different model.
An unrecognised configured value falls back to the checked-in Gemma model.

AI contributes only to an editable draft; the family member remains in control of every saved wish.
The ordinary page result remains available whenever enrichment is unavailable.

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

That intentional response proves the Worker and D1 binding exist while the application waits safely
for its Access configuration. Keep the application's JWT validation as the complementary identity
check behind Access.

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

Pair **One-time PIN** with an Include rule containing the organiser's exact email address. OTP is the
friendly authentication mechanism; exact-email rules keep the admission list invitation-only.

In the Access application's advanced cookie settings, keep `HttpOnly` enabled and set the application
cookie's `SameSite` attribute to **Lax**. The Worker independently rejects cross-origin mutations.
The setup command in step 10 applies the intended **30-day** application session after the scoped
Access API token exists; member policies inherit that value rather than defining shorter sessions.

At this point an unauthenticated request should redirect to Cloudflare's login page:

```sh
curl -sSI https://cloudflare-family-wishlist.YOUR-SUBDOMAIN.workers.dev/
```

## 9. Configure the Worker's Access JWT validation

Access now welcomes the intended organiser and protects the edge. The Worker returns its safe setup
response until it knows which Access issuer and application audience to trust.

Find these values in Cloudflare:

- `ACCESS_TEAM_DOMAIN`: the complete team domain from Zero Trust settings, for example
  `your-team.cloudflareaccess.com`;
- `ACCESS_AUD`: the **Application Audience (AUD) Tag** shown in the Access application's details;
- `INITIAL_ORGANISER_EMAIL`: the exact email address in the organiser-only Allow policy.

Add all three as ordinary text variables under **Workers & Pages → your Worker → Settings → Variables and
Secrets**. They are deployment identifiers rather than passwords. Keep them out of reusable upstream
source so forks cannot accidentally trust the wrong Access application.

Set `INITIAL_ORGANISER_EMAIL` before attempting the first OTP login. It may instead be stored as an
encrypted Worker secret, but it must still contain the same complete email address.

The Worker creates the first member only when the authenticated email exactly matches
`INITIAL_ORGANISER_EMAIL`. Log in now using that address and confirm that an empty wishlist appears.
A mistaken broader Access policy therefore cannot decide who becomes organiser.

Every request is checked twice: Access validates its policy at the edge, then the Worker validates the
JWT signature, issuer, audience, expiry, subject and email before touching D1.

## 9a. Enable read-only viewing links

Family Wishlist can make a removable sharing link for one person's list. Relatives and friends can
enjoy that list without joining the private family space. A narrow exception to the Worker-level
Access rule enables this safely. Step 10 runs the repository's
idempotent configuration command, and the create-link action verifies the same configuration again
before it stores a token.

| Path               | Why it is public                            |
| ------------------ | ------------------------------------------- |
| `/shared/*`        | Hashed sharing-link list and picture routes |
| `/shared-assets/*` | Compiled stylesheets only                   |
| `/favicon.svg`     | Data-free application mark                  |

The command creates one self-hosted Access application per production hostname, containing exactly
those three public destinations and one **Bypass → Everyone** policy. A `workers.dev` hostname and a
custom hostname are configured separately because an Access application supports at most five
destinations. A link is built from whichever configured hostname the signed-in family member visits.

Path-based Access rules take precedence over the broader Worker rule. Cloudflare documents that
hierarchy in [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#understand-access-hierarchy)
and the narrow public-endpoint pattern in
[Common Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/#bypass-a-public-endpoint).
Cloudflare cautions that Bypass disables Access enforcement and Access request logging, which is why
these paths must not be widened.

The Worker remains a second boundary. It skips JWT validation only for GET or HEAD requests matching
the exact shared-list or shared-picture shapes. A POST, a neighbouring path or any other dynamic route
still requires Access. Static asset paths contain no family data. Shared secrets are 128-bit random
values stored only as SHA-256 hashes in D1; public queries never join claims; responses are not cached
or indexed; and revoking one link invalidates only that link immediately.

Keep the Bypass precisely scoped to the three listed destinations. The general image proxy, all forms
and every authenticated page remain behind Access.

The configuration is deliberately fail-closed. If an application with the managed name exists but
its destinations or policy differ, setup and link creation stop and ask the operator to review it;
they do not silently widen or overwrite an Access boundary. When upgrading an older installation,
remove manually created `/assets/*`, `/app.webmanifest` and `/icons/*` bypasses after the automated
application has been verified. `/assets/*` can contain authenticated browser JavaScript and must not
remain public.

## 10. Allow the organiser to invite family members

This step unlocks the complete multi-person family experience by letting **Your family** update both
Access and the application's invitation state safely.

Create a [custom Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with:

- permission **Account → Access: Apps and Policies → Edit**; and
- account resource limited to the account containing this Worker.

Use the narrowly scoped custom token and store it as an encrypted Worker secret. In the Worker
dashboard's **Variables and Secrets** settings, add:

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

Apply and verify the 30-day Access application session from this checkout. Export the two public
identifiers and list every production hostname, then read the API token privately so it does not
enter shell history:

```sh
export ACCESS_MANAGEMENT_ACCOUNT_ID="YOUR-ACCOUNT-ID"
export ACCESS_MANAGEMENT_APPLICATION_ID="YOUR-ACCESS-APPLICATION-UUID"
export WISHLIST_PUBLIC_HOSTNAMES="cloudflare-family-wishlist.YOUR-SUBDOMAIN.workers.dev"
read -s ACCESS_MANAGEMENT_API_TOKEN
export ACCESS_MANAGEMENT_API_TOKEN
npm run access:configure-session
npm run access:configure-sharing
npm run setup:check
unset ACCESS_MANAGEMENT_API_TOKEN
```

If a custom hostname already exists, include it in the comma-separated value, for example
`cloudflare-family-wishlist.YOUR-SUBDOMAIN.workers.dev,wishlist.example.com`. The sharing command is
idempotent: it confirms an exact existing application without writing. It never prints the token.
First-time concurrent runs converge by re-reading Cloudflare after a create conflict.

`npm run setup:check` is read-only. It checks the authenticated account, generated binding types,
remote D1 identity and migration state, every traffic-bearing deployed version's binding names, the
30-day session and the exact public-sharing applications. It never prints binding values or the API
token. Run it before unsetting the four setup environment variables to include the deeper Access API
checks; without them it still checks Wrangler, D1 and the deployed Worker.

The session command reads the application before changing it, retains its destinations, attached policies,
identity providers and cookie controls, and reads it again afterward. It is idempotent: rerunning it
reports the existing 30-day value without writing. Cloudflare policy durations should remain **Same
as application session duration** so organiser and invited-member policies inherit the same value.

Verify the public edge rule without needing a real sharing secret. The deliberately invalid 22-character
token must reach the Worker and return `404`; a redirect to Access means setup is incomplete:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://YOUR-PRODUCTION-HOST/shared/aaaaaaaaaaaaaaaaaaaaaa
```

Open **Your family**, add one test address and confirm that:

1. it appears as **Not signed in yet**, with a wishlist available immediately;
2. **Copy invitation** includes the application address and exact sign-in email;
3. an unrelated address receives no OTP and cannot enter; and
4. add a wish before that person signs in; after they complete OTP, they appear as **Joined** with
   the same wishlist and wish. Any claim remains hidden from them.

For an existing deployment, apply migration `0012_invited_wishlists.sql` before deploying code that
uses `first_signed_in_at`. It also creates wishlists for existing completed invitations; pending,
cleanup-required and revoked invitations are excluded. Remote migration requires operator approval.

The application creates one exact-email Access policy, records the waiting invitation in D1 and gives
the organiser a warm, ready-to-send message for their preferred private channel.

## 11. Connect automatic deployments

The first CLI deployment created the correctly named Worker and its bindings. Connect that existing
Worker to your fork rather than importing a second Worker.

First commit the installation-specific `wrangler.jsonc` changes to your fork so Cloudflare does not
build with the upstream reference account and database IDs:

```sh
git add wrangler.jsonc
git commit -m "Configure family deployment"
git push origin main
```

`worker-configuration.d.ts` is generated and intentionally ignored, so it must not be added to the
commit.

Account and database IDs are safe identifiers. Keep Access API tokens, `.env`, `.dev.vars`, database
exports and other secrets in their dedicated private stores.

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
migrations include family roles, invitation admission and revocation state, item images, product
lookup limits, product-image budgets and hashed sharing links. Migration `0010` replaces the early
single-link table with the named, five-link structure. Existing experimental sharing addresses stop
working when it is applied and must be made again; the application does not carry those early links
forward under invented names. The shared-image requester-limit migration is also required before
deploying its matching code. Migration `0011` refreshes SQLite planner statistics after the indexes
introduced by the earlier migrations.

## 12. Add a custom domain (optional)

The free `workers.dev` address is sufficient. For a friendlier address, first add a domain to the same
Cloudflare account as an active zone. Then open **Workers & Pages → your Worker → Settings → Domains &
Routes → Add → Custom Domain** and enter a hostname such as `wishlist.example.com`.

Cloudflare creates the DNS record and certificate. A custom domain cannot replace an existing CNAME
and must belong to a zone you control. See Cloudflare's [Custom Domains requirements](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Links and Add from anywhere derive their origin from the current request. The first viewing link
created while visiting the custom hostname automatically creates and verifies that hostname's narrow
public Access application. To verify it before family use, rerun
`npm run access:configure-sharing -- wishlist.example.com` with the three Access management values
exported as in step 10.

## 13. Verify the installation

Before relying on the installation, verify all of these:

- a signed-out browser is redirected to Access;
- an Access-authenticated email other than `INITIAL_ORGANISER_EMAIL` cannot bootstrap an empty
  deployment;
- only exact email addresses added by the organiser receive a usable OTP;
- the main Access application has a 30-day session and its family policies inherit that duration;
- the organiser and invited member each receive exactly one wishlist;
- an ordinary wish can be added, edited and deleted;
- **Fill from link** only prefills an editable draft and manual entry still works;
- a blocked or JavaScript-only test product either receives a Browser Run draft or returns to manual
  entry without exposing infrastructure details;
- an optional product picture is served from the application's `/product-image` address;
- one family member can claim an item and the wishlist owner cannot see that claim or purchase state;
- the invalid-token `curl` in step 10 returns `404`, not an Access redirect;
- a viewing link opens in a signed-out private browser and contains no edit or claim controls;
- Profile lists every active sharing link by its private name and **Stop sharing this link** stops only the selected link
  immediately;
- one wishlist can hold five independently working sharing links, and its popup replaces the creation
  form with removal guidance while five are active;
- a signed-out request to `/`, `/product-image` or a POST beneath `/shared/` still requires Access;
- removing an ordinary member denies their next request and signs existing application sessions out;
- `/family` is available only to the organiser; and
- a push to `main` completes one Cloudflare build and deployment.

Check D1 migrations at any time with:

```sh
npm run setup:check
```

For release-level validation of the guide itself, follow the
[fresh-deployment acceptance procedure](FRESH_DEPLOYMENT_ACCEPTANCE.md). It records evidence against
a disposable Cloudflare account while keeping the reference family deployment completely separate.

Usage is visible in **Workers & Pages → your Worker**, **D1 → your database**, **Browser Run**,
**Workers AI**, and **Workers Builds**. These dashboards are the source of truth for the account's
remaining allowances.

## Updating an installation

Follow [Backup, restore and upgrade](BACKUP_RESTORE_UPGRADE.md). It covers the pre-update recovery
point, required checks, migration ordering, post-deployment verification and the important boundary
between rolling back Worker code and restoring D1 data. Preserve every applied migration as part of
the installation's reliable upgrade history.

## Removing a family member

The organiser can choose **Remove access** beside an ordinary member on **Your family**. The
interface asks for explicit confirmation and explains the effect before the action is submitted. The
application then immediately disables that identity in D1, deletes its exact-email Access policy and
revokes every session for this Access application. Everyone is signed out once so no previously
issued token can outlive the change. The removed person's wishlist and historical data remain in D1.

If Cloudflare is temporarily unavailable, the disabled member still cannot enter the application and
the row changes to **Removal needs attention**. Choose **Finish removal** when Cloudflare is available.
Interrupted additions similarly appear as **Invitation needs attention** with a safe repair action.
