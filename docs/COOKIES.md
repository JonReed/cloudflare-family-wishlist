# Cookie operation

Family Wishlist keeps cookie information in the footer on signed-in pages, shared lists and
application error pages. **Cookies & privacy** always opens its explanation. An introduction appears
once per browser, with an optional Close button and no acceptance step. It records that it was shown
automatically, so you do not need to click anything to prevent it appearing on later visits.
Cloudflare's own login/challenge pages are served by Cloudflare, outside the app layout.

Shared-link reservations do not use cookies. They belong to the named sharing link, so opening that
same link on another device shows the same reservations and controls. Reserving, marking bought and
releasing work with cookies blocked. Existing `__Host-wishlist-guest` cookies from the old browser-code
flow are ignored and no longer renewed; clearing them does not release any gifts. Public shared URLs
still redirect to HTTPS before routing.

Cloudflare Access supplies sign-in and security cookies. The app notice identifies the standard Access
cookies and their lifetimes, and links to Cloudflare's current documentation. Application sign-in is
configured to 30 days by setup; team-domain sessions and additional Cloudflare protections can differ.
The repository has no advertising/analytics scripts or local/session storage identifiers. A small
nonce-protected helper stores only the fixed local preference `wishlist-cookie-notice-seen=1` after
showing the introduction. This is not consent or a visitor identifier, is never sent to the server,
and lasts until site data is cleared. If storage is unavailable, the introduction stays hidden rather
than repeating. Without JavaScript, the permanent native footer disclosure still opens normally.

## UK basis and limits

Reviewed on 9 October 2026 against the ICO's
[strictly necessary exception](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/).
The implementation relies on cookies being essential to requested authentication, used only for those purposes, with clear information about persistent storage. It does
not ask users to “accept” required cookies or treat continued browsing as consent. Shared-link reservations do not need browser credentials.

This assessment covers Family Wishlist’s own authentication cookies. It does not
assess the cookies of external product-picture hosts. It is not certification of every deployment
or every privacy obligation. Operators are responsible for their Cloudflare settings, any modifications,
applicable jurisdictions and any required privacy information about their processing of personal data.
UK GDPR duties, where applicable, are separate from the cookie consent exception.

## Check a deployment

1. Open a shared link in a new private browser window with JavaScript enabled.
   **Done when:** the introduction appears inside the footer and no cookie strip appears above the page.
2. Reload without clicking Close. **Done when:** the introduction is absent and **Cookies & privacy**
   still opens the full explanation without signing in or accepting anything.
3. Inspect cookies in the browser's developer tools: **Application → Storage → Cookies** in Chrome/Edge,
   **Storage → Cookies** in Firefox, or **Storage → Cookies** in Safari's Web Inspector.
   **Done when:** no new `__Host-wishlist-guest` cookie is present.
4. Click **I’ll get this** on a disposable test gift. **Done when:** it says **You’re getting this**
   immediately and no reservation cookie has been created.
5. Open that same link in another browser with cookies blocked. **Done when:** the test gift still
   says **You’re getting this** and offers **Mark as bought** and **Leave for someone else**.
6. Release the test gift using **Leave for someone else**. **Done when:** it becomes available again
   in both browsers after refreshing.
7. Review cookies after family sign-in and any Cloudflare security challenge.
   **Done when:** each observed cookie's purpose and duration agree with the notice and the configured
   [Access cookies](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)
   or [Cloudflare security cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/).
8. Review any scripts or integrations added outside this repository, including Cloudflare dashboard
   features and external picture hosts. **Done when:** the notice accurately describes the first-party
   required cookies and external picture requests. If it does not, stop adding
   the non-essential storage or implement the applicable information/consent controls before enabling it.

Changes to tracking, cookie purposes or lifetimes require a fresh review. Do not assume a generic
banner makes an installation compliant.

## Direct product pictures

Product pictures on private and shared lists, including previews, load directly from public HTTPS
image hosts. Family Wishlist sends no wishlist referrer, sharing code or Access credentials to them.
The image host receives the visitor's request and IP address, and may receive or set its own cookies
where the browser permits them. The host's privacy and cookie policies apply. The site-wide notice
explains this separately from Family Wishlist's required first-party cookies; do not describe all
third-party picture requests as cookie-free.
