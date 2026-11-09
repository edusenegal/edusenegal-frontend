// Cloudflare Pages Function — relaie /api/* vers le backend EduSénégal (same-origin → zéro CORS).
const BACKEND = "https://api-services.senetude.com";
export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, BACKEND);
  return fetch(new Request(target.toString(), request));
}
