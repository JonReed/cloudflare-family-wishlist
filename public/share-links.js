/* global document, Element, HTMLAnchorElement, HTMLButtonElement, HTMLInputElement, navigator */

(() => {
  // Delegation also covers results inserted by client-side navigation or fetchers.
  document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-copy-share-link]');
    if (!(button instanceof HTMLButtonElement)) return;
    const source = button.parentElement?.querySelector('[data-share-link]');
    const status = button.parentElement?.parentElement?.querySelector('[role="status"]');
    const address =
      source instanceof HTMLInputElement
        ? source.value
        : source instanceof HTMLAnchorElement
          ? source.href
          : null;
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      button.textContent = 'Link copied';
      if (status) status.textContent = 'Ready to paste into a message.';
    } catch {
      source.focus();
      if (source instanceof HTMLInputElement) source.select();
      if (status)
        status.textContent =
          source instanceof HTMLInputElement
            ? 'Copy the selected address.'
            : 'Open the link above to copy its address.';
    }
  });
})();
