/* global document, HTMLButtonElement, HTMLInputElement, navigator */

(() => {
  const buttons = document.querySelectorAll('[data-copy-share-link]');

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
