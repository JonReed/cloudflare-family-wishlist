import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class CopyElement {
  constructor(readonly button: CopyButton | null = null) {}

  closest() {
    return this.button;
  }
}

class CopyButton extends CopyElement {
  disabled = false;
  textContent = 'Copy sign-in details';
  readonly status = { textContent: '' };
  readonly parentElement = { querySelector: () => this.status };

  constructor(readonly dataset: { invitationUrl?: string; invitationEmail?: string }) {
    super();
  }

  closest() {
    return this;
  }
}

let clickHandler: ((event: { target: unknown }) => Promise<void>) | undefined;
const writeText = vi.fn<(text: string) => Promise<void>>();

async function loadHelper(clipboardAvailable = true) {
  vi.stubGlobal('Element', CopyElement);
  vi.stubGlobal('HTMLButtonElement', CopyButton);
  vi.stubGlobal('navigator', clipboardAvailable ? { clipboard: { writeText } } : {});
  vi.stubGlobal('document', {
    // No waiting rows exist when the helper first loads.
    querySelectorAll: () => [],
    addEventListener: (_type: string, handler: typeof clickHandler) => {
      clickHandler = handler;
    }
  });
  const helperPath = '../public/family-members.js';
  await import(/* @vite-ignore */ helperPath);
}

async function click(target: unknown) {
  await clickHandler?.({ target });
}

function newWaitingRow(email = 'jamie@example.com') {
  return new CopyButton({
    invitationUrl: 'https://wishlist.example/',
    invitationEmail: email
  });
}

describe('family sign-in details helper', () => {
  beforeEach(() => {
    vi.resetModules();
    writeText.mockReset().mockResolvedValue();
    clickHandler = undefined;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('copies a waiting row added after the helper loads, without refreshing', async () => {
    await loadHelper();
    const button = newWaitingRow();
    await click(button);

    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      'Our Family Wishlist is ready for you.\n\nOpen https://wishlist.example/\n' +
        'Sign in with jamie@example.com. You’ll get a one-time code by email.'
    );
    expect(button.textContent).toBe('Details copied');
    expect(button.status.textContent).toBe('Ready to paste into a message.');
  });

  it('handles nested click targets and uses each new row’s current email', async () => {
    await loadHelper();
    const first = newWaitingRow();
    const second = newWaitingRow('alex@example.com');
    await click(new CopyElement(first));
    await click(new CopyElement(second));
    expect(writeText.mock.calls[0]?.[0]).toContain('Sign in with jamie@example.com.');
    expect(writeText.mock.calls[1]?.[0]).toContain('Sign in with alex@example.com.');
    expect(first.status.textContent).toBe('Ready to paste into a message.');
    expect(second.status.textContent).toBe('Ready to paste into a message.');
  });

  it.each([true, false])(
    'shows the homepage and email for manual copying when clipboard access fails (API present: %s)',
    async (clipboardAvailable) => {
      writeText.mockRejectedValue(new Error('Clipboard blocked'));
      await loadHelper(clipboardAvailable);
      const button = newWaitingRow();
      await click(button);
      expect(button.status.textContent).toBe(
        'Copy these details: https://wishlist.example/ — sign in with jamie@example.com.'
      );
      expect(button.textContent).toBe('Copy sign-in details');
    }
  );

  it('ignores unrelated clicks, disabled buttons and incomplete details', async () => {
    await loadHelper();
    const disabled = newWaitingRow();
    disabled.disabled = true;
    for (const target of [
      null,
      new CopyElement(),
      disabled,
      new CopyButton({ invitationUrl: 'https://wishlist.example/' }),
      new CopyButton({ invitationEmail: 'jamie@example.com' })
    ]) {
      await click(target);
    }
    expect(writeText).not.toHaveBeenCalled();
  });
});
