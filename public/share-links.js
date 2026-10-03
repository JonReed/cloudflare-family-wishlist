/* global document, Element, HTMLButtonElement, HTMLInputElement, navigator */

(() => {
  // Delegation also covers results inserted by client-side navigation or fetchers.
  document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-copy-share-link]');
    if (!(button instanceof HTMLButtonElement)) return;
    const input = button.parentElement?.querySelector('[data-share-link]');
    const status = button.parentElement?.parentElement?.querySelector('[role="status"]');
    if (!(input instanceof HTMLInputElement)) return;

    try {
      await navigator.clipboard.writeText(input.value);
      button.textContent = 'Link copied';
      if (status) status.textContent = 'Ready to paste into a message.';
    } catch {
      input.focus();
      input.select();
      if (status) status.textContent = 'Copy the selected address.';
    }
  });
})();
