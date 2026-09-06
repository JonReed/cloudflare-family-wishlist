# First release — draft notes

Not yet published. Set the version, date and exact tested commit after the
[release-readiness gates](../RELEASE_READINESS.md) are complete.

## A private wishlist for your family

Run one independent household installation in your own Cloudflare account. Each person has a
wishlist; admitted family members can help maintain any list, while gift claims and purchase status
stay hidden from the wishlist owner. The organiser can add someone by email and start their wishlist
before they first sign in.

Add wishes with or without a product link, optional notes and GBP price guidance. Priorities keep top
wishes first. Product lookup offers editable suggestions, with optional AI and browser-rendering
fallbacks. Claim, unclaim and mark purchases without automatically removing wishes: the list owner
decides when something is no longer needed. Named, revocable public links provide read-only sharing
without exposing claims. A bookmarklet and Apple Shortcut make adding from other pages easier.

Core forms work without client JavaScript; enhanced forms provide quicker feedback when it is
available. Cloudflare Access handles passwordless email sign-in. The application independently
verifies admission and does not store passwords or send invitation emails.

## Installation and upgrades

- Read [the installation guide](../DEPLOYMENT.md), [installation settings](../INSTALLATION_CONFIG.md)
  and [release channels](../RELEASES.md). Installation needs both Cloudflare and GitHub setup.
- Existing installations adopting the settings separation must configure `WISHLIST_INSTALLATION`
  before building this version; household account/database identifiers no longer belong in shared
  source. Keep runtime secrets in Cloudflare, not in the repository or this JSON.
- Production Builds apply pending D1 migrations before deploying. The initial schema comprises 12
  migrations. Existing data is preserved by additive migrations; a failed Worker deployment does not
  undo SQL that already succeeded. Review [backup and recovery](../BACKUP_RESTORE_UPGRADE.md).
- Automatic upstream delivery uses a separate version-pinned installation repository. Its validation
  status and installer protocol 1 maintenance requirements are in [automatic updates](../INSTALLATION_UPDATES.md).
  Do not announce unattended delivery as verified until its remaining live tests pass. Ordinary forks
  still require upstream synchronisation.

## Deliberate limits

One household and one wishlist per member; all admitted members are trusted to edit all lists. This
is not a public registry service, enterprise permission system or purchase-history archive. There is
no offline mode or generic Docker/NAS deployment. Shop verification pages can still block lookup;
manual entry remains available. Cloudflare free allocations have limits, optional AI/browser services
are not unlimited, and infrastructure location does not mean every database is replicated worldwide.

The application is MIT-licensed and independent of the public brochure website. See
[stewardship](../STEWARDSHIP.md) for support and funding, and [architecture](../ARCHITECTURE.md#why-cloudflare)
for the platform rationale and tradeoffs.
