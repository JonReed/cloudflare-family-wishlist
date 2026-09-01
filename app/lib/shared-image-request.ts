export function sharedImageHeadResponse(method: string): Response | null {
  if (method !== 'HEAD') return null;
  return new Response(null, {
    status: 200,
    headers: { 'Content-Type': 'application/octet-stream' }
  });
}
