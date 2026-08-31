import { cloudflareContext } from '../lib/context';
import {
  createWorkersAiProductExtractor,
  fetchProductMetadata,
  ProductMetadataError
} from '../lib/product-metadata';

import type { Route } from './+types/product-details';

function methodNotAllowed(): Response {
  return Response.json(
    { error: 'This product helper only accepts form submissions.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export function loader() {
  return methodNotAllowed();
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== 'POST') return methodNotAllowed();

  try {
    const { env } = context.get(cloudflareContext);
    const formData = await request.formData();
    const metadata = await fetchProductMetadata(
      formData.get('productUrl'),
      new URL(request.url).hostname,
      {
        extractWithAi:
          String(env.PRODUCT_AI_ENABLED).toLowerCase() === 'true'
            ? createWorkersAiProductExtractor(env.AI, env.PRODUCT_AI_MODEL)
            : undefined
      }
    );
    return Response.json(metadata);
  } catch (error) {
    if (error instanceof ProductMetadataError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}
