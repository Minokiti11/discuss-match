// In-memory cache with TTL for MVP
// For production with multiple instances, use Redis or Vercel KV

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new SimpleCache();

// Cache key patterns
export const CACHE_KEYS = {
  summary: (roomId: string) => `summary:${roomId}`,
  votes: (roomId: string, stance?: string) =>
    `votes:${roomId}:${stance || "all"}`,
  match: (matchId: string) => `match:${matchId}`,
  hotTopics: (roomId: string) => `hot_topics:${roomId}`,
};

// TTLs (milliseconds)
export const CACHE_TTL = {
  summary: 5 * 60 * 1000, // 5 minutes
  votes: 2 * 60 * 1000, // 2 minutes
  match: 1 * 60 * 1000, // 1 minute (live updates)
  hotTopics: 30 * 1000, // 30 seconds
};

// Auto-cleanup every 10 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => cache.cleanup(), 10 * 60 * 1000);
}
