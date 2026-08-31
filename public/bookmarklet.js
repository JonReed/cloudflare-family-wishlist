/* global document */

for (const link of document.querySelectorAll('[data-bookmarklet-href]')) {
  const bookmarkletHref = link.getAttribute('data-bookmarklet-href');

  if (bookmarkletHref?.startsWith('javascript:')) {
    link.setAttribute('href', bookmarkletHref);
  }
}
