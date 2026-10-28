# Security review and remediation record

## Executive summary

The reviewed application has a strong security baseline. Claim secrecy is enforced in the database
query, mutations have an early
same-origin and body-size boundary, outbound product fetches are bounded, and the browser receives a
strict nonce-based Content Security Policy.

The original review found five actionable issues: one high-severity, deployment-dependent bootstrap
weakness; two medium availability and revocation weaknesses; and two low-severity recovery and
supply-chain gaps. Those findings were fixed and re-reviewed. A final Daybreak Blue review of commit
`ad9571c91bc7b5eb4cf50bb63a7ba64292d99584` found no remaining actionable security findings in the
reviewed source. A further release-candidate diff review from `v1.0.0` to `b60c801524e0e3f805504ded8b7bc38e00ed5f00`
found no concrete plausible vulnerabilities in the changes proposed for v1.1.0.

| Severity | Original | Remaining |
| -------- | -------: | --------: |
| Critical |        0 |         0 |
| High     |        1 |         0 |
| Medium   |        2 |         0 |
| Low      |        2 |         0 |

## Scope and method

### Review record

- **Reviewed commit:** `6bda0e61e079fe9741b6564a915a829ae228b09f`
- **Review date:** 1 September 2026
- **Review performed with:** OpenAI Daybreak Blue
- **Review type:** AI-assisted, source-led adversarial security review

This transparent engineering review records the source, automated checks, review boundaries and
findings present at the reviewed commit. Its purpose is practical engineering assurance rather than
certification, and its evidence complements each operator's deployment acceptance checks.

This was a source-led adversarial review of the Worker entry point, Cloudflare Access validation and
policy management, D1 migrations and services, React Router loaders/actions and rendered URL sinks,
product metadata and image fetchers, browser scripts, security headers, tests, Wrangler
configuration, dependencies, and CI workflow.

The review attempted to violate these boundaries:

- become the first organiser through an unintended identity;
- retain access after removal;
- reveal a recipient's claim or purchase data;
- forge or replay identity, bypass mutation-origin checks, or submit oversized bodies;
- turn product import or image loading into SSRF, credential forwarding, active-content delivery, or
  resource exhaustion;
- inject script through stored family or product data;
- leave Access admission broader than D1 admission after partial failure; and
- compromise deployment through dependencies or CI configuration.

Commands run on 1 September 2026:

- `npm run quality` — passed: formatting, lint, generated binding check, TypeScript, 189 tests in 15
  files, and production build;
- `npm run audit` — passed with zero known vulnerabilities at the configured moderate threshold; and
- static searches for browser injection sinks, unsafe navigation, credential forwarding, secrets,
  floating promises, global request state, unsafe casts, and unbounded fetches.

The live Cloudflare account, Access application and policies, Worker routes, deployed response
headers, active sessions, production D1 data, GitHub branch protection, and Cloudflare Builds settings
were not inspected or mutated. Findings that depend on those controls are marked accordingly.

## Remediation and verification

### Remediation record

- **Primary remediation commit:** `4273d44c2206f6809eac464b2201554436c9df0d`
- **Follow-up reconciliation commit:** `ad9571c91bc7b5eb4cf50bb63a7ba64292d99584`
- **Remediation date:** 1 September 2026
- **Repository verification:** `npm run quality` passed with 204 tests in 16 files and a production
  build; `npm run audit` reported zero vulnerabilities at the configured moderate threshold.

The primary remediation bound first-member creation to `INITIAL_ORGANISER_EMAIL`, added immediate
D1 disablement and application-session revocation for removals, added atomic minute/day image-fetch
budgets, made interrupted invitations and removals recoverable, audited development dependencies and
pinned CI actions to immutable commits.

The first Daybreak Blue re-review found one remaining low-severity issue: invitation repair examined
only the first 50 Access policies. The follow-up commit requests the endpoint's complete 1,000-policy
page and accepts it only when the pagination metadata proves the returned list is complete. Tests
cover a match beyond position 50 and fail closed on inconsistent pagination metadata.

### Final verification review

- **Reviewed commit:** `ad9571c91bc7b5eb4cf50bb63a7ba64292d99584`
- **Review date:** 1 September 2026
- **Review performed with:** OpenAI Daybreak Blue
- **Verdict:** Pass — no actionable security findings remained in the reviewed source.

| Finding       | Final status |
| ------------- | ------------ |
| `FWL-SEC-001` | Closed       |
| `FWL-SEC-002` | Closed       |
| `FWL-SEC-003` | Closed       |
| `FWL-SEC-004` | Closed       |
| `FWL-SEC-005` | Closed       |

