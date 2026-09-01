import { Brand, GiftIcon } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import { createAddPageHref, createBookmarkletHref } from '../lib/bookmarklet';
import { cloudflareContext, identityContext, organiserEmailForRequest } from '../lib/context';
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
  const member = await ensureMemberForEmail(
    env.DB,
    identity.email,
    organiserEmailForRequest(env, identity.email)
  );

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

          <nav className="device-contents" aria-label="Go straight to your device instructions">
            <p>Go straight to</p>
            <ol>
              <li>
                <a href="#android-instructions">
                  <span aria-hidden="true">01</span>
                  Android phone or tablet
                </a>
              </li>
              <li>
                <a href="#apple-instructions">
                  <span aria-hidden="true">02</span>
                  iPhone or iPad
                </a>
              </li>
              <li>
                <a href="#desktop-instructions">
                  <span aria-hidden="true">03</span>
                  Laptop or desktop
                </a>
              </li>
            </ol>
          </nav>

          <section
            id="android-instructions"
            className="android-share-setup"
            aria-labelledby="android-share-title"
          >
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
                  <h3>Open this page in Chrome</h3>
                  <p>
                    If you are reading this inside another app, open its menu, choose{' '}
                    <strong>Open in Chrome</strong>, and return to the Android instructions on this
                    page.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  2
                </span>
                <div>
                  <h3>Install Family Wishlist</h3>
                  <p>
                    Tap <strong>Install Family Wishlist</strong> above if the button appears, then
                    confirm <strong>Install</strong>. If it does not appear, tap Chrome’s{' '}
                    <strong>⋮</strong> menu, choose <strong>Add to Home screen</strong> or{' '}
                    <strong>Install app</strong>, then confirm.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  3
                </span>
                <div>
                  <h3>Share a product</h3>
                  <p>
                    Open a product in Chrome or a shopping app and tap its <strong>Share</strong>{' '}
                    button. Choose <strong>Family Wishlist</strong> in Android’s Share menu. If it
                    is not visible, tap <strong>More</strong> or scroll through the available apps.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  4
                </span>
                <div>
                  <h3>Check and save the draft</h3>
                  <p>
                    Family Wishlist opens with the product link filled in. Sign in if asked, check
                    the title, image, price and notes, choose one or more family lists, then tap{' '}
                    <strong>Add to wishlists</strong>.
                  </p>
                </div>
              </li>
            </ol>

            <div className="shortcut-use-note">
              Family Wishlist must stay signed in and online while opening a shared link. For
              privacy, the installed app never stores family pages for offline use.
            </div>
          </section>

          <section
            id="apple-instructions"
            className="shortcut-setup"
            aria-labelledby="shortcut-title"
          >
            <div className="setup-section-heading">
              <p className="bookmarklet-kicker">iPhone &amp; iPad</p>
              <h2 id="shortcut-title">Put it in your Share Sheet</h2>
              <p>
                Make a small Apple Shortcut once. Afterwards, share a product from Safari or a
                shopping app and tap <strong>Add to Family Wishlist</strong>.
              </p>
            </div>

            <div className="shortcut-actions">
              <button
                type="button"
                className="button-primary"
                data-copy-shortcut-prefix
                data-shortcut-prefix={`${loaderData.addPageHref}?url=`}
                hidden
              >
                Copy your wishlist address
              </button>
              <a href="shortcuts://create-shortcut" className="button-secondary">
                Open a new Shortcut
              </a>
              <span
                className="shortcut-copy-status"
                data-shortcut-copy-status
                role="status"
                aria-live="polite"
              />
            </div>

            <div className="shortcut-address-wrap">
              <span>The address to copy — including the final =</span>
              <code className="shortcut-address">{loaderData.addPageHref}?url=</code>
            </div>

            <ol className="shortcut-steps">
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  1
                </span>
                <div>
                  <h3>Copy the address and open Shortcuts</h3>
                  <p>
                    Tap <strong>Copy your wishlist address</strong> above. If that button is not
                    shown, press and hold the address in the box and tap <strong>Copy</strong>. Then
                    tap <strong>Open a new Shortcut</strong>. Tap <strong>New Shortcut</strong> at
                    the top, choose <strong>Rename</strong>, and call it{' '}
                    <strong>Add to Family Wishlist</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  2
                </span>
                <div>
                  <h3>Add the first action</h3>
                  <p>
                    Tap <strong>Add Action</strong>, then <strong>Search Actions</strong>. Search
                    for and choose <strong>Get URLs from Input</strong>. Do not choose{' '}
                    <strong>Get Contents of URL</strong>. In the shortcut, the action will read{' '}
                    <strong>Get URLs from Shortcut Input</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  3
                </span>
                <div>
                  <h3>Encode the product link</h3>
                  <p>
                    Tap the <strong>Search Actions</strong> field at the bottom (swipe it upwards if
                    it is tucked away), search for <strong>URL Encode</strong>, and choose that
                    action. It should automatically use the URLs from the first action.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  4
                </span>
                <div>
                  <h3>Build the Family Wishlist address</h3>
                  <p>
                    Search Actions again, search for <strong>URL</strong>, and choose the action
                    named exactly <strong>URL</strong>. Paste the wishlist address copied above into
                    its box. Tap immediately after the final <strong>=</strong>, choose{' '}
                    <strong>Select Variable</strong>, and select <strong>URL Encoded</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  5
                </span>
                <div>
                  <h3>Open the address</h3>
                  <p>
                    Search Actions once more, search for <strong>Open URLs</strong>, and choose that
                    action. Your shortcut should now contain, in order:{' '}
                    <strong>Get URLs from Input</strong>, <strong>URL Encode</strong>,{' '}
                    <strong>URL</strong>, then <strong>Open URLs</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="bookmarklet-step-number" aria-hidden="true">
                  6
                </span>
                <div>
                  <h3>Put it in the Share Sheet</h3>
                  <p>
                    Tap <strong>Add to Family Wishlist</strong> at the top, choose{' '}
                    <strong>Details</strong>, and turn on <strong>Show in Share Sheet</strong>. A{' '}
                    <strong>Receive</strong> row appears. Tap its input types, turn off everything
                    except <strong>URLs</strong> and <strong>Safari Web Pages</strong>, then tap{' '}
                    <strong>Done</strong> twice to save the shortcut.
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
                <h3>Prefer to copy and paste?</h3>
                <p>
                  On the product page, tap <strong>Share</strong>, then <strong>Copy Link</strong>.
                  Return here and tap <strong>Use copied link</strong>. If that button is not shown
                  or clipboard access is refused, press and hold the box below, tap{' '}
                  <strong>Paste</strong>, then tap <strong>Open draft</strong>.
                </p>
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

          <section
            id="desktop-instructions"
            className="browser-button-setup"
            aria-labelledby="browser-button-title"
          >
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
                    In Chrome or Edge, press <strong>⌘ Shift B</strong> on a Mac or{' '}
                    <strong>Ctrl Shift B</strong> on Windows. In Safari, open the{' '}
                    <strong>View</strong> menu and choose <strong>Show Favourites Bar</strong>. In
                    Firefox, choose{' '}
                    <strong>View → Toolbars → Bookmarks Toolbar → Always Show</strong>. A row for
                    bookmarks should now appear below the address bar.
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
                    Move the pointer to the green <strong>Add to Family Wishlist</strong> button
                    below. Press and keep holding your mouse or trackpad, move the button into the
                    real bookmarks bar at the top of the window, then release. Do not simply click
                    it—the browser must see you drag it.
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
                  Open a product page in the same browser, then click the new{' '}
                  <strong>Add to Family Wishlist</strong> bookmark in the bar. A Family Wishlist tab
                  opens with the product link filled in. Sign in if asked, check the product
                  details, choose one or more family lists, then tap{' '}
                  <strong>Add to wishlists</strong>.
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
