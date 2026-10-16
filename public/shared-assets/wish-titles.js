/* global CSS, MutationObserver, ResizeObserver, document */

// Keep complete headings when enhancement is unavailable. Measure the rendered
// title so short names never acquire an unnecessary disclosure.
if (CSS.supports('-webkit-line-clamp', '2') && typeof ResizeObserver !== 'undefined') {
  const observed = new Set();
  const bound = new WeakSet();
  const previousText = new WeakMap();

  function updateTitle(title) {
    if (!title?.isConnected) return;
    const heading = title.querySelector('h3');
    const disclosure = title.querySelector('.wish-title-toggle');
    if (!heading || !disclosure) return;

    if (previousText.get(heading) !== heading.textContent) {
      disclosure.open = false;
      previousText.set(heading, heading.textContent);
    }
    title.classList.add('wish-title-enhanced');
    if (!disclosure.open) {
      // Glyphs can overhang a tight line box even when nothing is truncated.
      // Count actual text lines instead of treating that overhang as overflow.
      const range = document.createRange();
      range.selectNodeContents(heading);
      const lines = new Set(Array.from(range.getClientRects(), (rect) => rect.top));
      disclosure.hidden = lines.size <= 2;
    }
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const { target } of entries) updateTitle(target.parentElement);
  });

  function updateTitles() {
    for (const heading of observed) {
      if (!heading.isConnected) {
        resizeObserver.unobserve(heading);
        observed.delete(heading);
      }
    }

    for (const title of document.querySelectorAll('[data-wish-title]')) {
      const heading = title.querySelector('h3');
      const disclosure = title.querySelector('.wish-title-toggle');
      if (!heading || !disclosure) continue;

      if (!observed.has(heading)) {
        resizeObserver.observe(heading);
        observed.add(heading);
      }
      if (!bound.has(disclosure)) {
        disclosure.addEventListener('toggle', () => updateTitle(title));
        bound.add(disclosure);
      }
      updateTitle(title);
    }
  }

  new MutationObserver(updateTitles).observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true
  });
  updateTitles();
}
