// Cloudflare Pages Function — relaie /api/* vers le backend EduSénégal.
// Le navigateur appelle son propre domaine (same-origin) → zéro CORS ;
// le relai se fait côté serveur Cloudflare vers api.senetude.net.
// Le chemin /api/... est préservé tel quel (la gateway attend /api/v1/...).
const BACKEND = "https://api-services.senetude.com";

export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, BACKEND);
  // Recopie méthode, en-têtes et corps ; la réponse (dont X-Refreshed-Token) repasse telle quelle.
  return fetch(new Request(target.toString(), request));
}
