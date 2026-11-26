import { version } from '../../package.json';
import { COOKIE_PRIVACY_PATH } from '../lib/public-share-path';
import { CookieBanner } from './cookie-notice';

const projectUrl = 'https://familywishlist.org/';
const repositoryUrl = 'https://github.com/JonReed/cloudflare-family-wishlist';

export function SiteFooter({ privacyPage = false }: { privacyPage?: boolean } = {}) {
  return (
    <>
      <footer className="site-footer">
        <span aria-hidden="true" className="footer-tape footer-tape-left" />
        <span aria-hidden="true" className="footer-tape footer-tape-right" />

        <div className="site-footer-inner">
          <div>
            <a className="footer-project" href={projectUrl} target="_blank" rel="noreferrer">
              Family Wishlist
            </a>
            <p className="footer-note">
              A small, open-source family project. Self-host it, change it, make it yours.
            </p>
          </div>

          <nav aria-label="Project links" className="footer-links">
            <a href={repositoryUrl} target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href={`${repositoryUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
              MIT licence
            </a>
            <a href={`${repositoryUrl}/issues`} target="_blank" rel="noreferrer">
              Report an issue
            </a>
            <a href={`${repositoryUrl}#readme`} target="_blank" rel="noreferrer">
              Set up your own
            </a>
            <a
              href={COOKIE_PRIVACY_PATH}
              referrerPolicy="no-referrer"
              aria-current={privacyPage ? 'page' : undefined}
              data-privacy-link
            >
              Cookies &amp; privacy
            </a>
          </nav>

          <p className="footer-meta">v{version} · Built to run on Cloudflare</p>
        </div>
      </footer>
      {privacyPage ? null : <CookieBanner />}
    </>
  );
}
