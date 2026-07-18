export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

export function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new AssertionError(message);
}

function equalValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length &&
      actual.every((value, index) => equalValue(value, expected[index]));
  }
  if (
    typeof actual === "object" &&
    actual !== null &&
    typeof expected === "object" &&
    expected !== null
  ) {
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    const actualKeys = Object.keys(actualRecord).sort();
    const expectedKeys = Object.keys(expectedRecord).sort();
    return equalValue(actualKeys, expectedKeys) &&
      actualKeys.every((key) => equalValue(actualRecord[key], expectedRecord[key]));
  }
  return false;
}

export function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  if (!equalValue(actual, expected)) {
    throw new AssertionError(
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function assertStringIncludes(actual: string, expected: string, message?: string): void {
  if (!actual.includes(expected)) {
    throw new AssertionError(message ?? `Expected string to include ${JSON.stringify(expected)}`);
  }
}

export function assertMatch(actual: string, expected: RegExp, message?: string): void {
  if (!expected.test(actual)) {
    throw new AssertionError(
      message ?? `Expected ${JSON.stringify(actual)} to match ${String(expected)}`,
    );
  }
}
