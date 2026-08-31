# Product model

## What this is

Cloudflare Family Wishlist gives one invited family a private place to share gift ideas. Each person
has one wishlist, everyone in the family can help maintain every list, and gift-givers can coordinate
without revealing surprises to the recipient.

The intended unit is **one household or trusted family group per deployment**. It is not a hosted
multi-tenant service and does not need organisations, roles, billing or a public directory.

## People and trust

Cloudflare Access owns admission. A maintainer adds an exact set of email addresses to the Access
policy; those people can request an emailed one-time PIN from Cloudflare. The application sees only a
verified email identity after Access has admitted it.

On the first successful request, the application creates:

- one member record for that email; and
- one wishlist owned by that member.

There is no in-application invitation, registration, password, password reset or email-delivery flow.
Removing someone from Access prevents future entry, but does not silently delete their wishlist or
history from D1.

“Wishlist owner” and “gift-giver” describe the viewer's relationship to a particular list:

- the owner can view and edit their own wishes but cannot see their claim state;
- any other admitted member can view and edit those wishes and coordinate claims;
- there are no administrator/editor/viewer roles inside the application.

## Core workflows

### Join the family space

1. The maintainer admits an email address in Cloudflare Access.
2. The person requests and enters Cloudflare's one-time PIN.
3. The Worker validates the signed Access assertion.
4. The application idempotently creates their member and wishlist if needed.

An arbitrary email address must never be able to create an account merely by possessing a working
mailbox. The exact Access allow-list is the invitation boundary.

### Maintain a wishlist

Any member can choose any family member's list and add, edit or remove an item. An item can contain:

- a short name;
- optional notes;
- an optional HTTP(S) product link;
- optional GBP price guidance; and
- a low, normal or high priority.

The interface should speak in family language (“wish”, “their list”, “your family”), not expose data
model terms such as “one list per member”.

### Save something while browsing

The dedicated browser-button setup page provides a deployment-specific “Add to Family Wishlist”
bookmarklet, with a visual explanation of the unfamiliar drag-to-bookmarks interaction. A member
drags it to their browser's bookmarks bar, then clicks it on a product page. Family Wishlist opens in
a new tab with the product link and any details the shop makes available. The member can edit the
draft and choose one or more family lists before anything is saved. Their own list is selected by
default.

Adding to several lists creates an independent wish on each list. The operation is all-or-nothing: a
stale or missing list must not leave only some of the selected lists updated.

### Coordinate a gift

On somebody else's list, a member can claim an unclaimed item, release their own claim, or mark their
claim as purchased. Other gift-givers can see who has claimed it and its state.

On the owner's list, claim information is absent—not blurred, redacted or hidden with CSS. This rule
applies to rendered HTML, loader data, future APIs, logs and error details.

## Product invariants

1. One deployment represents one trusted family group.
2. One authenticated email maps to one member.
3. One member owns exactly one wishlist.
4. Every admitted member can view and edit every wishlist.
5. A list owner never receives claim or purchase information for their own items.
6. An item can have at most one active claim.
7. Core wishlist and claim actions work without browser JavaScript.
8. A normal family deployment should fit within Cloudflare's free tier.

If a proposed feature breaks one of these rules, treat it as a product decision requiring maintainer
agreement rather than an ordinary implementation detail.

## Current scope

Working today:

- Access OTP authentication and exact-email admission;
- first-login member and wishlist provisioning;
- self-service display-name editing from a personal profile page;
- switching between all family wishlists;
- adding, editing and deleting items;
- filling a new wish's name and GBP price from a public product link, with optional AI help when the
  page does not publish reliable product metadata;
- adding a product to one or more family lists from a browser bookmarklet;
- safe product links, notes, prices and priorities;
- claiming, releasing and marking gifts purchased; and
- server-enforced claim secrecy for the recipient.

Still planned:

- manual item reordering;
- backup, restore and upgrade guidance;
- final abuse-case/privacy review; and
- a repeatable fresh-deployment acceptance test and tagged release.

## Deliberate non-goals

- public or link-shared lists;
- multiple events or multiple lists per person;
- application-managed passwords or login email;
- self-service public registration;
- granular per-list permissions;
- a multi-family SaaS control plane;
- advertising, affiliate tracking or analytics scripts; and
- extra Cloudflare services without a demonstrated need.

## AI is an enhancement, not a dependency

The link helper reads ordinary product metadata first. If a page is poorly marked up and Workers AI
is enabled, the application may use it to recover a missing product name or current GBP price from a
small, cleaned excerpt of the public page. The result remains an editable draft: AI never adds a wish
or changes saved family data by itself.

Quota, capacity, model and extraction failures must be indistinguishable from an ordinary page that
does not share enough information. The reliable metadata result is kept, and the family can always
finish the form by hand. This graceful fallback is part of the product contract rather than an error
case to expose as infrastructure jargon.

Forks can choose different boundaries, but the reference project should stay small, private and easy
for a family to operate.
