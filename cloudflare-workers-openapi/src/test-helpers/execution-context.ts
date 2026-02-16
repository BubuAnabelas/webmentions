/**
 * Returns an ExecutionContext suitable for testing fetch handlers.
 * Uses the real ExecutionContext type from the Workers environment.
 */
export function createTestExecutionContext(): ExecutionContext {
	return {
		waitUntil: () => {},
		passThroughOnException: () => {},
		get props() {
			return {};
		},
	};
}
