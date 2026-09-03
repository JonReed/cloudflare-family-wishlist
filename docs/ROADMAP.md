# Roadmap

Family Wishlist is approaching its first tagged release with every product phase complete. Work
happens directly on `main`, and each step keeps the application deployable with a green quality gate.

## Phase 0 — Foundation

- [x] Create the Cloudflare-native React Router project.
- [x] Add formatting, linting, type checking, Workers-runtime tests and production builds.
- [x] Establish the visual and security baseline.
- [x] Add licence, governance, architecture and security documentation.
- [x] Publish the GitHub repository.

## Phase 1 — Cloudflare and database setup

- [x] Create and bind the D1 database.
- [x] Add versioned migrations and local migration scripts.
- [x] Create the Worker deployment.
- [x] Connect GitHub `main` to Cloudflare Builds.
- [x] Configure the custom hostname or temporary Workers domain.
- [x] Configure Cloudflare Access OTP with an exact email allow-list.

## Phase 2 — Core data model

- [x] Members schema.
- [x] Enforce exactly one wishlist per member.
- [x] Wishlist item schema, priority ordering and optional product links.
- [x] Store claims and purchase state separately from owner-visible data.
- [x] Add the query and mutation service layer.

## Phase 3 — Identity and provisioning

- [x] Validate Cloudflare Access JWT signature, issuer and audience in the Worker.
- [x] Fail closed when Access configuration or assertions are absent.
- [x] Create a member and their single wishlist on first successful login.
- [x] Provide a local-only development identity mechanism that cannot be enabled in production accidentally.
- [x] Provision only the explicitly configured initial organiser as admin and default invited members
      to member.

## Phase 4 — Family dashboard

- [x] List family members and wishlists.
- [x] View any family member's wishlist.
- [x] Clearly identify the signed-in member and their own list.
- [x] Let members edit their own display name from a profile page.
- [x] Responsive, accessible navigation and useful empty states.
- [x] Give the organiser a separate joined/waiting family page with exact-email Access admission.
- [x] Let the organiser disable a member, revoke their Access policy and recover interrupted changes.

## Phase 5 — Wishlist items

- [x] Add, edit and delete items.
- [x] Optional notes, price guidance, priority and safe external product links.
- [x] Look up product details from a pasted link and offer them as editable suggestions.
- [x] Add products to one or more family lists from a browser bookmarklet.
- [x] Share one person's list outside the family with removable, named, read-only links.
- [x] Validate every mutation server-side.

## Phase 6 — Secret claims

- [x] Claim, unclaim and mark an item purchased.
- [x] Show claim state to other gift-givers.
- [x] Prove through query-level tests that owners never receive their own claim information.
- [x] Handle competing claims safely.

## Phase 7 — First release

- [x] Accessibility and mobile QA.
- [x] Product, architecture and developer handoff documentation.
- [x] Backup, restore and upgrade documentation.
- [x] Abuse-case and privacy review.
- [x] Publish an isolated fresh-deployment acceptance procedure.
- [ ] Execute and record the fresh-deployment walkthrough for the first release.
- [ ] First tagged release.
