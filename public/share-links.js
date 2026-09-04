/* global document, Element, HTMLButtonElement, HTMLDetailsElement, HTMLInputElement, navigator */

(() => {
  const closePanel = (panel) => {
    if (panel instanceof HTMLDetailsElement) panel.open = false;
  };

  // Delegation also covers panels and results inserted by client-side navigation or fetchers.
  document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;
    const closeLink = event.target.closest('[data-close-share-panel]');
    if (closeLink) {
      event.preventDefault();
      const panel = closeLink.closest('[data-share-panel]');
      closePanel(panel);
      panel?.querySelector('summary')?.focus();
      return;
    }

    for (const panel of document.querySelectorAll('[data-share-panel]')) {
      if (panel instanceof HTMLDetailsElement && panel.open && !panel.contains(event.target)) {
        closePanel(panel);
      }
    }

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

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    for (const panel of document.querySelectorAll('[data-share-panel]')) {
      if (panel instanceof HTMLDetailsElement && panel.open) {
        closePanel(panel);
        panel.querySelector('summary')?.focus();
      }
    }
  });
})();
