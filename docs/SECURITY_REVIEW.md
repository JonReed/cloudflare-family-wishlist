# Adversarial security review

## Executive summary

The application has a strong security baseline and no critical vulnerability was found in the
reviewed source. Claim secrecy is enforced in the database query, mutations have an early
same-origin and body-size boundary, outbound product fetches are bounded, and the browser receives a
strict nonce-based Content Security Policy.

Five findings remain: one high-severity, deployment-dependent bootstrap weakness; two medium
availability and revocation weaknesses; and two low-severity recovery and supply-chain gaps. The
highest-priority change is to bind first-member provisioning to an explicitly configured organiser
identity instead of granting the first valid Access identity the organiser role. Operators should
also update the removal procedure immediately: deleting an Allow policy is not a substitute for
revoking the removed person's active Access sessions.

| Severity | Count |
| -------- | ----: |
| Critical |     0 |
| High     |     1 |
| Medium   |     2 |
| Low      |     2 |

## Scope and method

### Review record

- **Reviewed commit:** `6bda0e61e079fe9741b6564a915a829ae228b09f`
- **Review date:** 1 September 2026
- **Review performed with:** OpenAI Daybreak Blue
- **Review type:** AI-assisted, source-led adversarial security review

This report is a transparent engineering review, not an independent security audit, certification or
penetration test. It records the source and automated checks that were examined, the limitations of
that work, and the findings that were open at the reviewed commit. It does not guarantee that the
application or any particular deployment is free from vulnerabilities.

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

## Findings

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

## Controls that resisted review

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

## Recommended order

1. Update the removal runbook to revoke active Access sessions as an immediate documentation fix.
2. Bind empty-database bootstrap to the configured organiser identity (FWL-SEC-001).
3. Add application-level member disabling and a complete removal workflow (FWL-SEC-002).
4. Rate-limit the image proxy per member (FWL-SEC-003).
5. Add invitation reconciliation and tighten CI supply-chain checks (FWL-SEC-004/005).
6. After changes, repeat the Workers-runtime tests and perform a live acceptance test against a
   disposable deployment, including runtime headers, Access policy evaluation, session revocation,
   image-proxy abuse, and invitation failure injection.

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
