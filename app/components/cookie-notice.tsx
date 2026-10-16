export function CookieNotice() {
  return (
    <div className="footer-privacy">
      <aside className="cookie-notice" aria-label="Cookie information" data-cookie-notice hidden>
        <p>
          We use required cookies for sign-in and guest reservations. Product pictures load from
          other websites. <a href="#cookie-information">Read about cookies and privacy</a>.
        </p>
        <button type="button" data-dismiss-cookie-notice aria-label="Close cookie information">
          Close
        </button>
      </aside>
      <details className="cookie-details">
        <summary>Cookies &amp; privacy</summary>
        <div id="cookie-information" className="cookie-information" tabIndex={-1}>
          <p>
            We use only required cookies to keep family sign-in secure and let guests manage their
            reserved gifts. Family Wishlist does not use advertising or analytics cookies.
          </p>
          <h2>Product pictures</h2>
          <p>
            Product pictures load directly from shops or other picture hosts. Those hosts receive
            your picture request, including your IP address, and may use their own cookies if your
            browser allows them. We do not send them this wishlist’s address, sharing code or
            sign-in details. Their own privacy and cookie policies apply.
          </p>
          <h2>Guest reservations</h2>
          <p>
            When you start reserving a gift or recover your reservations, this site saves a private
            code in a cookie called <code>__Host-wishlist-guest</code>. It identifies your
            reservations without asking for your name or email. It lasts for up to one year from
            your last reservation action or recovery, so you can return for birthdays and other
            occasions. Simply viewing a shared list does not create or renew this cookie.
          </p>
          <h2>Family sign-in and security</h2>
          <p>
            Cloudflare Access uses <code>CF_Authorization</code> to keep you signed in. Family
            Wishlist’s standard sign-in session is 30 days; the organiser’s Cloudflare settings
            determine the actual duration. Access also uses <code>CF_Session</code> (4 hours) and{' '}
            <code>CF_AppSession</code> (24 hours) to protect sign-in requests, and{' '}
            <code>CF_Device</code> (30 days) to prevent sign-in abuse. If enabled,{' '}
            <code>CF_Binding</code> protects your sign-in cookie for the session.
          </p>
          <p>
            Cloudflare may also set security cookies when checking requests, depending on this
            installation’s protection settings. See{' '}
            <a
              href="https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/"
              target="_blank"
              rel="noreferrer"
            >
              Cloudflare’s sign-in cookie details
            </a>{' '}
            and{' '}
            <a
              href="https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/"
              target="_blank"
              rel="noreferrer"
            >
              security cookie details
            </a>{' '}
            for their purposes and lifetimes.
          </p>
          <h2>Your browser controls</h2>
          <p>
            We remember that this browser has been shown the footer notice using a local preference
            called <code>wishlist-cookie-notice-seen</code>. It contains only the value 1, stays in
            this browser and is not sent to the server. Clearing site data lets the notice appear
            again. You can reopen these details at any time.
          </p>
          <p>
            You can block or delete cookies in your browser settings. Blocking required cookies
            prevents sign-in or managing guest reservations. Before clearing them, save your code
            under “Keep or recover your reservations” on a shared list. Deleting a cookie does not
            cancel a reservation: use “Leave for someone else” to release a gift.
          </p>
          <p>
            This wishlist is run by the household that shared it with you. Contact the family
            organiser with questions about this installation or your saved information.
          </p>
        </div>
      </details>
    </div>
  );
}
