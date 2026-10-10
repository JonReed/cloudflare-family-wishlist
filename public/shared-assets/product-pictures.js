/* global HTMLImageElement, MutationObserver, document */

// A shop may remove a picture or refuse hotlinking. Keep the wish usable without
// its picture, including failures that happened before this helper loaded.
function updatePicture(image) {
  if (!(image instanceof HTMLImageElement) || !image.matches('.wish-image')) return;

  const failed = image.complete && image.naturalWidth === 0;
  image.hidden = failed;
  image.parentElement?.classList.toggle('wish-content-with-image', !failed);
}

function updatePictures() {
  for (const image of document.querySelectorAll('img.wish-image')) updatePicture(image);
}

// Image events do not bubble, so capture also covers pictures added by navigation.
document.addEventListener('error', (event) => updatePicture(event.target), true);
document.addEventListener('load', (event) => updatePicture(event.target), true);
new MutationObserver(updatePictures).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['src']
});
updatePictures();
