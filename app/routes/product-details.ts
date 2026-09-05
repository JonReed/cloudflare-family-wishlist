import { cloudflareContext, identityContext, organiserEmailForRequest } from '../lib/context';
import { consumeProductLookupBudget, ProductLookupRateLimitError } from '../lib/db/product-lookups';
import { ensureMemberForEmail } from '../lib/db/members';
import {
  createBrowserRunProductRenderer,
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
    const identity = context.get(identityContext);
    const member = await ensureMemberForEmail(
      env.DB,
      identity.email,
      organiserEmailForRequest(env, identity.email)
    );
    const formData = await request.formData();
    await consumeProductLookupBudget(env.DB, member.id);
    const metadata = await fetchProductMetadata(
      formData.get('productUrl'),
      new URL(request.url).hostname,
      {
        renderPage: createBrowserRunProductRenderer(env.BROWSER),
        extractWithAi:
          String(env.PRODUCT_AI_ENABLED).toLowerCase() === 'true'
            ? createWorkersAiProductExtractor(env.AI, env.PRODUCT_AI_MODEL)
            : undefined
      }
    );
    return Response.json(metadata);
  } catch (error) {
    if (error instanceof ProductMetadataError) {
      return Response.json(
        { error: error.message, diagnostics: error.diagnostics },
        { status: 400 }
      );
    }

    if (error instanceof ProductLookupRateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }

    throw error;
  }
}
