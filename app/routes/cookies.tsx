import { Brand } from '../components/brand';
import { SiteFooter } from '../components/site-footer';

export function meta() {
  return [{ title: 'Cookies & privacy · Family Wishlist' }];
}

export default function CookiesPage() {
  return (
    <div className="site-shell">
      <header className="public-share-header page-wrap">
        <span className="brand-link">
          <Brand />
        </span>
      </header>
      <main className="public-share-main page-wrap">
        <article className="wishlist-sheet public-share-sheet cookie-information">
          <span className="paper-tape paper-tape-left" aria-hidden="true" />
          <header className="wishlist-heading">
            <h1>Cookies &amp; privacy</h1>
          </header>
          <p>
            We use only required cookies to keep family sign-in secure. Family Wishlist does not use
            advertising or analytics cookies.
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
            Reservations belong to the named sharing link. Anyone using that link can see and manage
            its reservations from any device. Returning to the same link brings back its
            reservations, even if you clear cookies. If the family organiser assigns a reservation
            to the family member buying the gift, the link then shows the gift as reserved and that
            member manages it from their account.
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
            again. You can return to this page from the footer at any time.
          </p>
          <p>
            You can block or delete cookies in your browser settings. Blocking required cookies
            prevents family sign-in. Shared-link reservations work without cookies. Use “Leave for
            someone else” to release a gift.
          </p>
          <p>
            This wishlist is run by the household that shared it with you. Contact the family
            organiser with questions about this installation or your saved information.
          </p>
        </article>
      </main>
      <SiteFooter privacyPage />
    </div>
  );
}
