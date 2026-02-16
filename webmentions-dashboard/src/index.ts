import { Hono } from 'hono';
import { domainRoutes } from './routes/domains';
import { blockRulesRoutes } from './routes/block-rules';
import { settingsRoutes } from './routes/settings';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { domains } from './schema';
import { fetchAndCheckToken } from './lib/verify';

export interface Env {
	DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

app.route('/', domainRoutes);
app.route('/', blockRulesRoutes);
app.route('/', settingsRoutes);

app.get('/verify', (c) => {
	const token = c.req.query('token');
	if (!token) return c.text('Missing token', 400);
	return c.text('OK', 200);
});

app.get('/', (c) => c.html(getDashboardHtml(new URL(c.req.url).origin)));

function getDashboardHtml(origin: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Webmentions Dashboard</title>
	<style>
		body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 1rem; }
		h1 { margin-top: 0; }
		section { margin: 1.5rem 0; }
		table { width: 100%; border-collapse: collapse; }
		th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #eee; }
		button, input[type="text"], select { padding: 0.4rem 0.6rem; margin-right: 0.5rem; }
		.verified { color: green; }
		.unverified { color: #888; }
		.error { color: #c00; }
		code { background: #f4f4f4; padding: 0.2rem 0.4rem; font-size: 0.9em; }
	</style>
</head>
<body>
	<h1>Webmentions Dashboard</h1>
	<p>Manage whitelist (domains that can receive webmentions), blacklist (exact domains blocked from sending), and <strong>block rules</strong> (domain patterns, URL prefix, or mention type) to filter unwanted webmentions—e.g. malicious domains, spam, or blocking specific users/sites. Whitelist domains must be verified by adding a meta or link tag to your site.</p>

	<section>
		<h2>Webmention mode</h2>
		<p>Choose how this site accepts webmentions: <strong>Admit all</strong> (process every webmention except blacklisted or block-rule matches) or <strong>Whitelist only</strong> (only process webmentions from source domains you have added to the whitelist).</p>
		<select id="webmentionMode">
			<option value="admit_all">Admit all</option>
			<option value="whitelist_only">Whitelist only</option>
		</select>
		<button id="saveMode">Save</button>
		<span id="modeResult"></span>
	</section>

	<section>
		<h2>Add domain</h2>
		<input type="text" id="domain" placeholder="example.com" />
		<select id="listType">
			<option value="whitelist">Whitelist</option>
			<option value="blacklist">Blacklist</option>
		</select>
		<button id="add">Add</button>
		<div id="addResult"></div>
		<div id="verifyInstructions" style="display:none; margin-top: 0.5rem;">
			<p>Add one of these to your site’s <code>&lt;head&gt;</code> to verify ownership:</p>
			<pre id="metaTag"></pre>
			<pre id="linkTag"></pre>
		</div>
	</section>

	<section>
		<h2>Domains</h2>
		<select id="filter">
			<option value="">All</option>
			<option value="whitelist">Whitelist</option>
			<option value="blacklist">Blacklist</option>
		</select>
		<button id="reverifyAll" style="display:none;">Re-verify all whitelist</button>
		<table>
			<thead><tr><th>Domain</th><th>Type</th><th>Status</th><th>Last verified</th><th></th></tr></thead>
			<tbody id="list"></tbody>
		</table>
	</section>

	<section>
		<h2>Block rules</h2>
		<p>Filter webmentions by domain pattern (exact, <code>*.evil.com</code>, <code>spam.*</code>), source URL prefix, or mention type (in-reply-to, like-of, repost-of, etc.). At least one criterion required. Optional label (e.g. Spam, Blocked user).</p>
		<div style="display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; margin-bottom:0.5rem;">
			<input type="text" id="ruleDomain" placeholder="evil.com or *.spam.com" style="width:12rem;" />
			<select id="rulePatternKind">
				<option value="exact">exact</option>
				<option value="suffix">suffix (*.x)</option>
				<option value="prefix">prefix (x.*)</option>
			</select>
			<span>or URL prefix:</span>
			<input type="text" id="ruleUrlPrefix" placeholder="https://example.com/user/" style="width:14rem;" />
			<span>or type:</span>
			<select id="ruleMentionType">
				<option value="">—</option>
				<option value="in-reply-to">in-reply-to</option>
				<option value="like-of">like-of</option>
				<option value="repost-of">repost-of</option>
				<option value="mention-of">mention-of</option>
				<option value="bookmark-of">bookmark-of</option>
				<option value="rsvp">rsvp</option>
			</select>
			<input type="text" id="ruleLabel" placeholder="Label (optional)" style="width:8rem;" />
			<button id="addRule">Add rule</button>
		</div>
		<div id="ruleResult"></div>
		<table>
			<thead><tr><th>Rule</th><th>Label</th><th></th></tr></thead>
			<tbody id="ruleList"></tbody>
		</table>
	</section>

	<script>
		const base = ${JSON.stringify(origin)};
		async function api(path, opts = {}) {
			const r = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
			const text = await r.text();
			let data;
			try { data = JSON.parse(text); } catch { data = text; }
			if (!r.ok) throw new Error(data?.error || data || r.status);
			return data;
		}
		function render(domains) {
			const tbody = document.getElementById('list');
			tbody.innerHTML = domains.map(d => {
				const verified = d.verified ? '<span class="verified">Verified</span>' : '<span class="unverified">Unverified</span>';
				const last = d.lastVerifiedAt ? new Date(d.lastVerifiedAt).toLocaleString() : '—';
				const verifyBtn = d.listType === 'whitelist' && !d.verified
					? '<button onclick="verify(' + d.id + ')">Verify</button>' : '';
				const delBtn = '<button onclick="del(' + d.id + ')">Delete</button>';
				return '<tr><td>' + d.domain + '</td><td>' + d.listType + '</td><td>' + verified + '</td><td>' + last + '</td><td>' + verifyBtn + ' ' + delBtn + '</td></tr>';
			}).join('');
			document.getElementById('reverifyAll').style.display = domains.some(d => d.listType === 'whitelist' && d.verified) ? 'inline-block' : 'none';
		}
		async function load() {
			const q = document.getElementById('filter').value ? '?listType=' + document.getElementById('filter').value : '';
			const data = await api('/api/domains' + q);
			render(data.domains);
		}
		document.getElementById('filter').onchange = load;
		document.getElementById('add').onclick = async () => {
			const domain = document.getElementById('domain').value.trim();
			const listType = document.getElementById('listType').value;
			document.getElementById('addResult').textContent = '';
			document.getElementById('verifyInstructions').style.display = 'none';
			if (!domain) return;
			try {
				const data = await api('/api/domains', { method: 'POST', body: JSON.stringify({ domain, listType }) });
				document.getElementById('addResult').innerHTML = '<span class="verified">Added.</span>';
				if (data.instructions && listType === 'whitelist') {
					document.getElementById('metaTag').textContent = data.instructions.meta;
					document.getElementById('linkTag').textContent = data.instructions.link;
					document.getElementById('verifyInstructions').style.display = 'block';
				}
				document.getElementById('domain').value = '';
				load();
			} catch (e) {
				document.getElementById('addResult').innerHTML = '<span class="error">' + e.message + '</span>';
			}
		};
		async function verify(id) {
			try {
				await api('/api/domains/' + id + '/verify', { method: 'POST' });
				load();
			} catch (e) {
				alert(e.message);
			}
		}
		async function del(id) {
			if (!confirm('Delete this domain?')) return;
			try {
				await api('/api/domains/' + id, { method: 'DELETE' });
				load();
			} catch (e) {
				alert(e.message);
			}
		}
		document.getElementById('reverifyAll').onclick = async () => {
			try {
				await api('/api/domains/reverify', { method: 'POST' });
				load();
			} catch (e) {
				alert(e.message);
			}
		};
		function ruleDesc(r) {
			const parts = [];
			if (r.domainPattern && r.patternKind) parts.push(r.patternKind + ': ' + r.domainPattern);
			if (r.sourceUrlPrefix) parts.push('URL: ' + r.sourceUrlPrefix);
			if (r.mentionType) parts.push('type: ' + r.mentionType);
			return parts.length ? parts.join(' · ') : '—';
		}
		function renderRules(rules) {
			const tbody = document.getElementById('ruleList');
			tbody.innerHTML = rules.map(r => '<tr><td>' + ruleDesc(r) + '</td><td>' + (r.label || '—') + '</td><td><button onclick="delRule(' + r.id + ')">Delete</button></td></tr>').join('');
		}
		async function loadRules() {
			try {
				const data = await api('/api/block-rules');
				renderRules(data.rules);
			} catch (e) {
				document.getElementById('ruleList').innerHTML = '<tr><td colspan="3" class="error">' + e.message + '</td></tr>';
			}
		}
		document.getElementById('addRule').onclick = async () => {
			const domainPattern = document.getElementById('ruleDomain').value.trim();
			const patternKind = document.getElementById('rulePatternKind').value;
			const sourceUrlPrefix = document.getElementById('ruleUrlPrefix').value.trim();
			const mentionType = document.getElementById('ruleMentionType').value || undefined;
			const label = document.getElementById('ruleLabel').value.trim() || undefined;
			document.getElementById('ruleResult').textContent = '';
			const body = {};
			if (domainPattern && patternKind) { body.domainPattern = domainPattern; body.patternKind = patternKind; }
			if (sourceUrlPrefix) body.sourceUrlPrefix = sourceUrlPrefix;
			if (mentionType) body.mentionType = mentionType;
			if (label) body.label = label;
			if (!body.domainPattern && !body.sourceUrlPrefix && !body.mentionType) {
				document.getElementById('ruleResult').innerHTML = '<span class="error">Provide at least one: domain + kind, URL prefix, or mention type.</span>';
				return;
			}
			try {
				await api('/api/block-rules', { method: 'POST', body: JSON.stringify(body) });
				document.getElementById('ruleDomain').value = '';
				document.getElementById('ruleUrlPrefix').value = '';
				document.getElementById('ruleMentionType').value = '';
				document.getElementById('ruleLabel').value = '';
				loadRules();
			} catch (e) {
				document.getElementById('ruleResult').innerHTML = '<span class="error">' + e.message + '</span>';
			}
		};
		async function delRule(id) {
			if (!confirm('Delete this block rule?')) return;
			try {
				await api('/api/block-rules/' + id, { method: 'DELETE' });
				loadRules();
			} catch (e) {
				alert(e.message);
			}
		}
		async function loadSettings() {
			try {
				const data = await api('/api/settings');
				document.getElementById('webmentionMode').value = data.webmention_mode || 'admit_all';
			} catch (e) {
				document.getElementById('webmentionMode').value = 'admit_all';
			}
		}
		document.getElementById('saveMode').onclick = async () => {
			const sel = document.getElementById('webmentionMode');
			const resultEl = document.getElementById('modeResult');
			resultEl.textContent = '';
			try {
				await api('/api/settings', { method: 'PATCH', body: JSON.stringify({ webmention_mode: sel.value }) });
				resultEl.innerHTML = '<span class="verified">Saved.</span>';
			} catch (e) {
				resultEl.innerHTML = '<span class="error">' + e.message + '</span>';
			}
		};
		load();
		loadRules();
		loadSettings();
	</script>
</body>
</html>`;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(request, env, ctx);
	},
	async scheduled(
		_controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext
	): Promise<void> {
		const db = drizzle(env.DB);
		const rows = await db
			.select()
			.from(domains)
			.where(and(eq(domains.listType, 'whitelist'), eq(domains.verified, true)));
		for (const row of rows) {
			const ok = await fetchAndCheckToken(row.domain, row.verificationToken, fetch);
			await db
				.update(domains)
				.set({ verified: ok, lastVerifiedAt: new Date() })
				.where(eq(domains.id, row.id));
		}
	},
};
