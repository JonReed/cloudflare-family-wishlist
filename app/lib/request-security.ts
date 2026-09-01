const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_MUTATION_BODY_BYTES = 32 * 1024;
const FORM_CONTENT_TYPES = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export class RequestSecurityError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 413 | 415,
    readonly code: 'invalid_origin' | 'cross_origin' | 'body_too_large' | 'unsupported_content_type'
  ) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

function assertMutationOrigin(request: Request, allowDevelopmentOrigin: boolean): void {
  const origin = request.headers.get('Origin');

  if (!origin || origin === 'null') {
    throw new RequestSecurityError(
      'A verifiable request origin is required.',
      403,
      'invalid_origin'
    );
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new RequestSecurityError('The request origin is invalid.', 403, 'invalid_origin');
  }

  if (origin !== parsedOrigin.origin) {
    throw new RequestSecurityError('The request origin is invalid.', 403, 'invalid_origin');
  }

  const requestUrl = new URL(request.url);
  const isLoopbackDevelopmentProxy =
    allowDevelopmentOrigin &&
    LOOPBACK_HOSTNAMES.has(parsedOrigin.hostname) &&
    LOOPBACK_HOSTNAMES.has(requestUrl.hostname);

  if (!isLoopbackDevelopmentProxy && parsedOrigin.origin !== requestUrl.origin) {
    throw new RequestSecurityError(
      'Cross-origin form submissions are not allowed.',
      403,
      'cross_origin'
    );
  }
}

function assertFormContentType(request: Request): void {
  if (!request.body) return;

  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !FORM_CONTENT_TYPES.has(contentType)) {
    throw new RequestSecurityError(
      'This request body type is not supported.',
      415,
      'unsupported_content_type'
    );
  }
}

async function readBoundedBody(request: Request): Promise<ArrayBuffer | null> {
  if (!request.body) return null;

  const contentLength = request.headers.get('Content-Length');
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      throw new RequestSecurityError('The request body length is invalid.', 400, 'body_too_large');
    }
    if (declaredBytes > MAX_MUTATION_BODY_BYTES) {
      throw new RequestSecurityError('The request body is too large.', 413, 'body_too_large');
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_MUTATION_BODY_BYTES) {
      await reader.cancel();
      throw new RequestSecurityError('The request body is too large.', 413, 'body_too_large');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(new ArrayBuffer(totalBytes));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body.buffer;
}

/** Applies the browser mutation boundary before authentication or route code runs. */
export async function secureMutationRequest(
  request: Request,
  options: { allowDevelopmentOrigin?: boolean } = {}
): Promise<Request> {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return request;

  assertMutationOrigin(request, options.allowDevelopmentOrigin === true);
  assertFormContentType(request);
  const body = await readBoundedBody(request);

  if (!body) return request;
  return new Request(request, { body });
}
