import { describe, it, expect } from 'vitest';
import {
	WebMentionRequestSchema,
	WebMentionResponseSchema,
	ErrorResponseSchema,
} from './types';

describe('WebMentionRequestSchema', () => {
	it('accepts valid source and target URLs', () => {
		const validData = {
			source: 'https://example.com/post',
			target: 'https://localhost/target',
		};
		const result = WebMentionRequestSchema.safeParse(validData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.source).toBe(validData.source);
			expect(result.data.target).toBe(validData.target);
		}
	});

	it('rejects invalid source URL', () => {
		const invalidData = {
			source: 'not-a-url',
			target: 'https://localhost/target',
		};
		const result = WebMentionRequestSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it('rejects invalid target URL', () => {
		const invalidData = {
			source: 'https://example.com/post',
			target: 'not-a-url',
		};
		const result = WebMentionRequestSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it('rejects empty source', () => {
		const invalidData = {
			source: '',
			target: 'https://localhost/target',
		};
		const result = WebMentionRequestSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it('rejects empty target', () => {
		const invalidData = {
			source: 'https://example.com/post',
			target: '',
		};
		const result = WebMentionRequestSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it('rejects missing source', () => {
		const invalidData = {
			target: 'https://localhost/target',
		};
		const result = WebMentionRequestSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it('rejects missing target', () => {
		const invalidData = {
			source: 'https://example.com/post',
		};
		const result = WebMentionRequestSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});
});

describe('WebMentionResponseSchema', () => {
	it('accepts valid success response body', () => {
		const result = WebMentionResponseSchema.safeParse({ success: true });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.success).toBe(true);
		}
	});

	it('rejects success: false', () => {
		const result = WebMentionResponseSchema.safeParse({ success: false });
		expect(result.success).toBe(false);
	});

	it('rejects missing success', () => {
		const result = WebMentionResponseSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects non-boolean success', () => {
		const result = WebMentionResponseSchema.safeParse({ success: 'true' });
		expect(result.success).toBe(false);
	});
});

describe('ErrorResponseSchema', () => {
	it('accepts error without details', () => {
		const validData = {
			error: 'Something went wrong',
		};
		const result = ErrorResponseSchema.safeParse(validData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.error).toBe('Something went wrong');
		}
	});

	it('accepts error with empty details array', () => {
		const validData = {
			error: 'Validation failed',
			details: [],
		};
		const result = ErrorResponseSchema.safeParse(validData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.error).toBe('Validation failed');
			expect(result.data.details).toEqual([]);
		}
	});

	it('accepts error with mixed-type details array', () => {
		const validData = {
			error: 'Multiple issues',
			details: [1, 'error message', { field: 'source' }, true],
		};
		const result = ErrorResponseSchema.safeParse(validData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.error).toBe('Multiple issues');
			expect(result.data.details?.length).toBe(4);
		}
	});

	it('rejects missing error', () => {
		const invalidData = {
			details: ['some detail'],
		};
		const result = ErrorResponseSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it('rejects non-string error', () => {
		const invalidData = {
			error: 123,
		};
		const result = ErrorResponseSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it('rejects empty object', () => {
		const invalidData = {};
		const result = ErrorResponseSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});
});
