/* global AbortController, DOMException, FormData, HTMLButtonElement, HTMLElement, HTMLFormElement, HTMLImageElement, HTMLInputElement, URL, document, fetch, setTimeout */

const imagePreviewUpdates = new Map();

for (const field of document.querySelectorAll('[data-product-image-field]')) {
  const imageInput = field.querySelector('[data-product-image]');
  const imagePreview = field.querySelector('[data-product-image-preview]');
  const imagePreviewImage = field.querySelector('[data-product-image-preview-image]');
  const removeButton = field.querySelector('[data-product-image-remove]');
  const presentCopy = field.querySelectorAll('[data-product-image-present]');
  const missingCopy = field.querySelectorAll('[data-product-image-missing]');

  if (
    !(imageInput instanceof HTMLInputElement) ||
    !(imagePreview instanceof HTMLElement) ||
    !(imagePreviewImage instanceof HTMLImageElement) ||
    !(removeButton instanceof HTMLButtonElement)
  ) {
    continue;
  }

  const showPreview = (hasPreview) => {
    imagePreview.hidden = !hasPreview;
    for (const element of presentCopy) element.hidden = !hasPreview;
    for (const element of missingCopy) element.hidden = hasPreview;
  };

  const updateImagePreview = () => {
    const imageUrl = imageInput.value.trim();
    removeButton.hidden = !imageUrl;

    if (!/^https:\/\//i.test(imageUrl)) {
      imagePreviewImage.removeAttribute('src');
      showPreview(false);
      return;
    }

    const proxyUrl = new URL('/product-image', document.baseURI);
    proxyUrl.searchParams.set('url', imageUrl);

    if (imagePreviewImage.src !== proxyUrl.href) {
      showPreview(true);
      imagePreviewImage.src = proxyUrl.href;
    } else if (imagePreviewImage.complete && imagePreviewImage.naturalWidth > 0) {
      showPreview(true);
    }
  };

  imagePreviewImage.addEventListener('load', () => showPreview(true));
  imagePreviewImage.addEventListener('error', () => {
    imagePreviewImage.removeAttribute('src');
    showPreview(false);
  });
  imageInput.addEventListener('input', updateImagePreview);
  removeButton.addEventListener('click', () => {
    imageInput.value = '';
    updateImagePreview();
  });

  imagePreviewUpdates.set(imageInput, updateImagePreview);
  updateImagePreview();
}

const forms = document.querySelectorAll('[data-product-import-form]');

for (const form of forms) {
  const urlInput = form.querySelector('[data-product-url]');
  const titleInput = form.querySelector('[data-product-title]');
  const priceInput = form.querySelector('[data-product-price]');
  const imageInput = form.querySelector('[data-product-image]');
  const fetchButton = form.querySelector('[data-product-fetch]');
  const status = form.querySelector('[data-product-status]');

  if (
    !(form instanceof HTMLFormElement) ||
    !(urlInput instanceof HTMLInputElement) ||
    !(titleInput instanceof HTMLInputElement) ||
    !(priceInput instanceof HTMLInputElement) ||
    !(imageInput instanceof HTMLInputElement) ||
    !(fetchButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLElement)
  ) {
    continue;
  }

  let activeRequest;
  let lastRequestedUrl = '';
  let generatedTitle = '';
  let generatedPrice = '';
  let generatedImageUrl = '';

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('product-fetch-error', isError);
  };

  const fillGeneratedField = (input, value, previousValue) => {
    if (typeof value !== 'string') return previousValue;
    if (!input.value || input.value === previousValue) input.value = value;
    return value;
  };

  const fetchDetails = async (candidate, force = false) => {
    const productUrl = candidate.trim();
    if (!productUrl) {
      lastRequestedUrl = '';
      activeRequest?.abort();
      activeRequest = undefined;
      fetchButton.disabled = false;
      form.removeAttribute('aria-busy');
      setStatus('');
      return;
    }
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
      generatedImageUrl = fillGeneratedField(imageInput, result.imageUrl, generatedImageUrl);
      imagePreviewUpdates.get(imageInput)?.();
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
  urlInput.addEventListener('input', () => {
    if (!urlInput.value.trim()) void fetchDetails('');
  });
  urlInput.addEventListener('change', () => void fetchDetails(urlInput.value));
  fetchButton.addEventListener('click', (event) => {
    event.preventDefault();
    void fetchDetails(urlInput.value, true);
  });
  form.addEventListener('submit', (event) => {
    const submitter = event.submitter;
    if (!(submitter instanceof HTMLButtonElement) || submitter.value !== 'add-item') return;

    // The add response is authoritative from here. Do not let an earlier lookup
    // finish against a cleared form or leave duplicate feedback beside it.
    activeRequest?.abort();
    activeRequest = undefined;
    lastRequestedUrl = '';
    fetchButton.disabled = false;
    form.removeAttribute('aria-busy');
    setStatus('');
  });
}
