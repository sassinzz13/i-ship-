/** Base path of the versioned REST API. Same-origin in every environment:
 *  Traefik routes /api to the backend in production and the dev server
 *  proxies it locally (see proxy.conf.json). */
export const API_BASE = '/api/v1';