The final pass re-examined organiser bootstrap, Access JWT validation and policy/session management,
D1 state transitions, claim secrecy and authorization, mutation-origin enforcement, SSRF and
credential forwarding, product resource budgets, AI boundaries, browser injection, CSP, service
worker caching, secret handling, Worker request hygiene and CI supply-chain controls.

The review remained source-led. Operators complete the picture for their own live Access policies,
deployed headers, sessions, D1 instance, GitHub settings and Cloudflare Builds configuration by
following the acceptance checks in [DEPLOYMENT.md](DEPLOYMENT.md). Together, the source review and
deployment checks provide complementary evidence at both layers.

### v1.1.0 release-diff review

- **Range:** `v1.0.0` (`df0f5598eabf3ad4b87561ec5cc0ca50897f4f48`) through
  `b60c801524e0e3f805504ded8b7bc38e00ed5f00` on `main`.
- **Review date:** 24 September 2026.
- **Methods:** Codex Security diff scan of all 16 changed source files, followed by an independent,
  read-only OpenAI Daybreak Blue review of the exact Git diff and its supporting controls.
- **Result:** No concrete plausible security vulnerabilities found in the reviewed changes. No source
  fix was required by these reviews.
- **Verification:** `npm run quality` passed at the reviewed commit with 423 tests and a production
  build; `npm run audit` on 24 September found zero known vulnerabilities at the configured moderate
  threshold.

The review traced asynchronous product lookup through authentication, same-origin and body-size
checks, the per-member lookup budget, public-target and redirect validation, response bounds, and the
Browser Run/AI and image-proxy boundaries. It checked the new purchase-state action against the
claimant-scoped D1 update and verified that owner-facing wishlist results still omit claim data. It
also examined organiser-only family admission, edit/remove dialogs, native form fallbacks, rendering
of untrusted strings and URLs, CSP, and the changed dependency lockfile. The lockfile changes update
integrity-pinned development/build packages; runtime dependencies and `package.json` did not change.

This was a source review of the release diff. It did not inspect live Access policies, cookie settings,
deployed response headers, production D1, Cloudflare Builds, or an independent household installation.
Those deployment checks remain the responsibility of each operator. The review applies to the exact
commit above; a later release commit needs its own gates and a check of any intervening changes.

## Resolved findings and evidence

### FWL-SEC-001 — First valid Access identity becomes organiser

**Severity:** High (deployment-dependent)  
**Rule:** Authentication must not implicitly grant privileged application authorization  
**Location:** `app/lib/db/members.ts:102-145`; `docs/DEPLOYMENT.md:255-303`

**Evidence.** When no member exists, `ensureMemberForEmail()` inserts any successfully authenticated
email without requiring an active invitation and assigns `admin` because the members table is empty.
The deployment guide relies on an exact-email Access Allow policy and instructs the intended
organiser to log in first. It correctly warns that using One-time PIN as the Include rule admits
anyone with a valid email address, but the application does not independently bind the empty-database
bootstrap to the intended organiser.

**Attack.** If an operator accidentally configures a broad OTP policy, enables another overly broad
Allow rule, or exposes more than the intended identity before bootstrap, the first person to complete
authentication becomes the family organiser. They can then create exact-email Access policies for
additional accounts and control the new deployment.

**Impact.** A single Access policy mistake during initial setup can become persistent application
administrator takeover.

**Fix.** Require an explicit bootstrap identity when `members` is empty. For example, configure an
`INITIAL_ORGANISER_EMAIL` deployment variable and require a constant, normalized match before the
first insert; clear or ignore the variable after provisioning. An alternative is an out-of-band,
pre-seeded active invitation for the first identity. Add tests proving that another valid Access
identity cannot win a concurrent or sequential first-login race.

**Mitigation.** Until fixed, retain the exact-email-only setup instructions, verify the effective
Access policy with Cloudflare's policy tester, provision the organiser before adding any other Allow
rule, and include this check in fresh-deployment acceptance testing.

**False-positive boundary.** A deployment whose effective Access policy admits only the intended
organiser during bootstrap is not exploitable through this path. The severity reflects the impact of
a realistic configuration error, not a bypass of a correctly configured Access policy.

### FWL-SEC-002 — Removing an Allow policy does not revoke active member access

**Severity:** Medium  
**Rule:** Revocation must terminate current authorization, not only prevent a future login  
**Location:** `app/lib/db/members.ts:86-110`; `docs/DEPLOYMENT.md:442-447`

