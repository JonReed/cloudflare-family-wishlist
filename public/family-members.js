/* global document, Element, HTMLButtonElement, navigator */

(() => {
  // Family rows can arrive after an enhanced add or client-side navigation.
  document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-copy-family-invitation]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const invitationUrl = button.dataset.invitationUrl;
    const invitationEmail = button.dataset.invitationEmail;
    const status = button.parentElement?.querySelector('[role="status"]');

    if (!invitationUrl || !invitationEmail) return;

    const message = [
      'Our Family Wishlist is ready for you.',
      '',
      `Open ${invitationUrl}`,
      `Sign in with ${invitationEmail}. You’ll get a one-time code by email.`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(message);
      button.textContent = 'Details copied';
      if (status) status.textContent = 'Ready to paste into a message.';
    } catch {
      if (status)
        status.textContent = `Copy these details: ${invitationUrl} — sign in with ${invitationEmail}.`;
    }
  });
})();
