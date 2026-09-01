import { Brand, GiftIcon } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import { createAddPageHref, createBookmarkletHref } from '../lib/bookmarklet';
import { cloudflareContext, identityContext } from '../lib/context';
import { ensureMemberForEmail } from '../lib/db/members';

import type { Route } from './+types/bookmarklet';
import bookmarkletStylesheet from '../styles/bookmarklet.css?url';

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: bookmarkletStylesheet }
];

export function meta() {
  return [
    { title: 'Add from anywhere · Family Wishlist' },
    {
      name: 'description',
      content: 'Set up Family Wishlist on iPhone, iPad or a desktop browser.'
    }
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);

  return {
    addPageHref: createAddPageHref(request.url),
    bookmarkletHref: createBookmarkletHref(request.url),
    member
  };
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
          <a href="/bookmarklet" aria-current="page">
            Add from anywhere
          </a>
          {loaderData.member.role === 'admin' ? <a href="/family">Your family</a> : null}
          <a href="/profile">Profile</a>
          <a href="/cdn-cgi/access/logout">Sign out</a>
        </div>
      </header>

      <main className="bookmarklet-main page-wrap">
        <article className="bookmarklet-sheet" aria-labelledby="bookmarklet-title">
          <div className="bookmarklet-heading">
            <p className="bookmarklet-kicker">One quick route back</p>
            <h1 id="bookmarklet-title">Add from anywhere</h1>
            <p>
              Send a product link straight into an editable Family Wishlist draft. Check what we
              found, choose the right lists, and only then save it.
            </p>
          </div>

          <section className="android-share-setup" aria-labelledby="android-share-title">
            <div className="setup-section-heading">
              <p className="bookmarklet-kicker">Android</p>
              <h2 id="android-share-title">Add it to your Share menu</h2>
              <p>
                Install Family Wishlist once, then send a product here from Chrome or any shopping
                app that shares web links. You will always get an editable draft before anything is
                saved.
              </p>
            </div>

            <div className="android-install-actions">
              <button type="button" className="button-primary" data-install-family-wishlist hidden>
                Install Family Wishlist
              </button>
              <span
                className="android-install-status"
                data-install-family-wishlist-status
                role="status"
                aria-live="polite"
              />
            </div>

            <ol className="shortcut-steps android-share-steps">
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  1
                </span>
                <div>
                  <h3>Install the app</h3>
                  <p>
                    Tap <strong>Install Family Wishlist</strong> above when it appears. Otherwise,
                    open Chrome’s menu and choose <strong>Install app</strong> or{' '}
                    <strong>Add to Home screen</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  2
                </span>
                <div>
                  <h3>Share a product</h3>
                  <p>
                    In Chrome or a shopping app, open a product, tap <strong>Share</strong>, then
                    choose <strong>Family Wishlist</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  3
                </span>
                <div>
                  <h3>Check the draft</h3>
                  <p>
                    Confirm the product details, choose one or more family lists, then save when
                    everything looks right.
                  </p>
                </div>
              </li>
            </ol>

            <div className="shortcut-use-note">
              Family Wishlist must stay signed in and online while opening a shared link. For
              privacy, the installed app never stores family pages for offline use.
            </div>
          </section>

          <section className="shortcut-setup" aria-labelledby="shortcut-title">
            <div className="setup-section-heading">
              <p className="bookmarklet-kicker">iPhone &amp; iPad</p>
              <h2 id="shortcut-title">Put it in your Share Sheet</h2>
              <p>
                Make a small Apple Shortcut once. Afterwards, share a product from Safari or a
                shopping app and tap <strong>Add to Family Wishlist</strong>.
              </p>
            </div>

            <div className="shortcut-actions">
              <a href="shortcuts://create-shortcut" className="button-primary">
                Open a new Shortcut
              </a>
              <button
                type="button"
                className="button-quiet"
                data-copy-shortcut-prefix
                data-shortcut-prefix={`${loaderData.addPageHref}?url=`}
                hidden
              >
                Copy your wishlist address
              </button>
              <span
                className="shortcut-copy-status"
                data-shortcut-copy-status
                role="status"
                aria-live="polite"
              />
            </div>

            <div className="shortcut-address-wrap">
              <span>URL action</span>
              <code className="shortcut-address">
                {loaderData.addPageHref}?url=<strong>[URL Encoded]</strong>
              </code>
            </div>

            <ol className="shortcut-steps">
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  1
                </span>
                <div>
                  <h3>Name it</h3>
                  <p>
                    Call the new shortcut <strong>Add to Family Wishlist</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  2
                </span>
                <div>
                  <h3>Show it when sharing</h3>
                  <p>
                    Open the shortcut’s details, turn on <strong>Show in Share Sheet</strong>, and
                    let it receive only <strong>URLs</strong> and <strong>Safari Web Pages</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  3
                </span>
                <div>
                  <h3>Prepare the product link</h3>
                  <p>
                    Add <strong>Get URLs from Input</strong>, then add <strong>URL Encode</strong>{' '}
                    for the URLs it found.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  4
                </span>
                <div>
                  <h3>Open Family Wishlist</h3>
                  <p>
                    Add a <strong>URL</strong> action. Paste the wishlist address copied above, then
                    insert the <strong>URL Encoded</strong> result immediately after it. Finish with
                    an <strong>Open URLs</strong> action.
                  </p>
                </div>
              </li>
            </ol>

            <div className="shortcut-use-note">
              <strong>To use it:</strong> open a product, tap Share, then choose Add to Family
              Wishlist. If it is hidden, scroll to the bottom of the Share Sheet and tap Edit
              Actions.
            </div>

            <div className="clipboard-fallback">
              <div>
                <h3>Already copied a link?</h3>
                <p>Open a draft from your clipboard, or paste the link here yourself.</p>
              </div>
              <div className="clipboard-actions">
                <button
                  type="button"
                  className="button-secondary"
                  data-paste-product-link
                  data-add-page-href={loaderData.addPageHref}
                  hidden
                >
                  Use copied link
                </button>
              </div>
              <form action="/add" method="get" className="clipboard-form">
                <label htmlFor="setup-product-url" className="sr-only">
                  Product link
                </label>
                <input
                  id="setup-product-url"
                  name="url"
                  type="url"
                  required
                  maxLength={2048}
                  className="form-control"
                  placeholder="https://shop.example/product"
                />
                <button type="submit" className="button-quiet">
                  Open draft
                </button>
              </form>
              <p
                className="clipboard-status"
                data-paste-product-status
                role="status"
                aria-live="polite"
              />
            </div>
          </section>

          <section className="browser-button-setup" aria-labelledby="browser-button-title">
            <div className="setup-section-heading">
              <p className="bookmarklet-kicker">Laptop &amp; desktop</p>
              <h2 id="browser-button-title">Add the browser button</h2>
              <p>Drag the button into your bookmarks bar once, then use it on any product page.</p>
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
                    Press and hold the green button below, then drag it into the bookmarks bar at
                    the very top of your real browser window.
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
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