**Evidence.** Existing members are accepted solely by normalized email lookup and have no disabled or
revoked state in D1. The documented removal procedure only deletes the person's exact-email Access
policy. Cloudflare documents session revocation separately and provides per-user and per-application
token revocation; a valid application cookie otherwise remains usable for its session duration.

**Attack.** A removed family member keeps using an already authenticated browser or a still-valid
Access application token after the operator deletes their Allow policy.

**Impact.** The removed person can continue reading and changing all family wishlists, including
claim data visible to gift-givers, until Access rejects the existing session or it expires.

**Fix.** Add an application-level membership state such as `disabled_at` and reject disabled members
on every route before loading family data. A future removal flow should disable D1 access first, then
delete the exact-email policy and revoke the user's active Access session, with explicit partial
failure state and reconciliation.

**Mitigation.** Amend the operator procedure now to delete the Allow policy **and** revoke the user in
Zero Trust under Team & Resources → Users. Keep Access policy/application session durations short
enough for the household's risk tolerance.

**False-positive boundary.** If the operator separately revokes the user's Access sessions, the
residual window is limited to Cloudflare's documented revocation propagation time. That step is not
present in the current removal instructions.

### FWL-SEC-003 — Authenticated image proxy has no usage budget

**Severity:** Medium  
**Rule:** User-driven server fetchers must constrain aggregate use as well as each individual response  
**Historical implementation:** The product-image proxy was removed on 2026-10-10. Product pictures
now hotlink validated HTTPS URLs with no referrer; private avatar fetching retains its bounded reader.
The following finding describes the earlier proxy.

**Location:** `app/routes/product-image.ts:7-24`; `app/lib/product-image.ts:3-5,60-123`;
`app/lib/db/product-lookups.ts:1-42`

**Evidence.** Each `/product-image` request may follow up to four redirects, wait for eight seconds,
and buffer up to 4 MiB. Membership is checked, but there is no per-member lookup budget, request
coalescing, or Worker-side cache. The metadata/AI fetch path has a concurrency-safe limit of 12
lookups per member per minute; the image path does not use it. `private` browser caching does not
limit scripted requests or requests with unique query values.

**Attack.** A malicious family member, compromised Access session, or same-origin malicious browser
extension repeatedly requests unique public image URLs. The requests consume Worker invocations,
outbound connections, memory while buffering, and remote-origin bandwidth.

**Impact.** On Workers Free, this can consume the deployment's daily request allowance and make the
wishlist unavailable to the household. On paid usage it can also create avoidable resource cost.

**Fix.** Add a D1-backed per-member image-fetch budget, ideally with a separate burst and daily cap.
Consider issuing short-lived, signed proxy URLs for unsaved previews and allowing saved images only
when the exact URL exists on a family item. Preserve redirect validation, the public-fetch
compatibility flag, MIME allowlist, timeout, and byte cap.

**Mitigation.** Monitor `/product-image` request volume and Worker invocation outcomes. A lower
Wrangler CPU/subrequest ceiling can reduce runaway per-invocation cost but does not replace
member-level aggregate limiting.

**False-positive boundary.** Access restricts exploitation to admitted identities or compromised
sessions, and the 4 MiB limit prevents a single unbounded response. Neither control prevents repeated
bounded requests.

### FWL-SEC-004 — Invitation recovery misses abrupt termination and has no reconciliation path

**Severity:** Low  
**Rule:** Cross-system authorization changes need durable, inspectable reconciliation  
**Location:** `app/routes/family.tsx:58-115`; `app/lib/db/family-members.ts:140-165,211-265`

**Evidence.** The action creates an Access Allow policy and only afterwards stores its returned policy
ID in D1. JavaScript exception paths attempt rollback and can record `cleanup_required`, but an
abrupt Worker termination between policy creation and D1 activation bypasses those catches. The
pending row retains no policy ID, its unique email blocks a retry, and neither the family page nor
operator guide exposes pending/cleanup-required reconciliation.

**Attack/failure.** A runtime termination, resource limit, or lost response after Cloudflare creates
the policy leaves an exact-email Allow policy active while D1 remains pending. The invited person
passes Access but D1 denies family provisioning; the organiser cannot retry that email through the
application.

**Impact.** D1 correctly prevents family-data disclosure, but the outer Access boundary remains wider
than intended and the invitation is stuck until manually diagnosed.

