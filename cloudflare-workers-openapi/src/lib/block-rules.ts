/**
 * Block-rule matching: domain pattern (exact, suffix *.x, prefix x.*) and source URL prefix.
 * Mention-type rules are applied when processing (type known after fetching source).
 */

export type PatternKind = 'exact' | 'suffix' | 'prefix';

export interface BlockRuleRow {
	domainPattern: string | null;
	patternKind: PatternKind | null;
	sourceUrlPrefix: string | null;
	mentionType: string | null;
	label: string | null;
}

/** Returns true if host matches the domain pattern. */
export function matchesDomainPattern(
	host: string,
	pattern: string,
	kind: PatternKind
): boolean {
	const h = host.toLowerCase();
	const p = pattern.toLowerCase();
	if (kind === 'exact') {
		return h === p;
	}
	if (kind === 'suffix') {
		// *.evil.com matches evil.com, a.evil.com, b.evil.com
		if (p.startsWith('*.')) {
			const suffix = p.slice(2);
			return h === suffix || h.endsWith('.' + suffix);
		}
		return h === p || h.endsWith('.' + p);
	}
	if (kind === 'prefix') {
		// spam.* matches spam.com, spam.net
		if (p.endsWith('.*')) {
			const prefix = p.slice(0, -2);
			return h.startsWith(prefix + '.') || h === prefix;
		}
		return h.startsWith(p + '.') || h === p;
	}
	return false;
}

/** Returns true if the block rule matches this source (domain and/or URL prefix). Mention-type is not checked here (applied when processing). */
export function blockRuleMatchesSource(rule: BlockRuleRow, sourceUrl: string): boolean {
	const r = rule as Record<string, unknown>;
	const sourceUrlPrefix = (r.sourceUrlPrefix ?? r.source_url_prefix) as string | null | undefined;
	if (sourceUrlPrefix) {
		const prefix = String(sourceUrlPrefix).trim();
		if (prefix && sourceUrl.startsWith(prefix)) {
			return true;
		}
	}
	const domainPattern = (r.domainPattern ?? r.domain_pattern) as string | null | undefined;
	const patternKind = (r.patternKind ?? r.pattern_kind) as PatternKind | null | undefined;
	if (domainPattern && patternKind) {
		try {
			const host = new URL(sourceUrl).hostname;
			if (matchesDomainPattern(host, domainPattern, patternKind)) {
				return true;
			}
		} catch {
			// ignore invalid URL
		}
	}
	return false;
}
