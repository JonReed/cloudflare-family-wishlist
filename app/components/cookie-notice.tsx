import { COOKIE_PRIVACY_PATH } from '../lib/public-share-path';

export function CookieBanner() {
  return (
    <footer className="cookie-notice" aria-label="Cookie information" data-cookie-notice hidden>
      <p>
        We use required cookies for family sign-in. Product pictures load from other websites.{' '}
        <a href={COOKIE_PRIVACY_PATH} referrerPolicy="no-referrer">
          Read about cookies and privacy
        </a>
        .
      </p>
      <button type="button" data-dismiss-cookie-notice aria-label="Close cookie information">
        Close
      </button>
    </footer>
  );
}
