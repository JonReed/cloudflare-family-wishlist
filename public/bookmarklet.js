/* global document */

for (const link of document.querySelectorAll('[data-bookmarklet-href]')) {
  const bookmarkletHref = link.getAttribute('data-bookmarklet-href');

  if (bookmarkletHref?.startsWith('javascript:')) {
    link.setAttribute('href', bookmarkletHref);
  }

  link.addEventListener('click', (event) => {
    event.preventDefault();
    const helpId = link.getAttribute('data-bookmarklet-click-help');
    if (!helpId) return;

    const help = document.getElementById(helpId);
    if (help) help.hidden = false;
  });
}
