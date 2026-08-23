/** Public landing page documenting the self-hosted Webmention endpoint and read API. */

export function landingPageHtml(origin: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Webmentions</title>
<style>
	body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
	h1 { font-size: 1.75rem; }
	code, pre { background: #f4f4f4; border-radius: 4px; }
	code { padding: 0.15em 0.4em; }
	pre { padding: 1rem; overflow-x: auto; }
	a { color: #0645ad; }
</style>
</head>
<body>
<h1>Webmentions</h1>
<p>A self-hosted <a href="https://www.w3.org/TR/webmention/">Webmention</a> endpoint and receiver — the collection side of what webmention.io provides, running on your own Cloudflare account. Display is left to you; see below.</p>

<h2>1. Receive mentions</h2>
<p>Advertise this endpoint on any page you want to collect mentions for:</p>
<pre><code>&lt;link rel="webmention" href="${origin}/wm"&gt;</code></pre>
<p>Other sites (or services like <a href="https://brid.gy">Bridgy</a>) will POST here whenever they link to you. Mentions are queued, then verified on a schedule before being stored.</p>

<h2>2. Read mentions</h2>
<pre><code>GET ${origin}/wm?target=https://yoursite.dev/blog/self-hosting-webmentions</code></pre>
<p>Returns JSON:</p>
<pre><code>{
  "mentions": [
    { "source": "https://notes.dev/2026/webmentions-are-good", "target": "https://yoursite.dev/blog/self-hosting-webmentions", "type": "reply" },
    { "source": "https://kai.garden/likes/482", "target": "https://yoursite.dev/blog/self-hosting-webmentions", "type": "like" }
  ]
}</code></pre>
<p>Add <code>&amp;type=like</code> to filter by mention type. CORS is open on this endpoint, so it can be fetched client-side from any origin. Full API reference at <a href="${origin}/docs">/docs</a>.</p>
<p>Rendering is up to you — the API returns data, not markup.</p>
</body>
</html>`;
}
