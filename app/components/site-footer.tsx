function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.88c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.56 4.94.36.31.68.92.68 1.86V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

const repositoryUrl = 'https://github.com/JonReed/cloudflare-family-wishlist';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span aria-hidden="true" className="footer-tape footer-tape-left" />
      <span aria-hidden="true" className="footer-tape footer-tape-right" />

      <div className="site-footer-inner">
        <div>
          <a className="footer-repo" href={repositoryUrl} target="_blank" rel="noreferrer">
            <GitHubIcon />
            <span>cloudflare-family-wishlist</span>
          </a>
          <p className="footer-note">
            A small, open-source family project. Self-host it, change it, make it yours.
          </p>
        </div>

        <nav aria-label="Project links" className="footer-links">
          <a href={`${repositoryUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            MIT licence
          </a>
          <a href={`${repositoryUrl}/issues`} target="_blank" rel="noreferrer">
            Report an issue
          </a>
          <a href={`${repositoryUrl}#readme`} target="_blank" rel="noreferrer">
            Set up your own
          </a>
        </nav>

        <p className="footer-meta">v0.1.0 · Built to run on Cloudflare</p>
      </div>
    </footer>
  );
}
