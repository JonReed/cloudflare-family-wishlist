# Roadmap

Work happens directly on `main` for the initial build. Each phase should leave the application deployable and the quality gate green.

## Phase 0 — Foundation

- [x] Create the Cloudflare-native React Router project.
- [x] Add formatting, linting, type checking, Workers-runtime tests and production builds.
- [x] Establish the visual and security baseline.
- [x] Add licence, governance, architecture and security documentation.
- [x] Publish the GitHub repository.

## Phase 1 — Cloudflare and database setup

- [x] Create and bind the D1 database.
- [x] Add versioned migrations and local migration scripts.
- [ ] Create the Worker deployment.
- [ ] Connect GitHub `main` to Cloudflare Builds.
- [ ] Configure the custom hostname or temporary Workers domain.
- [ ] Configure Cloudflare Access OTP with an exact email allow-list.

## Phase 2 — Core data model

- [x] Members schema.
- [x] Enforce exactly one wishlist per member.
- [x] Wishlist item schema, ordering and optional product links.
- [x] Store claims and purchase state separately from owner-visible data.
- [ ] Add the query and mutation service layer.

## Phase 3 — Identity and provisioning

- [x] Validate Cloudflare Access JWT signature, issuer and audience in the Worker.
- [x] Fail closed when Access configuration or assertions are absent.
- [x] Create a member and their single wishlist on first successful login.
- [x] Provide a local-only development identity mechanism that cannot be enabled in production accidentally.

## Phase 4 — Family dashboard

- List family members and wishlists.
- View any family member's wishlist.
- Clearly identify the signed-in member and their own list.
- Responsive, accessible navigation and useful empty states.

## Phase 5 — Wishlist items

- Add, edit, delete and reorder items.
- Optional notes, price guidance, priority and safe external product links.
- Validate every mutation server-side.

## Phase 6 — Secret claims

- Claim, unclaim and mark an item purchased.
- Show claim state to other gift-givers.
- Prove through query-level tests that owners never receive their own claim information.
- Handle competing claims safely.

## Phase 7 — Release readiness

- Accessibility and mobile QA.
- Backup, restore and upgrade documentation.
- Abuse-case and privacy review.
- Fresh-deployment walkthrough.
- First tagged release.
