import {
  formatRetryDelay,
  parseRateLimit,
  parseSampledResponse,
} from "./client-rate-limit";

function createMockResponse(status: number, headers: Record<string, string> = {}) {
  const headerMap = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    status,
  } as unknown as Response;
}

describe("client-rate-limit", () => {
  test("returns non-rate-limited state for non-429 responses", () => {
    const response = createMockResponse(200);
    const result = parseRateLimit(response, "Fallback");

    expect(result.isRateLimited).toBe(false);
    expect(result.message).toBe("Fallback");
    expect(result.retryInSeconds).toBe(0);
  });

  test("parses 429 headers and computes retry metadata", () => {
    const response = createMockResponse(429, {
      "Retry-After": "12",
      "X-RateLimit-Limit": "20",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1700000000",
    });
    const result = parseRateLimit(response, "Too many requests.");

    expect(result.isRateLimited).toBe(true);
    expect(result.retryInSeconds).toBe(12);
    expect(result.limit).toBe(20);
    expect(result.remaining).toBe(0);
    expect(result.resetEpochSeconds).toBe(1700000000);
    expect(result.message).toBe("Too many requests.");
  });

  test("falls back to reset header when Retry-After is missing", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000);

    try {
      const resetEpochSeconds = Math.ceil(1_000_000 / 1000) + 9;
      const response = createMockResponse(429, {
        "X-RateLimit-Reset": String(resetEpochSeconds),
      });
      const result = parseRateLimit(response, "Too many requests.");

      expect(result.isRateLimited).toBe(true);
      expect(result.retryInSeconds).toBe(9);
    } finally {
      nowSpy.mockRestore();
    }
  });

  test("parses sampled 202 responses", () => {
    const response = createMockResponse(202);
    expect(parseSampledResponse(response, { sampled: true })).toBe(true);
    expect(parseSampledResponse(response, { sampled: false })).toBe(false);
    expect(parseSampledResponse(createMockResponse(200), { sampled: true })).toBe(false);
  });

  test("formats retry delay for seconds and minutes", () => {
    expect(formatRetryDelay(9)).toBe("9s");
    expect(formatRetryDelay(61)).toBe("1:01");
  });
});
