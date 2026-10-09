# Product model

## What this is

Cloudflare Family Wishlist gives one invited family a private place to share gift ideas. Each person
has one wishlist, everyone in the family can help maintain every list, and gift-givers can coordinate
without revealing surprises to the recipient.

The product gives **one household or trusted family group its own deployment**. That focused model
keeps setup, privacy and day-to-day use refreshingly simple. One explicitly configured member is the
family organiser and welcomes everyone else.

## People and trust

Cloudflare Access owns admission. The organiser adds a person's exact email address from the
application's **Manage** page. The Worker creates an exact-email Allow policy through the
Cloudflare API; only then can that person request an emailed one-time PIN from Cloudflare. The
application sees only a verified email identity after Access has admitted it.

The deployment names the initial organiser's exact email address before anybody can be provisioned.
Once the organiser successfully adds an exact email address, the application creates:

- one member record for that email; and
- one wishlist owned by that member.

The wishlist is immediately available for family members to add wishes, even before its owner signs
in. First sign-in reuses that member and wishlist by email and preserves all existing wishes. The
initial organiser is the only person whose record is created at first sign-in.

The application records who has not signed in yet and offers optional sign-in details for the organiser
to share through email, WhatsApp or any preferred private channel. The message contains the ordinary
wishlist homepage and the email to use; access is already ready, with nothing to accept. Cloudflare handles sign-in, so
the family gets one-time PIN access without an application password or reset flow. Removing access
preserves the person's wishlist and history in D1, but hides their list from the family and from
every viewing link as soon as they are disabled. Their shared pictures also become unavailable.
After removal finishes, the organiser can add the same email again to restore access and visibility
to that existing wishlist. A failed re-invitation leaves their access and list disabled until it
succeeds or is repaired.
Cloudflare Access also owns sign-out: ending a session signs that email out on all of their devices,
so Profile labels the account-wide effect before linking to the Access logout endpoint. Other family
members use separate identities and remain signed in.

“Wishlist owner” and “gift-giver” describe the viewer's relationship to a particular list:

- the owner can view and edit their own wishes but cannot see claim state in the signed-in family view;
- any other admitted member can view and edit those wishes and coordinate claims;
- the organiser manages family admission from **Manage**; all members can manage sharing links there;
  it does not give different access to wishlist editing or gift coordination.

## Core workflows

### Join the family space

1. The organiser enters a name and exact sign-in email on **Manage**.
2. The Worker adds an exact-email Allow policy in Cloudflare Access, then atomically activates the
   invitation and creates the member and wishlist. The family can start adding wishes immediately.
3. The organiser may copy and privately share the homepage link and sign-in details. This is optional;
   the person can already sign in using their admitted email.
4. The person requests and enters Cloudflare's one-time PIN.
5. The Worker validates the signed Access assertion.
6. The application resolves their existing member and wishlist by email and records their first sign-in.

The exact Access allow-list makes every membership intentional: a working mailbox becomes a family
identity only after the organiser has invited that precise address.

### Maintain a wishlist

The signed-in header puts the member's name, photo and Profile link on the right. Their existing
Gravatar appears there and beside their wishlist heading; initials stand in when no photo is
available. Profile explains how to create or change a photo on Gravatar with their sign-in email.
Photos are optional and do not affect sign-in or editing. Public viewing links do not show avatars.

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
claim as purchased. They can mark it as not bought again without releasing their claim.
Other gift-givers can see who has claimed it and its state.

In the signed-in owner's list, claim information is absent—not blurred, redacted or hidden with CSS. This rule
applies to rendered HTML, loader data, future APIs, logs and error details.

Marking a gift purchased never removes the wish. It can remain useful for repeat gifts or several
of the same thing; notes are sufficient for explaining that. Removal is a separate, explicit,
confirmed action beside Edit. Removed wishes are deleted, not archived.

### Share gift ideas outside the family

Any admitted family member can open **Manage**, tick one or more wishlists and create a named
viewing link for relatives or friends outside the private family space. **Share this list** in a
wishlist heading opens this same form with that list selected. There is one creation and management
surface for all links, including existing single-list links.

