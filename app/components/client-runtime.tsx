import { useEffect } from 'react';
import { Scripts } from 'react-router';

const enhancementScripts = [
  '/product-import.js',
  '/bookmarklet.js',
  '/family-members.js',
  '/share-links.js',
  '/pwa-install.js'
] as const;

export function ClientRuntime({
  cspNonce,
  isPublicShare
}: {
  cspNonce: string;
  isPublicShare: boolean;
}) {
  useEffect(() => {
    if (isPublicShare) return;

    // These older, dependency-free helpers can touch form markup. Loading them
    // after hydration keeps them available while React adopts the server HTML.
    for (const source of enhancementScripts) {
      if (document.querySelector(`script[data-wishlist-enhancement="${source}"]`)) continue;

      const script = document.createElement('script');
      script.src = source;
      script.nonce = cspNonce;
      script.async = false;
      script.dataset.wishlistEnhancement = source;
      document.body.appendChild(script);
    }
  }, [cspNonce, isPublicShare]);

  if (isPublicShare) return null;

  return <Scripts nonce={cspNonce} />;
}