**Fix.** Add an organiser-visible recovery flow that lists non-active invitations and reconciles
policies by the deterministic invitation-derived name. It should delete orphan policies or safely
resume activation and record every result. Document manual recovery until that flow exists.

**Mitigation.** Alert on the existing `family_invitation_*_failed` events and periodically compare
`Family Wishlist member <id-prefix>` policies with D1 invitation state.

**False-positive boundary.** Ordinary API and D1 exceptions are handled defensively. This finding is
about termination between two separately committed systems and the absence of a later reconciliation
mechanism.

### FWL-SEC-005 — Automated supply-chain checks omit development dependencies and immutable action pins

**Severity:** Low  
**Rule:** Build and CI dependencies should be checked and reproducibly pinned  
**Location:** `.github/workflows/ci.yml:20-36`; `package.json:31-49`

**Evidence.** CI installs all dependencies and runs Wrangler, Vite, React Router, ESLint, TypeScript,
Vitest, and Cloudflare plugins, but its audit command uses `--omit=dev`, excluding those executable
build dependencies from the automated advisory gate. The workflow references `actions/checkout@v7`
and `actions/setup-node@v7` by movable tags rather than full commit SHAs. GitHub recommends full SHA
pinning because tags can move.

**Attack.** A known vulnerable build dependency can pass the automated audit, or a compromised action
tag can change what CI executes. This workflow has read-only repository permissions and no declared
secrets, which materially limits direct impact, but false-success CI and build-system compromise
remain possible.

**Impact.** The automated gate can miss known vulnerabilities in code that executes during testing
and production builds.

**Fix.** Run the repository's existing `npm run audit` in CI without `--omit=dev`, and pin external
actions to reviewed full commit SHAs with a version comment. Keep automated dependency updates enabled
for both runtime and development dependencies.

**Mitigation.** The maintainer workflow already requires the full local audit before push, and the
review-time full audit found zero known vulnerabilities. Preserve least-privilege workflow
permissions.

**False-positive boundary.** This is not evidence of a currently vulnerable package or compromised
action. It is a gap between the documented all-dependency gate and the automated enforcement.

## Controls confirmed by review

- **Claim secrecy:** `app/lib/db/wishlists.ts:61-94` puts the owner inequality in the claims join;
  `app/lib/db/wishlists.ts:230-267` returns a union with no claim field for the owner. The tests check
  serialized owner output for claim state and claimant IDs.
- **Claim integrity:** the database primary key permits one claim per item, owners cannot claim their
  own items, and state/release changes require the current claimant.
- **Access JWT validation:** `app/lib/auth/access.ts:92-129` fixes RS256 and verifies issuer,
  application audience, signature, time claims through `jose`, subject, and normalized email. Missing
  production configuration and assertions fail closed.
- **Mutation boundary:** `app/lib/request-security.ts:14-112` rejects missing, opaque, malformed, and
  cross-origin mutation origins; accepts only form content types; and reads at most 32 KiB before
  authentication or routing.
- **SSRF and credential forwarding:** product page and image fetches accept only credential-free
  HTTP(S) destinations, revalidate every redirect, set `global_fetch_strictly_public`, construct fresh
  outbound headers, apply timeouts, and bound response reads. No family request header, cookie,
  Access assertion, or authorization value is forwarded.
- **AI boundary:** only reduced public-page evidence and validated image candidates reach Workers AI;
  returned titles/prices must occur in source evidence, image selection is by existing candidate
  index, and AI cannot persist a wish.
- **Browser injection:** family and product strings use React's escaped JSX rendering. No untrusted
  `dangerouslySetInnerHTML`, DOM HTML injection, `eval`, string event handler, cross-window messaging,
  token storage, or third-party browser script was found.
- **Response hardening:** `app/lib/security-headers.ts:1-48` sets private caching, `nosniff`, restrictive
  opener/resource/referrer/permissions policies, and a nonce-based CSP without `unsafe-inline` or
  `unsafe-eval`; framing, objects, cross-origin connections, and cross-origin form actions are denied.
- **Database boundary:** user-controlled SQL values use prepared statements and `.bind()`. IDs are
  random UUIDs, persistent field lengths and states have service validation plus schema constraints,
  and multi-list insert completeness is enforced in one statement.
- **Worker hygiene:** compatibility date and generated binding types are current, `nodejs_compat` and
  `global_fetch_strictly_public` are explicit, observability is enabled, no request-specific mutable
  module state or floating promise was found, and secrets are not present in client assets or
  Wrangler variables.

## Remediation path

