/**
 * Domain verification via meta/link tag (inspired by webmention.io domain ownership).
 * User adds a meta tag or link rel with a unique token to their site; we fetch and check.
 */

export const META_NAME = 'webmentions-verification';
export const LINK_REL = 'webmentions-verification';

export async function fetchAndCheckToken(
	domain: string,
	token: string,
	fetchFn: typeof fetch = fetch
): Promise<boolean> {
	const url = `https://${domain}/`;
	let res: Response;
	try {
		res = await fetchFn(url, {
			redirect: 'follow',
			headers: { 'User-Agent': 'Webmentions-Dashboard-Verify/1.0' },
		});
	} catch {
		return false;
	}
	if (!res.ok) return false;
	const html = await res.text();
	return tokenPresentInHtml(html, token);
}

export function tokenPresentInHtml(html: string, token: string): boolean {
	// Meta: <meta name="webmentions-verification" content="TOKEN">
	const metaRegex = new RegExp(
		`<meta[^>]+name=["']${escapeRegex(META_NAME)}["'][^>]+content=["']${escapeRegex(token)}["']`,
		'i'
	);
	if (metaRegex.test(html)) return true;
	// Also allow content before name
	const metaRegex2 = new RegExp(
		`<meta[^>]+content=["']${escapeRegex(token)}["'][^>]+name=["']${escapeRegex(META_NAME)}["']`,
		'i'
	);
	if (metaRegex2.test(html)) return true;
	// Link: <link rel="webmentions-verification" href="...TOKEN...">
	const linkRegex = new RegExp(
		`<link[^>]+rel=["']${escapeRegex(LINK_REL)}["'][^>]+href=["'][^"']*${escapeRegex(token)}[^"']*["']`,
		'i'
	);
	if (linkRegex.test(html)) return true;
	const linkRegex2 = new RegExp(
		`<link[^>]+href=["'][^"']*${escapeRegex(token)}[^"']*["'][^>]+rel=["']${escapeRegex(LINK_REL)}["']`,
		'i'
	);
	return linkRegex2.test(html);
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
