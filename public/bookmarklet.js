/* global document, navigator, URL, window */

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

for (const button of document.querySelectorAll('[data-copy-shortcut-prefix]')) {
  if (!navigator.clipboard?.writeText) continue;

  button.hidden = false;
  button.addEventListener('click', async () => {
    const prefix = button.getAttribute('data-shortcut-prefix');
    const status = document.querySelector('[data-shortcut-copy-status]');
    if (!prefix || !status) return;

    try {
      await navigator.clipboard.writeText(prefix);
      status.textContent = 'Copied — paste it at the start of the URL action.';
    } catch {
      status.textContent =
        'Your browser would not copy it. Press and hold the address below instead.';
    }
  });
}

for (const button of document.querySelectorAll('[data-paste-product-link]')) {
  if (!navigator.clipboard?.readText) continue;

  button.hidden = false;
  button.addEventListener('click', async () => {
    const addPageHref = button.getAttribute('data-add-page-href');
    const status = document.querySelector('[data-paste-product-status]');
    if (!addPageHref || !status) return;

    try {
      const productUrl = new URL((await navigator.clipboard.readText()).trim());
      if (
        (productUrl.protocol !== 'https:' && productUrl.protocol !== 'http:') ||
        productUrl.username ||
        productUrl.password
      ) {
        throw new TypeError('Not a public product link');
      }

      const destination = new URL(addPageHref);
      destination.searchParams.set('url', productUrl.toString());
      window.location.assign(destination.toString());
    } catch {
      status.textContent = 'Copy a complete http or https product link, then try again.';
    }
  });
}
