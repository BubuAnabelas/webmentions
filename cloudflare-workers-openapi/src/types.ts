import { z } from '@hono/zod-openapi';

export const WebMentionRequestSchema = z
	.object({
		source: z.string().url('Source must be a valid URL'),
		target: z.string().url('Target must be a valid URL'),
	})
	.openapi('WebMentionRequest');

export type WebMentionRequest = z.infer<typeof WebMentionRequestSchema>;

/** Success response body only; HTTP status and headers are actual response metadata. */
export const WebMentionResponseSchema = z
	.object({
		success: z.literal(true),
	})
	.openapi('WebMentionResponse');

export type WebMentionResponse = z.infer<typeof WebMentionResponseSchema>;

export const ErrorResponseSchema = z
	.object({
		error: z.string(),
		details: z.array(z.unknown()).optional(),
	})
	.openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/** Shape of JSON body for 404 responses (app.notFound). */
export interface NotFoundResponse {
	success: false;
	error: string;
}

/** Minimal shape of GET /openapi.json response. */
export interface OpenApiDoc {
	openapi: string;
	info: { title: string; version: string; description?: string };
}
