import { NextResponse } from "next/server";
import { createClient } from "redis";

const CLEANUP_INTERVAL_MS = 60_000;
const UNKNOWN_CLIENT_IP = "unknown";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

type RateLimitRedisClient = ReturnType<typeof createClient>;

type RateLimitGlobalState = {
  __tenmRateLimitLastCleanupAt?: number;
  __tenmRateLimitRedisClient?: RateLimitRedisClient | null;
  __tenmRateLimitRedisClientPromise?: Promise<RateLimitRedisClient | null>;
  __tenmRateLimitRedisFallbackWarned?: boolean;
  __tenmRateLimitStore?: RateLimitStore;
};

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

function getGlobalState() {
  return globalThis as typeof globalThis & RateLimitGlobalState;
}

function getRateLimitStore() {
  const state = getGlobalState();

  if (!state.__tenmRateLimitStore) {
    state.__tenmRateLimitStore = new Map<string, RateLimitEntry>();
  }

  return state.__tenmRateLimitStore;
}

function cleanupExpiredEntries(now: number, store: RateLimitStore) {
  const state = getGlobalState();
  const lastCleanupAt = state.__tenmRateLimitLastCleanupAt ?? 0;

  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  state.__tenmRateLimitLastCleanupAt = now;

  store.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  });
}

function getMapKey(configKey: string, identity: string) {
  return `${configKey}:${identity}`;
}

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL?.trim();
  return redisUrl || null;
}

function parseRedisNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function warnRedisFallbackOnce(error: unknown) {
  const state = getGlobalState();

  if (state.__tenmRateLimitRedisFallbackWarned) {
    return;
  }

  state.__tenmRateLimitRedisFallbackWarned = true;
  console.error("Redis rate limiting unavailable. Falling back to in-memory limiter.", error);
}

async function getRedisClient() {
  const redisUrl = getRedisUrl();

  if (!redisUrl) {
    return null;
  }

  const state = getGlobalState();

  if (state.__tenmRateLimitRedisClient) {
    return state.__tenmRateLimitRedisClient;
  }

  if (state.__tenmRateLimitRedisClientPromise) {
    return state.__tenmRateLimitRedisClientPromise;
  }

  const connectPromise = (async () => {
    try {
      const client = createClient({
        url: redisUrl,
      });
      client.on("error", (error) => {
        warnRedisFallbackOnce(error);
      });
      await client.connect();
      state.__tenmRateLimitRedisClient = client;
      state.__tenmRateLimitRedisFallbackWarned = false;
      return client;
    } catch (error) {
      state.__tenmRateLimitRedisClient = null;
      warnRedisFallbackOnce(error);
      return null;
    } finally {
      state.__tenmRateLimitRedisClientPromise = undefined;
    }
  })();

  state.__tenmRateLimitRedisClientPromise = connectPromise;
  return connectPromise;
}

function consumeRateLimitInMemory({
  config,
  identity,
}: {
  config: RateLimitConfig;
  identity: string;
}) {
  const now = Date.now();
  const store = getRateLimitStore();
  cleanupExpiredEntries(now, store);

  const mapKey = getMapKey(config.key, identity);
  const existingEntry = store.get(mapKey);
  const resetAt =
    existingEntry && existingEntry.resetAt > now
      ? existingEntry.resetAt
      : now + config.windowMs;
  const nextCount =
    existingEntry && existingEntry.resetAt > now
      ? existingEntry.count + 1
      : 1;

  store.set(mapKey, {
    count: nextCount,
    resetAt,
  });

  const allowed = nextCount <= config.limit;
  const remaining = allowed ? config.limit - nextCount : 0;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

  return {
    allowed,
    limit: config.limit,
    remaining,
    resetAt,
    retryAfterSeconds,
  } satisfies RateLimitResult;
}

async function consumeRateLimitInRedis({
  config,
  identity,
}: {
  config: RateLimitConfig;
  identity: string;
}) {
  const client = await getRedisClient();

  if (!client) {
    return consumeRateLimitInMemory({ config, identity });
  }

  const key = getMapKey(config.key, identity);

  try {
    const scriptResult = await client.eval(
      [
        "local current = redis.call('INCR', KEYS[1])",
        "if current == 1 then",
        "  redis.call('PEXPIRE', KEYS[1], ARGV[1])",
        "end",
        "local ttl = redis.call('PTTL', KEYS[1])",
        "if ttl < 0 then",
        "  redis.call('PEXPIRE', KEYS[1], ARGV[1])",
        "  ttl = tonumber(ARGV[1])",
        "end",
        "return { current, ttl }",
      ].join("\n"),
      {
        keys: [key],
        arguments: [String(config.windowMs)],
      },
    );

    if (!Array.isArray(scriptResult) || scriptResult.length < 2) {
      throw new Error("Invalid Redis rate-limit response.");
    }

    const current = parseRedisNumber(scriptResult[0]);
    const ttlMs = parseRedisNumber(scriptResult[1]);

    if (!current || !ttlMs || ttlMs <= 0) {
      throw new Error("Invalid Redis rate-limit counters.");
    }

    const now = Date.now();
    const resetAt = now + ttlMs;
    const allowed = current <= config.limit;
    const remaining = allowed ? Math.max(0, config.limit - current) : 0;
    const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

    return {
      allowed,
      limit: config.limit,
      remaining,
      resetAt,
      retryAfterSeconds,
    } satisfies RateLimitResult;
  } catch (error) {
    warnRedisFallbackOnce(error);
    return consumeRateLimitInMemory({ config, identity });
  }
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const firstAddress = forwarded.split(",")[0]?.trim();

    if (firstAddress) {
      return firstAddress;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || UNKNOWN_CLIENT_IP;
}

export function getRateLimitIdentity(request: Request, userId?: string | null) {
  const trimmedUserId = userId?.trim();

  if (trimmedUserId) {
    return `user:${trimmedUserId}`;
  }

  return `ip:${getClientIp(request)}`;
}

export async function consumeRateLimit({
  config,
  identity,
}: {
  config: RateLimitConfig;
  identity: string;
}): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "test") {
    const resetAt = Date.now() + config.windowMs;

    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(config.windowMs / 1000)),
    };
  }

  return consumeRateLimitInRedis({ config, identity });
}

export function buildRateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": String(result.retryAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function createRateLimitResponse(
  result: RateLimitResult,
  error = "Too many requests.",
) {
  return NextResponse.json(
    { error },
    {
      status: 429,
      headers: buildRateLimitHeaders(result),
    },
  );
}
