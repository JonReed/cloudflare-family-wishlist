# Cloudflare operations reference

For a new installation, follow [the setup guide](DEPLOYMENT.md). These are optional operations after
private sign-in works. Use the same household account and saved installation settings throughout.

## What Cloudflare provides

Allowances below were checked against the linked official pages on 3 October 2026. Check those pages
again before choosing a paid plan. Most quotas are shared with other projects in the account.

| Service                                                                                                                                  | Purpose                             | Free allowance                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Workers](https://developers.cloudflare.com/workers/platform/limits/)                                                                    | Runs the app                        | 100,000 requests/day; 10 ms CPU and 50 external subrequests/request                               |
| [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and [limits](https://developers.cloudflare.com/d1/platform/limits/) | Stores wishlists and gift claims    | 5 million rows read/day; 100,000 rows written/day; 500 MB/database, 5 GB/account and 10 databases |
| [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)                                                             | Optional product-detail suggestions | 10,000 Neurons/day; some models require paid billing                                              |
| [Browser Run](https://developers.cloudflare.com/browser-run/pricing/)                                                                    | Optional rendered-page lookup       | 10 browser minutes/day                                                                            |
| [Access](https://www.cloudflare.com/plans/zero-trust-services/)                                                                          | Private email-code login            | Use Zero Trust Free; check the current plan's user limit                                          |
| [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)                                             | Optional GitHub deployments         | 3,000 build minutes/month; one concurrent build; 20-minute build timeout                          |

Normal family use is intended to fit the free plans. This is not a guarantee for an account that
also hosts busy applications. A custom domain has its own registration cost. Paid usage can incur
charges above included allowances; choosing paid billing is a separate owner decision.

The 10 ms Workers CPU limit is per request. Waiting for D1 or a product page does not count as CPU.
If the app repeatedly returns Cloudflare error `1102`, inspect CPU usage before considering Workers
Paid. Daily Workers and Workers AI quotas reset at 00:00 UTC. Check each service's linked documentation
for its reset and failure behaviour.

The app keeps manual wish entry available when Browser Run or Workers AI is unavailable. If Builds
fails or reaches its allowance, the previous successful deployment continues running. D1 limits can
prevent data operations, so monitor usage in [the account dashboard](https://dash.cloudflare.com/).

D1 Free includes [seven days of Time Travel recovery](https://developers.cloudflare.com/d1/reference/time-travel/).
Keep independent backups and practise recovery using [the backup guide](BACKUP_RESTORE_UPGRADE.md).

## Browser and AI bindings

The shared configuration includes `BROWSER` and `AI`. They are attached on deployment; no separate
API key, model deployment or account is needed. Local tests do not consume their remote quotas.

Browser Run makes one rendered-page attempt only when ordinary product fetching is unusable.
Workers AI receives a reduced public-page excerpt only when reliable details are missing. Neither
service receives family cookies or Access assertions, and neither saves a wish automatically.

`PRODUCT_AI_ENABLED` defaults to `true`; `false` disables AI enrichment. The configured default model
is `@cf/google/gemma-4-26b-a4b-it`; the application also accepts `@cf/zai-org/glm-4.7-flash`. Consult
[current pricing and model availability](https://developers.cloudflare.com/workers-ai/platform/pricing/)
before changing those defaults. Keep household overrides in Worker settings rather than changing
shared source during installation.

## Choose manual or automatic updates

Use [the update guide](UPDATES.md) to choose between manual and automatic updates. Both GitHub
options use the household fork's **Update Family Wishlist** workflow and verify the resulting
Cloudflare build. Manual users start it themselves. Automatic users connect the existing Worker’s Cloudflare timer to that same workflow with a
repository-scoped GitHub Actions key, and opt in to checks for tested `stable` releases every six hours. Manual deployment from a computer is also documented.

The normal settings are production branch `main`, build `npm run build`, deploy
`npm run deploy:production`, Node.js `24`, and the saved `WISHLIST_INSTALLATION` build variable.
Keep previews disabled and watch all paths. The build token needs D1 Edit as well as Worker
deployment permissions. Runtime Access credentials remain in the existing Worker.

Cloudflare's [Builds documentation](https://developers.cloudflare.com/workers/ci-cd/builds/) describes
its Git integration. The connected Worker name must match `workerName` in installation settings.
For tested release channels and promotion, see [RELEASES.md](RELEASES.md).

The production command verifies that the built account, Worker and D1 match current settings,
applies pending migrations, then deploys with `--keep-vars`. Runtime variables and secrets are
preserved. A failed migration stops deployment. Successful SQL is not undone if deployment then fails.
Keep migrations compatible with the currently running Worker; do not automatically restore a database
or remove migration history after a build failure.

Preview builds need their own Worker, database and credentials. Never use production migration or
production deployment commands with a preview connected to the household's database.

## Add a custom domain (optional)

The free `workers.dev` address is sufficient. If you already own a domain and want to use it:

1. Add it as an active zone in [your household's Cloudflare account](https://dash.cloudflare.com/).
2. Open **Workers & Pages → your Worker → Settings → Domains & Routes → Add → Custom Domain**.
3. Enter the chosen hostname, such as `wishlist.example.com`. Cloudflare creates its DNS record and
   certificate. Review [Custom Domains requirements](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
   first; it cannot replace an existing CNAME.
4. In a signed-out browser, verify the new address requires the same private email-code login.
5. While signed in, create a viewing link from the new address. The app verifies or creates only that
   hostname's three narrow public paths. Check the link opens without login and revocation works.

Worker-level Access already covers custom domains attached to that Worker. Do not create a broader
Bypass policy to make sharing work. Links and phone/browser saving derive their address from the
current request.

For a command-line sharing preflight, an assistant can make a private copy of
`.private/access-setup.json` with **only `hostname` changed** to the verified custom hostname, then run:

```sh
npm run setup:access -- .private/custom-access-setup.json
```

Enter the same scoped token privately. The command retains the same private application and account
while configuring only that hostname's sharing paths. Verify both production hostnames afterward.

## Updating an installation

Follow [Backup, restore and upgrade](BACKUP_RESTORE_UPGRADE.md) before changing the source. It covers
recovery points, migration ordering and the difference between rolling back Worker code and
restoring D1 data. Keep the ignored installation settings and Worker secrets separately from source.

Migration `0010` replaced experimental single-list sharing tokens with named independent links.
Those early links must be created again after that upgrade. Migration `0012` adds the member
first-sign-in column and prepares wishlists for completed invitations. Apply all pending migrations
before deploying code that uses them; the normal deployment command does this automatically.

The removal and re-invitation fixes use existing member and invitation fields. They need no manual
backfill or Access configuration change: existing removed members become eligible for re-invitation,
and their retained lists and pictures are hidden immediately when the updated Worker runs. Re-adding
keeps the original member/list IDs, wishes, claims and viewing links. Migration `0013` adds the group
sharing tables without changing those existing records or named single-list links; include it with
the source when deploying this version. `deploy:production` applies it automatically when pending.

## Removing a family member

In **Manage**, choose **Remove access** and confirm. The app disables that person, removes their
exact-email policy and revokes all application sessions, signing everyone out once. It retains the
removed person's wishlist and history.

Their list and pictures are hidden from family views and existing viewing links while disabled.
Group links can still show their other enabled lists. Add the person again after removal completes
to restore the retained list; interrupted removals must be finished first.

If Cloudflare is unavailable, the disabled person remains blocked and the organiser can choose
**Finish removal** later. Interrupted invitations similarly offer a repair action. Do not manually
change family records or broaden Access to bypass an interrupted operation.