The source remediations followed this sequence; the disposable live walkthrough remains the final
published release milestone:

1. Updated the removal runbook to include active Access session revocation.
2. Bound empty-database bootstrap to the configured organiser identity (FWL-SEC-001).
3. Added application-level member disabling and a complete removal workflow (FWL-SEC-002).
4. Added a per-member image-proxy budget (FWL-SEC-003).
5. Added invitation reconciliation and strengthened CI supply-chain checks (FWL-SEC-004/005).
6. Repeated the Workers-runtime tests and defined the live acceptance exercise for runtime headers,
   Access policy evaluation, session revocation, image-proxy budgets and invitation recovery.

## Current references

- [Cloudflare Access: validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Cloudflare Access: application token claims](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [Cloudflare Access: session management and revocation](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Workers compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [GitHub Actions security hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats)
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## v1.1.1 release preparation

The application range is `v1.1.0` through `808d593` (the last application/documentation commit before
release preparation). Preparation after that point changes version metadata, release-only setup
instructions, updater error links and a Git integration test; it adds no application permissions or
dependency version changes.

This preparation includes source inspection of returning-member activation, the additive
`0013_family_share_links.sql` migration, public-share filtering and authenticated avatar retrieval.
The automated suite covers upgrade data preservation, claim privacy, disabled members, shared
images, invitation retries and avatar admission. The complete quality and audit gates are required
again for the final release candidate.

This is a release verification note, not a new independent security scan. The earlier external/AI
review results above apply only to their stated ranges. Live scheduled update delivery and failure
recovery remain publication blockers until separately recorded in `RELEASE_READINESS.md`.

## v1.1.2 release preparation

- **Application range:** `v1.1.1` (`c6c539a68b60f6ec2f88025ecf0c0b5c720f03bf`) through
  `b8aca1e8e9e1db88aed33f5ce181e91f06d740c0` on `main`. The subsequent release-preparation changes
  update version metadata, release notes and documentation; they add no runtime code or dependencies.
- **Review date:** 16 October 2026.
- **Method:** source inspection and regression-test review of the guest-reservation boundary, shared
  availability queries, product-picture loading, browser title helpers and setup input safeguards.
  This is release verification, not a new independent or exhaustive security scan. Earlier review
  verdicts above remain limited to their stated commits.
- **Automated verification:** `npm run quality` and `npm run audit` passed during release preparation:
  585 Workers-runtime tests in 54 files, four setup-script tests, eight updater integration tests,
  formatting, lint, binding and route type checks, and a production build. The audit reported zero
  known vulnerabilities at the configured moderate threshold. The release workflow repeats the gates
  against the final tagged commit before promotion.

The reviewed services retain the signed-in owner's claim-free SQL join and returned union. Shared
links intentionally expose reservation availability to all visitors, including an owner visiting
anonymously, while returning purchase state only for the current guest's own credential. Member IDs,
other guests' credentials and other people's purchase state stay outside shared results. Guest writes
recheck active link membership, enabled owners and credential ownership inside SQL. Tests cover
member/guest concurrency, revoked links, disabled owners, cross-list attempts, recovery, missing and
duplicate cookies, first-use cookie confirmation, and atomic per-link and per-guest request limits.

Product pictures now load directly from validated HTTPS addresses with `no-referrer`; the old product
image proxy routes are removed. Picture hosts receive browser requests and may receive their own
cookies, as disclosed in the application and [cookie documentation](COOKIES.md). Authenticated avatar
fetching remains bounded. CSP permits HTTPS images but retains nonce-based script protection.
Optional public helpers handle broken pictures and title expansion without exposing the signed-in
client runtime. The guest cookie remains Secure, HttpOnly, host-only and SameSite=Lax in production;
view-only requests do not create or renew it.

Chrome browser QA covered desktop and narrow mobile layouts (1280, 390 and 320 pixels), long and
unbroken titles, keyboard expansion, resizing, navigation and editing an expanded title down to a
short one. Local Workers development and an HTTPS production preview exercised native guest
reservation, confirmation, recovery, purchase, undo and release forms with and without JavaScript.
Separate browser contexts checked shared purchase visibility and the signed-in recipient boundary.
The migration regression preserves older household data and applies the ordered migrations again.

These checks do not verify Safari or Firefox, a new household installation, live Access policies,
production D1 data, every retailer's picture behaviour, or delivery to every connected household.
GitHub CI and the reference Cloudflare build passed for the application tip above; the final release
still requires its own successful promotion and deployment checks. Scheduled update delivery was
verified separately on 3 October 2026 in [release readiness](RELEASE_READINESS.md).

Brochure source was also reviewed at `9e69404b892d5bd4f3018a16f5c2fd67abd7bed1` in the separate
`family-wishlist-website` repository. Its feature and privacy copy still needs to describe guest
reservations, distinguish signed-in recipient privacy from anonymous shared-link availability, and
disclose directly loaded product pictures. This release's notes and user guide state those changes;
the brochure update is a separate follow-up. Live brochure requests returned HTTP 403 in this
environment, so this was a source review rather than verification of deployed pages.

## v1.1.3 release preparation

The reviewed range is `v1.1.2` (`f7e9a4ef613b3607c389d0b7da3739af4552e264`) through `v1.1.3`,
prepared on 16 October 2026. Changes move cookie information into `SiteFooter`, retain the native
privacy disclosure on error pages and add a nonce-protected public display helper. It remembers
showing the introduction automatically using only `wishlist-cookie-notice-seen=1` in local storage.
This preference is not acceptance, a credential or an identifier and is never sent to the server.
Blocked storage and JavaScript-free pages retain the native disclosure without a repeating banner.
No database rules, guest credentials, dependencies or Cloudflare permissions change.

Release verification includes the complete quality and audit gates, footer/script rendering tests,
and Chrome desktop/mobile checks of first display, reload without dismissal, closing, reopening,
navigation, shared/signed-in browser memory, blocked storage, and native guest forms without
JavaScript. This is focused source and local browser verification, not a new independent security
scan or evidence of every household deployment. The earlier brochure follow-up remains separate.

## v1.1.4 release preparation

- **Application range:** `v1.1.3` (`3be1a78dfaa9ff6ae3fc903457884fec6cfd1667`) through
  `4308de1c14da17efc9d07e5a30d7853a7460e800`. Release preparation adds version metadata,
  documentation and upgrade tests, with no further application or dependency changes.
- **Review date:** 28 October 2026.
- **Method:** focused source and regression-test review of link-owned guest reservations, URL aliases,
  shared assets, bounded Browser Run responses and the household deployment path. This is not a new
  independent or exhaustive security scan. Earlier verdicts remain limited to their stated ranges.

Reservations now use the sharing link's canonical hash and a stored link-name snapshot. Both an old
address and its displayed alias resolve to the same scope and atomic per-link request limit. Every
guest write rechecks link membership, enabled owners and reservation ownership in SQL. A unique claim
per item prevents competing family members or links from reserving the same gift. Public results
expose availability and the current link's purchase state, without family claimant identities, stored
hashes or link names. Anyone holding a link can manage its reservations; this intended behaviour is
documented on Manage and in the user guide. The signed-in owner's claim-free query remains unchanged.
Origin checks and bounded form handling remain in force; guest cookies and recovery codes are removed.

Migration `0016_link_reservations.sql` adds a nullable column without changing existing rows. Older
browser-owned reservations remain reserved and cannot be taken over through a sharing link. The
upgrade regression starts at the v1.1.3 schema, preserves member claims and guest claims/purchases,
reapplies the migration list safely, checks old Worker inserts and exercises new link reservations.
The real-Git updater test also verifies delivery of this migration file while preserving household
workflows and settings. Existing deployment tests verify migrations precede Worker deployment,
failure stops the deployment and successful SQL is not undone after a later Worker failure.

Release verification runs the complete quality and dependency-audit gates against an isolated copy
of the intended release files, excluding the unrelated uncommitted cookie-layout work. The release
workflow repeats both gates against the final tag. Prior browser QA covered desktop and 390-pixel
mobile tag layouts and navigation, cross-browser reservation/purchase/release, family display names,
and the one-time notice. CI and the reference Cloudflare build passed at the application tip above.

This evidence does not establish every household's build configuration, live database migration or
scheduled delivery, and does not constitute fresh Safari/Firefox or retailer-wide verification.
Configured household updates use `npm run deploy:production` to migrate before deployment; a custom
bare Wrangler deploy command bypasses that step. The prior live scheduled-delivery evidence remains
in [release readiness](RELEASE_READINESS.md).

Brochure source was rechecked at `9e69404b892d5bd4f3018a16f5c2fd67abd7bed1` in the separate
website repository. The previously recorded follow-up still applies: its recipient-privacy copy
needs the shared-link exception, and its feature/privacy copy needs guest reservations and directly
loaded pictures. This release's user guide and notes describe those behaviours; no brochure deployment
was performed as part of this release.
