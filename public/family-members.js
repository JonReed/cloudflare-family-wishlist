/* global document, HTMLButtonElement, navigator */

(() => {
  const buttons = document.querySelectorAll('[data-copy-family-invitation]');

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      if (!(button instanceof HTMLButtonElement)) return;

      const invitationUrl = button.dataset.invitationUrl;
      const invitationEmail = button.dataset.invitationEmail;
      const status = button.parentElement?.querySelector('[role="status"]');

      if (!invitationUrl || !invitationEmail) return;

      const message = [
        'You’re invited to our Family Wishlist.',
        '',
        `Open ${invitationUrl}`,
        `Sign in with ${invitationEmail}. You’ll get a one-time code by email.`
      ].join('\n');

      try {
        await navigator.clipboard.writeText(message);
        button.textContent = 'Invitation copied';
        if (status) status.textContent = 'Ready to paste into a message.';
      } catch {
        if (status) status.textContent = `Copy this address instead: ${invitationUrl}`;
      }
    });
  }
})();
