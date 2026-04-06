export type ClientRateLimitState = {
  isRateLimited: boolean;
  retryInSeconds: number;
  retryAtMs: number;
  message: string;
  limit: number | null;
  remaining: number | null;
  resetEpochSeconds: number | null;
};

const DEFAULT_RETRY_SECONDS = 30;

function parseHeaderNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRetryAfterSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const asNumber = Number(value);

  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.max(1, Math.ceil(asNumber));
  }

  const asDate = Date.parse(value);

  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(1, Math.ceil((asDate - Date.now()) / 1000));
}

export function formatRetryDelay(seconds: number) {
  const clampedSeconds = Math.max(1, Math.ceil(seconds));

  if (clampedSeconds < 60) {
    return `${clampedSeconds}s`;
  }

  const minutes = Math.floor(clampedSeconds / 60);
  const remainingSeconds = String(clampedSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export function parseRateLimit(response: Response, fallbackMessage: string): ClientRateLimitState {
  if (response.status !== 429) {
    return {
      isRateLimited: false,
      retryInSeconds: 0,
      retryAtMs: 0,
      message: fallbackMessage,
      limit: null,
      remaining: null,
      resetEpochSeconds: null,
    };
  }

  const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("Retry-After"));
  const resetEpochSeconds = parseHeaderNumber(response.headers.get("X-RateLimit-Reset"));
  const computedRetrySeconds = retryAfterSeconds ?? (
    resetEpochSeconds
      ? Math.max(1, Math.ceil(resetEpochSeconds - Date.now() / 1000))
      : DEFAULT_RETRY_SECONDS
  );

  return {
    isRateLimited: true,
    retryInSeconds: computedRetrySeconds,
    retryAtMs: Date.now() + computedRetrySeconds * 1000,
    message: fallbackMessage,
    limit: parseHeaderNumber(response.headers.get("X-RateLimit-Limit")),
    remaining: parseHeaderNumber(response.headers.get("X-RateLimit-Remaining")),
    resetEpochSeconds,
  };
}

export function parseSampledResponse(response: Response, payload: unknown) {
  if (response.status !== 202 || !payload || typeof payload !== "object") {
    return false;
  }

  return Reflect.get(payload, "sampled") === true;
}
