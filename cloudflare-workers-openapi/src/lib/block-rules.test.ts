import { describe, it, expect } from 'vitest';
import {
	matchesDomainPattern,
	blockRuleMatchesSource,
	type BlockRuleRow,
} from './block-rules';

describe('matchesDomainPattern', () => {
	it('exact: matches same host', () => {
		expect(matchesDomainPattern('evil.com', 'evil.com', 'exact')).toBe(true);
		expect(matchesDomainPattern('EVIL.COM', 'evil.com', 'exact')).toBe(true);
	});
	it('exact: does not match different host', () => {
		expect(matchesDomainPattern('evil.com', 'good.com', 'exact')).toBe(false);
		expect(matchesDomainPattern('a.evil.com', 'evil.com', 'exact')).toBe(false);
	});

	it('suffix: *.evil.com matches evil.com and subdomains', () => {
		expect(matchesDomainPattern('evil.com', '*.evil.com', 'suffix')).toBe(true);
		expect(matchesDomainPattern('a.evil.com', '*.evil.com', 'suffix')).toBe(true);
		expect(matchesDomainPattern('b.a.evil.com', '*.evil.com', 'suffix')).toBe(true);
	});
	it('suffix: *.evil.com does not match others', () => {
		expect(matchesDomainPattern('evil.com.evil.com', '*.evil.com', 'suffix')).toBe(true);
		expect(matchesDomainPattern('notevil.com', '*.evil.com', 'suffix')).toBe(false);
		expect(matchesDomainPattern('evil.com.uk', '*.evil.com', 'suffix')).toBe(false);
	});

	it('prefix: spam.* matches spam.com, spam.net', () => {
		expect(matchesDomainPattern('spam.com', 'spam.*', 'prefix')).toBe(true);
		expect(matchesDomainPattern('spam.net', 'spam.*', 'prefix')).toBe(true);
		expect(matchesDomainPattern('spam', 'spam.*', 'prefix')).toBe(true);
	});
	it('prefix: spam.* does not match others', () => {
		expect(matchesDomainPattern('nospam.com', 'spam.*', 'prefix')).toBe(false);
		expect(matchesDomainPattern('myspam.com', 'spam.*', 'prefix')).toBe(false);
	});
});

describe('blockRuleMatchesSource', () => {
	it('matches by sourceUrlPrefix', () => {
		const rule: BlockRuleRow = {
			domainPattern: null,
			patternKind: null,
			sourceUrlPrefix: 'https://example.com/user/bob/',
			mentionType: null,
			label: 'Blocked user',
		};
		expect(blockRuleMatchesSource(rule, 'https://example.com/user/bob/post')).toBe(true);
		expect(blockRuleMatchesSource(rule, 'https://example.com/user/bob/')).toBe(true);
		expect(blockRuleMatchesSource(rule, 'https://example.com/user/alice/')).toBe(false);
	});

	it('matches by domain pattern exact', () => {
		const rule: BlockRuleRow = {
			domainPattern: 'evil.com',
			patternKind: 'exact',
			sourceUrlPrefix: null,
			mentionType: null,
			label: null,
		};
		expect(blockRuleMatchesSource(rule, 'https://evil.com/post')).toBe(true);
		expect(blockRuleMatchesSource(rule, 'https://a.evil.com/post')).toBe(false);
	});

	it('matches by domain pattern suffix', () => {
		const rule: BlockRuleRow = {
			domainPattern: '*.spam.com',
			patternKind: 'suffix',
			sourceUrlPrefix: null,
			mentionType: null,
			label: null,
		};
		expect(blockRuleMatchesSource(rule, 'https://spam.com/page')).toBe(true);
		expect(blockRuleMatchesSource(rule, 'https://a.spam.com/page')).toBe(true);
		expect(blockRuleMatchesSource(rule, 'https://nospam.com/page')).toBe(false);
	});

	it('does not match when neither domain nor URL match', () => {
		const rule: BlockRuleRow = {
			domainPattern: 'evil.com',
			patternKind: 'exact',
			sourceUrlPrefix: null,
			mentionType: null,
			label: null,
		};
		expect(blockRuleMatchesSource(rule, 'https://good.com/post')).toBe(false);
	});
});
