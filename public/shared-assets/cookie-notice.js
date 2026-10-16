/* global Element, MutationObserver, document, localStorage, location, window */

const seenKey = 'wishlist-cookie-notice-seen';
const initialized = new WeakSet();

function openCookieDetails() {
  const details = document.getElementById('cookie-information')?.closest('details');
  if (details) details.open = true;
}

function updateNotices() {
  for (const notice of document.querySelectorAll('[data-cookie-notice]')) {
    if (initialized.has(notice)) continue;
    initialized.add(notice);
    if (location.hash === '#cookie-information') openCookieDetails();

    try {
      if (localStorage.getItem(seenKey) === '1') continue;
      // Remember showing the information, without asking for acceptance or a click.
      localStorage.setItem(seenKey, '1');
      notice.hidden = false;
    } catch {
      // If storage is unavailable, keep the permanent footer disclosure instead
      // of showing an introduction that cannot be remembered.
    }
  }
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const close = event.target.closest('[data-dismiss-cookie-notice]');
  if (close) {
    const notice = close.closest('[data-cookie-notice]');
    if (notice) {
      notice.hidden = true;
      notice.parentElement?.querySelector('summary')?.focus();
    }
  }
  if (event.target.closest('a[href="#cookie-information"]')) openCookieDetails();
});

window.addEventListener('hashchange', () => {
  if (location.hash === '#cookie-information') openCookieDetails();
});
new MutationObserver(updateNotices).observe(document.body, { childList: true, subtree: true });
updateNotices();
