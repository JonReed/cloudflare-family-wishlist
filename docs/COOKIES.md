# Cookie operation

Family Wishlist ships with a site-wide **Required cookies only** notice and expandable information.
It appears on signed-in pages, shared lists and application error pages. The footer's **Cookies** link
opens its explanation directly. Cloudflare's own login/challenge pages are served by Cloudflare, outside the app layout.

The application sets `__Host-wishlist-guest` when a guest starts reserving an available gift or
successfully recovers reservations. The first reservation asks for confirmation: the second POST
must return the cookie before a reservation is created. A browser that blocks cookies gets an error
and leaves the gift available. Returning guests can reserve in one click.
Successful reservation actions renew its one-year maximum lifetime; browsing does not. That duration
supports returning to year-round wishes across gift occasions. The cookie is a random secret used
only for reservation ownership; D1 stores its hash. Only HTTP loopback development uses `wishlist-guest`;
public shared URLs redirect to HTTPS before routing. Guests see the duration before reserving.
Blocking the cookie prevents reservation management; saving
the recovery code allows access to be restored. Clearing cookies does not release reserved gifts.

Cloudflare Access supplies sign-in and security cookies. The app notice identifies the standard Access
cookies and their lifetimes, and links to Cloudflare's current documentation. Application sign-in is
configured to 30 days by setup; team-domain sessions and additional Cloudflare protections can differ.
The repository has no advertising/analytics scripts or local/session storage identifiers. The notice
itself uses no cookie, local storage or JavaScript.

## UK basis and limits

Reviewed on 9 October 2026 against the ICO's
[strictly necessary exception](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/).
The implementation relies on cookies being essential to requested authentication or reservation
management, used only for those purposes, with clear information about persistent storage. It does
not ask users to “accept” required cookies or treat continued browsing as consent. Setting a guest
credential for a visitor who only wants to read a list is deliberately avoided.

This is a cookie-specific assessment of the shipped application, not certification of every deployment
or every privacy obligation. Operators are responsible for their Cloudflare settings, any modifications,
applicable jurisdictions and any required privacy information about their processing of personal data.
UK GDPR duties, where applicable, are separate from the cookie consent exception.

## Check a deployment

1. Open a shared link in a new private browser window. **Done when:** the cookie notice appears above
   the page and its details expand without signing in.
2. Inspect cookies in the browser's developer tools: **Application → Storage → Cookies** in Chrome/Edge,
   **Storage → Cookies** in Firefox, or **Storage → Cookies** in Safari's Web Inspector.
   **Done when:** there is no `__Host-wishlist-guest` before reserving or recovering.
3. Click **I’ll get this** on a disposable test gift. **Done when:** the cookie appears and a first-reservation
   confirmation appears; the gift is still available.
4. Click **Confirm: I’ll get this**. **Done when:** the gift says **You’re getting this**.
5. Release the test gift using **Leave for someone else**. **Done when:** it becomes available again.
6. Review cookies after family sign-in and any Cloudflare security challenge.
   **Done when:** each observed cookie's purpose and duration agree with the notice and the configured
   [Access cookies](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)
   or [Cloudflare security cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/).
7. Review any scripts or integrations added outside this repository, including Cloudflare dashboard
   features. **Done when:** the required-only statement remains accurate. If it does not, stop adding
   the non-essential storage or implement the applicable information/consent controls before enabling it.

Changes to tracking, cookie purposes or lifetimes require a fresh review. Do not assume a generic
banner makes an installation compliant.
