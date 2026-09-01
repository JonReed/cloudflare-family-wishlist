/* global document, HTMLButtonElement, HTMLDetailsElement, HTMLInputElement, navigator */

(() => {
  const panels = document.querySelectorAll('[data-share-panel]');
  const buttons = document.querySelectorAll('[data-copy-share-link]');

  const closePanel = (panel) => {
    if (panel instanceof HTMLDetailsElement) panel.open = false;
  };

  for (const panel of panels) {
    const closeLink = panel.querySelector('[data-close-share-panel]');

    closeLink?.addEventListener('click', (event) => {
      event.preventDefault();
      closePanel(panel);
      panel.querySelector('summary')?.focus();
    });
  }

  document.addEventListener('click', (event) => {
    for (const panel of panels) {
      if (panel instanceof HTMLDetailsElement && panel.open && !panel.contains(event.target)) {
        closePanel(panel);
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    for (const panel of panels) {
      if (panel instanceof HTMLDetailsElement && panel.open) {
        closePanel(panel);
        panel.querySelector('summary')?.focus();
      }
    }
  });

  for (const button of buttons) {
    button.addEventListener('click', async () => {
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
  }
})();
