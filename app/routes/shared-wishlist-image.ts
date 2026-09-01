import { cloudflareContext } from '../lib/context';
import {
  consumeSharedImageBudget,
  getSharedWishlistImageUrl,
  makeSharedImageRequesterKey,
  SharedImageRateLimitError,
  SharedWishlistInputError
} from '../lib/db/shared-wishlists';
import { fetchProductImage, ProductImageError } from '../lib/product-image';
import { sharedImageHeadResponse } from '../lib/shared-image-request';

import type { Route } from './+types/shared-wishlist-image';

export async function loader({ context, params, request }: Route.LoaderArgs) {
  try {
    const { env } = context.get(cloudflareContext);
    const image = await getSharedWishlistImageUrl(env.DB, params.token, params.itemId);
    if (!image) return new Response('Picture not found.', { status: 404 });
    const headResponse = sharedImageHeadResponse(request.method);
    if (headResponse) return headResponse;
    const requesterHash = await makeSharedImageRequesterKey(
      params.token,
      request.headers.get('CF-Connecting-IP')
    );
    await consumeSharedImageBudget(env.DB, image.wishlistId, requesterHash);
    return await fetchProductImage(image.imageUrl);
  } catch (error) {
    if (error instanceof SharedWishlistInputError || error instanceof ProductImageError) {
      return new Response('Picture not found.', { status: 404 });
    }
    if (error instanceof SharedImageRateLimitError) {
      return new Response(error.message, {
        status: 429,
        headers: { 'Retry-After': String(error.retryAfterSeconds) }
      });
    }
    throw error;
  }
}
