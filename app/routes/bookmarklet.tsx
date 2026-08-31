import { Brand, GiftIcon } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import { createBookmarkletHref } from '../lib/bookmarklet';
import { cloudflareContext, identityContext } from '../lib/context';
import { ensureMemberForEmail } from '../lib/db/members';

import type { Route } from './+types/bookmarklet';
import bookmarkletStylesheet from '../styles/bookmarklet.css?url';

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: bookmarkletStylesheet }
];

export function meta() {
  return [
    { title: 'Browser button · Family Wishlist' },
    {
      name: 'description',
      content: 'Add the Family Wishlist button to your browser and save wishes while shopping.'
    }
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);

  return { bookmarkletHref: createBookmarkletHref(request.url), member };
}

export default function BookmarkletSetup({ loaderData }: Route.ComponentProps) {
  return (
    <div className="site-shell">
      <header className="site-header page-wrap">
        <a href="/" className="brand-link" aria-label="Family Wishlist home">
          <Brand />
        </a>

        <div className="account-links">
          <a href="/">Wishlists</a>
          {loaderData.member.role === 'admin' ? <a href="/family">Your family</a> : null}
          <a href="/profile">Profile</a>
          <a href="/cdn-cgi/access/logout">Sign out</a>
        </div>
      </header>

      <main className="bookmarklet-main page-wrap">
        <article className="bookmarklet-sheet" aria-labelledby="bookmarklet-title">
          <div className="bookmarklet-heading">
            <p className="bookmarklet-kicker">The browser button</p>
            <h1 id="bookmarklet-title">Save a wish from any shop</h1>
            <p>
              Add this little button to your browser once. Then, whenever you find something lovely
              online, it can carry the link straight to your family wishlists.
            </p>
          </div>

          <div className="bookmarklet-steps">
            <section className="bookmarklet-step" aria-labelledby="show-bar-title">
              <span className="bookmarklet-step-number" aria-hidden="true">
                1
              </span>
              <div>
                <h2 id="show-bar-title">Show your bookmarks bar</h2>
                <p>
                  On a Mac, open your browser’s <strong>View</strong> menu and choose{' '}
                  <strong>Show Bookmarks Bar</strong> or <strong>Show Favourites Bar</strong>. The
                  wording varies a little by browser.
                </p>
              </div>
            </section>

            <section className="bookmarklet-step" aria-labelledby="drag-button-title">
              <span className="bookmarklet-step-number" aria-hidden="true">
                2
              </span>
              <div>
                <h2 id="drag-button-title">Drag the button upwards</h2>
                <p>
                  Press and hold the green button below, then drag it into the bookmarks bar at the
                  very top of your real browser window.
                </p>
              </div>
            </section>
          </div>

          <section className="bookmarklet-demo" aria-label="Where to drag the browser button">
            <div className="bookmarklet-browser-example" aria-hidden="true">
              <div className="bookmarklet-browser-toolbar">
                <span />
                <span />
                <span />
                <div className="bookmarklet-address">family wishlist</div>
              </div>
              <div className="bookmarklet-target-bar">
                <span>Bookmarks bar</span>
                <strong>Drop the button here</strong>
              </div>
            </div>

            <div className="bookmarklet-drag-stage">
              <svg
                className="bookmarklet-drag-arrow"
                viewBox="0 0 360 235"
                aria-hidden="true"
                fill="none"
              >
                <path d="M112 208C104 142 118 106 166 87C208 70 248 78 267 39" />
                <path d="m238 50 31-16 5 34" />
              </svg>
              <span className="bookmarklet-drag-label" aria-hidden="true">
                Drag this way
              </span>
              <a
                href="#bookmarklet-click-help"
                data-bookmarklet-href={loaderData.bookmarkletHref}
                data-bookmarklet-click-help="bookmarklet-click-help"
                className="bookmarklet-button"
                title="Drag this to your bookmarks bar"
              >
                <GiftIcon className="size-5" />
                <span>Add to Family Wishlist</span>
              </a>
              <p
                id="bookmarklet-click-help"
                className="bookmarklet-click-help"
                role="status"
                hidden
              >
                Nearly! Press and hold the button, then drag it upwards instead of clicking it.
              </p>
            </div>
          </section>

          <section className="bookmarklet-finish" aria-labelledby="use-button-title">
            <span className="bookmarklet-step-number" aria-hidden="true">
              3
            </span>
            <div>
              <h2 id="use-button-title">Try it on something you like</h2>
              <p>
                Visit a product page and click your new <strong>Add to Family Wishlist</strong>{' '}
                bookmark. A new tab will open so you can check the details and choose one or more
                family lists.
              </p>
            </div>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
