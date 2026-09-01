import { cloudflareContext, identityContext } from '../lib/context';
import { ensureMemberForEmail, MemberAdmissionError } from '../lib/db/members';
import { fetchProductImage, ProductImageError } from '../lib/product-image';

import type { Route } from './+types/product-image';

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  try {
    const { env } = context.get(cloudflareContext);
    const identity = context.get(identityContext);
    await ensureMemberForEmail(env.DB, identity.email);

    return await fetchProductImage(url.searchParams.get('url'));
  } catch (error) {
    if (error instanceof MemberAdmissionError) {
      return new Response('This identity has not joined this family.', { status: 403 });
    }
    if (error instanceof ProductImageError) {
      return new Response(error.message, { status: 404 });
    }
    throw error;
  }
}
