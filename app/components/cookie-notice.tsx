export function CookieNotice() {
  return (
    <aside className="cookie-notice" aria-label="Cookies">
      <details>
        <summary>
          Required cookies only <span>— how we use them</span>
        </summary>
        <div id="cookie-information" className="cookie-information" tabIndex={-1}>
          <p>
            We use cookies to keep family sign-in secure and let guests manage their reserved gifts.
            Family Wishlist does not use advertising or analytics cookies.
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
    </aside>
  );
}
