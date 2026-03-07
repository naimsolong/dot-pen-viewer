/**
 * dot-pen viewer — Cloudflare Worker
 *
 * Serves the static viewer app from the ./public assets binding.
 * All .pen file processing is done entirely in the browser (client-side).
 * No data is collected, stored, or transmitted to any server.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve index.html for root and any unknown paths (SPA fallback)
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return env.ASSETS.fetch(
        new Request(new URL('/index.html', request.url), request)
      );
    }

    // Serve og-image.svg with correct content-type for social crawlers
    if (url.pathname === '/og-image.png' || url.pathname === '/og-image.svg') {
      const svgRes = await env.ASSETS.fetch(
        new Request(new URL('/og-image.svg', request.url), request)
      ).catch(() => null);
      if (svgRes) {
        const body = await svgRes.text();
        return new Response(body, {
          headers: {
            'Content-Type':  'image/svg+xml',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    // Serve all other static assets (if any are added later)
    const assetResponse = await env.ASSETS.fetch(request).catch(() => null);
    if (assetResponse && assetResponse.status !== 404) return assetResponse;

    // SPA fallback — always serve index.html
    return env.ASSETS.fetch(
      new Request(new URL('/index.html', request.url), request)
    );
  },
};