The public page opens without Cloudflare login and shows the selected people's current wishes,
notes, prices, product links and pictures, including empty lists. It never includes unselected lists,
claimant identities, other people's purchase state, sign-in emails, photos or the link's private name. Adding a new family
member does not add their list to an existing link. Changes to selected wishes appear automatically.
Every shared link allows guest reservations. Public visitors see only availability or “Reserved”
for someone else's claim, and can manage their own reservations through a private browser credential.
The owner can also visit anonymously and learn availability; that trade-off is explicitly accepted.
Guest credentials are not family identities. Revoking a link blocks further access without deleting
reservations. Another enabled family member, excluding the list owner, can clear an abandoned guest
reservation after confirmation. Guests can save a recovery code to use another browser.

The household can have up to five active sharing links in total. Each has a private, recognisable
name such as “Uncle David”. **Manage** shows every link's name, currently visible lists, creator
and creation date, with a confirmed **Stop sharing this link** control. Stopping one immediately
invalidates its public page and pictures while preserving other links and saved wishes. Disabled
owners' lists are omitted from both public viewing and the inventory's visible-list summary.

The unguessable address is the permission and is shown only when created; only its hash is stored.
Creating another never changes an existing link. At five active links, the form explains that one
must first be stopped, and atomic server checks reject creation above the limit. Existing links from
before consolidation remain usable and manageable, even when their total exceeds five; no new link
can be created until the total falls below five. Sharing is available to every admitted member;
family admission controls on the same page remain organiser-only.

## Product invariants

Cookies support family sign-in/security and guest reservation ownership only. Explain them site-wide
and before guest reservation actions. Viewing a shared link must not create or renew a guest cookie.
Do not add advertising or analytics tracking without revisiting the notice and applicable consent rules.

1. One deployment represents one trusted family group.
2. One authenticated email maps to one member.
3. One member owns exactly one wishlist.
4. Every admitted member can view and edit every enabled family member's wishlist. Disabled owners'
   retained lists cannot be viewed, edited or newly shared, including through existing viewing links.
5. The signed-in family view never sends an owner claim or purchase information for their own items. Anonymous shared views intentionally reveal reservation availability to anyone with the link.
6. An item can have at most one active claim.
7. Core wishlist and claim actions work without browser JavaScript.
8. A normal family deployment should fit within Cloudflare's free tier.
9. The configured initial organiser is an admin; invited members default to the member role.
10. All sharing links allow guest reservations, but never wish editing or disclosure of another claimant's identity or purchase state.
11. Creating a viewing link first verifies the exact hostname's narrow public Access application; an
    unusable login-gated link must never be created.

If a proposed feature breaks one of these rules, treat it as a product decision requiring maintainer
agreement rather than an ordinary implementation detail.

## Available today

- Access OTP authentication, exact-email admission and 30-day application sessions;
- invitation-time member and wishlist creation, with first-login organiser bootstrap;
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
- removable sharing links with guest reservations for sharing one or several people's gift ideas outside the family, with
  their narrow Cloudflare Access exception configured automatically.

See the [latest release](https://github.com/JonReed/cloudflare-family-wishlist/releases/latest)
and [family user guide](USER_GUIDE.md). The stricter fresh-account acceptance walkthrough and genuine
scheduled updater delivery remain follow-up verification; see [release readiness](RELEASE_READINESS.md).

## Focused product scope

The reference project stays delightfully small and family-centred:

- private, invitation-only family spaces with optional sharing links with guest reservations;
- one useful year-round wishlist per person;
- Cloudflare-managed one-time PIN sign-in;
- shared family editing with a single organiser role for admission;
- clear high, normal and low priorities;
- one independent deployment per family;
- a calm, ad-free experience without affiliate tracking or analytics scripts; and
- a compact Cloudflare footprint chosen for genuine product value.

## AI-assisted product details

Family Wishlist combines product information published by the shop with Workers AI enrichment. When
standard page data leaves gaps, AI can complete a missing product name or current GBP price from a
small, cleaned excerpt of the public page. During the same enrichment pass it may also choose the
most likely product image from a short, validated list found on the page. It cannot invent an image
address or fetch a different page. The result remains an editable draft: AI never adds a wish or
changes saved family data by itself.

When a shop or optional service shares limited information, Family Wishlist keeps every reliable
detail it found and presents the familiar editable form. This graceful resilience is part of the
product experience, with infrastructure details kept out of the family's way.

Forks can choose different boundaries, but the reference project should stay small, private and easy
for a family to operate.
