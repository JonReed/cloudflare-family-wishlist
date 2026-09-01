# Product model

## What this is

Cloudflare Family Wishlist gives one invited family a private place to share gift ideas. Each person
has one wishlist, everyone in the family can help maintain every list, and gift-givers can coordinate
without revealing surprises to the recipient.

The intended unit is **one household or trusted family group per deployment**. It is not a hosted
multi-tenant service and does not need organisations, billing or a public directory. It has one
narrow household role: one explicitly configured member is the family organiser and can admit other
people.

## People and trust

Cloudflare Access owns admission. The organiser adds a person's exact email address from the
application's **Your family** page. The Worker creates an exact-email Allow policy through the
Cloudflare API; only then can that person request an emailed one-time PIN from Cloudflare. The
application sees only a verified email identity after Access has admitted it.

The deployment names the initial organiser's exact email address before anybody can be provisioned.
On every admitted person's first successful request, the application creates:

- one member record for that email; and
- one wishlist owned by that member.

The application records who is waiting to join but does not send an invitation email. The organiser
copies a prepared message and shares it through email, WhatsApp or any other private channel. There
is no application-managed password, password reset or public registration flow. Removing someone
from Access prevents future entry, but does not silently delete their wishlist or history from D1.
Cloudflare Access also owns sign-out: ending a session signs that email out on all of their devices,
so Profile labels the account-wide effect before linking to the Access logout endpoint. Other family
members use separate identities and remain signed in.

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

Wishes are grouped automatically: top wishes first, ordinary wishes next and nice-to-have wishes
last. Within each group, the newest addition appears first.

### Save something while browsing

The top-level **Add from anywhere** setup page provides three routes back to Family Wishlist. On
Android, a member installs the private web app once; Family Wishlist then appears as a target in the
system Share menu for web links. On iPhone and iPad, a member installs the supplied, Apple-validated
Shortcut, pastes this deployment's address once, then sends product links from the Share Sheet to the
protected add page. A current-UI build-it-yourself recipe remains available if the file cannot be
opened. On a laptop or desktop, they drag the “Add to Family Wishlist” browser button into their
bookmarks bar and click it on a product page. A clipboard helper also opens a copied HTTP(S) link when
the browser permits clipboard access.

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

### Share gift ideas outside the family

Any admitted family member can create a viewing link for one person's wishlist and send it to a
relative or friend who does not use the private family space. The link opens without Cloudflare login
and shows the current wishes, notes, prices, product links and pictures from that one list. It offers
no editing or gift coordination controls.

The unguessable link is the permission. Each wishlist can have up to five independent sharing links.
The family member gives each link a private, recognisable name such as “Uncle David” when they make
it. Creating another never changes an existing link. A family member can stop sharing any one link
from Profile, and that link stops working immediately without affecting the others. Public-list reads
use a separate database query that never joins claims, so claim and purchase information cannot enter
the public response.

Profile shows every active link across the family's wishlists, its private name, who made it, when it
was made and a persistent **Stop sharing this link** control. The list heading keeps its compact
sharing shortcut for creating and copying links, with a route to Profile for reviewing or stopping
them. At five links, the creation form is replaced with an explanation and a route to Profile; the
server also rejects a sixth link until one of the five existing links is removed.

## Product invariants

1. One deployment represents one trusted family group.
2. One authenticated email maps to one member.
3. One member owns exactly one wishlist.
4. Every admitted member can view and edit every wishlist.
5. A list owner never receives claim or purchase information for their own items.
6. An item can have at most one active claim.
7. Core wishlist and claim actions work without browser JavaScript.
8. A normal family deployment should fit within Cloudflare's free tier.
9. The configured initial organiser is an admin; invited members default to the member role.
10. A link-shared list is read-only and never receives claim or purchase data.
11. Creating a viewing link first verifies the exact hostname's narrow public Access application; an
    unusable login-gated link must never be created.

If a proposed feature breaks one of these rules, treat it as a product decision requiring maintainer
agreement rather than an ordinary implementation detail.

## Current scope

Working today:

- Access OTP authentication, exact-email admission and 30-day application sessions;
- first-login member and wishlist provisioning;
- self-service display-name editing from a personal profile page;
- organiser-only family admission with joined and waiting-to-join states;
- organiser-controlled member removal, including an explicit confirmation, immediate
  application-level disablement and preservation of the person's wishlist;
- switching between all family wishlists;
- adding, editing and deleting items;
- filling a new wish's name, image and GBP price from a public product link, with a rendered-browser
  fallback for otherwise unusable pages and optional AI help when the page does not publish reliable
  details;
- adding a product to one or more family lists from Android’s Share menu, the iPhone/iPad Share Sheet
  or a desktop browser button;
- safe product links, notes, prices and priorities;
- claiming, releasing and marking gifts purchased;
- server-enforced claim secrecy for the recipient; and
- removable, read-only sharing links for sharing one person's gift ideas outside the family, with
  their narrow Cloudflare Access exception configured automatically.

Still planned:

- backup, restore and upgrade guidance;
- final abuse-case/privacy review; and
- a repeatable fresh-deployment acceptance test and tagged release.

## Deliberate non-goals

- publicly discoverable lists or editable anonymous access;
- multiple events or multiple lists per person;
- application-managed passwords or login email;
- self-service public registration;
- granular per-list permissions or wishlist editing roles;
- manual item ordering beyond the existing high, normal and low priorities;
- a multi-family SaaS control plane;
- advertising, affiliate tracking or analytics scripts; and
- extra Cloudflare services without a demonstrated need.

## AI-assisted product details

Family Wishlist combines product information published by the shop with Workers AI enrichment. When
standard page data leaves gaps, AI can complete a missing product name or current GBP price from a
small, cleaned excerpt of the public page. During the same enrichment pass it may also choose the
most likely product image from a short, validated list found on the page. It cannot invent an image
address or fetch a different page. The result remains an editable draft: AI never adds a wish or
changes saved family data by itself.

Quota, capacity, model and extraction failures must be indistinguishable from an ordinary page that
does not share enough information. The reliable metadata result is kept, and the family can always
finish the form by hand. This resilience is part of the product contract rather than an error case to
expose as infrastructure jargon.

Forks can choose different boundaries, but the reference project should stay small, private and easy
for a family to operate.
