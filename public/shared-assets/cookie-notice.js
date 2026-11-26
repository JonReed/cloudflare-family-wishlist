/* global Element, MutationObserver, ResizeObserver, document, localStorage, window */

const seenKey = 'wishlist-cookie-notice-seen';
const initialized = new Set();
const spacing = document.createElement('style');
spacing.nonce = document.currentScript?.nonce ?? '';
document.head.appendChild(spacing);

// Reserve the bar's actual height so the last form controls and footer links can
// scroll above it, including after text wraps on a narrow screen.
function updateNoticeSpace() {
  const notice = document.querySelector('[data-cookie-notice]:not([hidden])');
  const height = Math.ceil(notice?.getBoundingClientRect().height ?? 0);
  spacing.textContent = `:root { --cookie-notice-height: ${height}px; }`;
}

const resizeObserver =
  typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateNoticeSpace);
window.addEventListener('resize', updateNoticeSpace);

function updateNotices() {
  for (const notice of initialized) {
    if (!notice.isConnected) {
      resizeObserver?.unobserve(notice);
      initialized.delete(notice);
    }
  }
  for (const notice of document.querySelectorAll('[data-cookie-notice]')) {
    if (initialized.has(notice)) continue;
    initialized.add(notice);
    resizeObserver?.observe(notice);

    try {
      if (localStorage.getItem(seenKey) === '1') continue;
      // Remember showing the information, without asking for acceptance or a click.
      localStorage.setItem(seenKey, '1');
      notice.hidden = false;
    } catch {
      // If storage is unavailable, keep the permanent footer link instead
      // of showing an introduction that cannot be remembered.
    }
  }
  updateNoticeSpace();
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const close = event.target.closest('[data-dismiss-cookie-notice]');
  if (close) {
    const notice = close.closest('[data-cookie-notice]');
    if (notice) {
      notice.hidden = true;
      updateNoticeSpace();
      document.querySelector('[data-privacy-link]')?.focus({ preventScroll: true });
    }
  }
});

new MutationObserver(updateNotices).observe(document.body, { childList: true, subtree: true });
updateNotices();
