/* global AbortController, DOMException, FormData, HTMLButtonElement, HTMLElement, HTMLFormElement, HTMLInputElement, document, fetch, setTimeout */

const forms = document.querySelectorAll('[data-product-import-form]');

for (const form of forms) {
  const urlInput = form.querySelector('[data-product-url]');
  const titleInput = form.querySelector('[data-product-title]');
  const priceInput = form.querySelector('[data-product-price]');
  const fetchButton = form.querySelector('[data-product-fetch]');
  const status = form.querySelector('[data-product-status]');

  if (
    !(form instanceof HTMLFormElement) ||
    !(urlInput instanceof HTMLInputElement) ||
    !(titleInput instanceof HTMLInputElement) ||
    !(priceInput instanceof HTMLInputElement) ||
    !(fetchButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLElement)
  ) {
    continue;
  }

  let activeRequest;
  let lastRequestedUrl = '';
  let generatedTitle = '';
  let generatedPrice = '';

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('product-fetch-error', isError);
  };

  const fillGeneratedField = (input, value, previousValue) => {
    if (value && (!input.value || input.value === previousValue)) input.value = value;
    return value || previousValue;
  };

  const fetchDetails = async (candidate, force = false) => {
    const productUrl = candidate.trim();
    if (!/^https?:\/\//i.test(productUrl)) {
      setStatus(
        'That link doesn’t look right. Use an address beginning with http:// or https://.',
        true
      );
      return;
    }
    if (!force && productUrl === lastRequestedUrl) return;

    lastRequestedUrl = productUrl;
    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;
    fetchButton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setStatus('Looking at that page…');

    try {
      const body = new FormData();
      body.set('productUrl', productUrl);
      const response = await fetch('/product-details', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body,
        signal: controller.signal
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('We couldn’t read that page.');
      }

      if (!response.ok) {
        throw new Error(
          typeof result.error === 'string' ? result.error : 'We couldn’t read that page.'
        );
      }

      if (!result || typeof result !== 'object') {
        throw new Error('We couldn’t read that page.');
      }

      if (urlInput.value.trim() !== productUrl) return;

      urlInput.value = result.productUrl;
      generatedTitle = fillGeneratedField(titleInput, result.title, generatedTitle);
      generatedPrice = fillGeneratedField(priceInput, result.price, generatedPrice);
      setStatus(
        result.aiAssisted
          ? 'We filled what we could find, with a little AI help. Check the details before adding.'
          : 'We filled what the page shared. Check the details before adding.'
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(error instanceof Error ? error.message : 'We couldn’t read that page.', true);
    } finally {
      if (activeRequest === controller) {
        fetchButton.disabled = false;
        form.removeAttribute('aria-busy');
      }
    }
  };

  urlInput.addEventListener('paste', () => {
    // Paste fires before the browser updates the input. Waiting one task also
    // handles replacing a selection or pasting into a partly completed URL.
    setTimeout(() => void fetchDetails(urlInput.value), 0);
  });
  urlInput.addEventListener('change', () => void fetchDetails(urlInput.value));
  fetchButton.addEventListener('click', (event) => {
    event.preventDefault();
    void fetchDetails(urlInput.value, true);
  });
}
