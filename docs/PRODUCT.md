# Product model

## What this is

Cloudflare Family Wishlist gives one invited family a private place to share gift ideas. Each person
has one wishlist, everyone in the family can help maintain every list, and gift-givers can coordinate
without revealing surprises to the recipient.

The intended unit is **one household or trusted family group per deployment**. It is not a hosted
multi-tenant service and does not need organisations, billing or a public directory. It has one
narrow household role: the first member is the family organiser and can admit other people.

## People and trust

Cloudflare Access owns admission. The organiser adds a person's exact email address from the
application's **Your family** page. The Worker creates an exact-email Allow policy through the
Cloudflare API; only then can that person request an emailed one-time PIN from Cloudflare. The
application sees only a verified email identity after Access has admitted it.

The first successfully provisioned member becomes the family organiser. On every person's first
successful request, the application creates:

- one member record for that email; and
- one wishlist owned by that member.

The application records who is waiting to join but does not send an invitation email. The organiser
copies a prepared message and shares it through email, WhatsApp or any other private channel. There
is no application-managed password, password reset or public registration flow. Removing someone
from Access prevents future entry, but does not silently delete their wishlist or history from D1.

“Wishlist owner” and “gift-giver” describe the viewer's relationship to a particular list:

- the owner can view and edit their own wishes but cannot see their claim state;
- any other admitted member can view and edit those wishes and coordinate claims;
- the organiser role controls only family admission; it does not give different wishlist access.

## Core workflows

### Join the family space

1. The organiser enters a name and exact sign-in email on **Your family**.
2. The Worker adds an exact-email Allow policy in Cloudflare Access and records the person as waiting.
3. The organiser copies and privately shares the application link.
4. The person requests and enters Cloudflare's one-time PIN.
5. The Worker validates the signed Access assertion.
6. The application idempotently creates their member and wishlist, using the invited display name.

An arbitrary email address must never be able to create an account merely by possessing a working
mailbox. The exact Access allow-list is the invitation boundary.

### Maintain a wishlist

Any member can choose any family member's list and add, edit or remove an item. An item can contain:

- a short name;
- optional notes;
- an optional HTTP(S) product link;
- an optional HTTPS product image;
- optional GBP price guidance; and
- a low, normal or high priority.

The interface should speak in family language (“wish”, “their list”, “your family”), not expose data
model terms such as “one list per member”.

### Save something while browsing

The top-level **Add from anywhere** setup page provides two deployment-specific routes back to Family
Wishlist. On iPhone and iPad, a member creates an Apple Shortcut that accepts product links from the
Share Sheet and opens the protected add page. On a laptop or desktop, they drag the “Add to Family
Wishlist” browser button into their bookmarks bar and click it on a product page. A clipboard helper
also opens a copied HTTP(S) link when the browser permits clipboard access.

Every route opens an editable draft with the product link and any details the shop makes available.
The member can change the draft and choose one or more family lists before anything is saved. Their
own list is selected by default. Setup addresses are derived from the current deployment, so a fork
does not need a hard-coded hostname.

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
9. The first member is an admin; later members default to the member role.

If a proposed feature breaks one of these rules, treat it as a product decision requiring maintainer
agreement rather than an ordinary implementation detail.

## Current scope

Working today:

- Access OTP authentication and exact-email admission;
- first-login member and wishlist provisioning;
- self-service display-name editing from a personal profile page;
- organiser-only family admission with joined and waiting-to-join states;
- switching between all family wishlists;
- adding, editing and deleting items;
- filling a new wish's name, image and GBP price from a public product link, with optional AI help
  when the page does not publish a reliable name or price;
- adding a product to one or more family lists from the iPhone/iPad Share Sheet or a desktop browser
  button;
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
- granular per-list permissions or wishlist editing roles;
- a multi-family SaaS control plane;
- advertising, affiliate tracking or analytics scripts; and
- extra Cloudflare services without a demonstrated need.

## AI is an enhancement, not a dependency

The link helper reads ordinary product metadata first. If a page is poorly marked up and Workers AI
is enabled, the application may use it to recover a missing product name or current GBP price from a
small, cleaned excerpt of the public page. During that same fallback it may also choose the most
likely product image from a short, validated list of images found on the page. It cannot invent an
image address or fetch a different page. The result remains an editable draft: AI never adds a wish
or changes saved family data by itself.

Quota, capacity, model and extraction failures must be indistinguishable from an ordinary page that
does not share enough information. The reliable metadata result is kept, and the family can always
finish the form by hand. This graceful fallback is part of the product contract rather than an error
case to expose as infrastructure jargon.

Forks can choose different boundaries, but the reference project should stay small, private and easy
for a family to operate.
