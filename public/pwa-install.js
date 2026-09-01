/* global document, HTMLButtonElement, HTMLElement, navigator, window */

const installButton = document.querySelector('[data-install-family-wishlist]');
const installStatus = document.querySelector('[data-install-family-wishlist-status]');
let installPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {
      // Installation is optional; ordinary authenticated browser use still works.
    });
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  if (installButton instanceof HTMLButtonElement) installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if (installButton instanceof HTMLButtonElement) installButton.hidden = true;
  if (installStatus instanceof HTMLElement) {
    installStatus.textContent =
      'Installed. Family Wishlist will now appear when Android shares a web link.';
  }
});

if (installButton instanceof HTMLButtonElement) {
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;

    installButton.disabled = true;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome !== 'accepted') installButton.disabled = false;
    } catch {
      installButton.disabled = false;
      if (installStatus instanceof HTMLElement) {
        installStatus.textContent =
          'Use Chrome’s menu and choose Install app or Add to Home screen instead.';
      }
    }
  });
}
