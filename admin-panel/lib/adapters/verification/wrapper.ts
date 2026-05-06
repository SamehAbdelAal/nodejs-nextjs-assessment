import { createHash } from "node:crypto";
import type {
  AnnouncementForVerification,
  VerificationAdapter,
  VerificationResult,
} from "./types";
import {
  PermanentVerificationError,
  TransientVerificationError,
} from "./types";

const APPROVED_TTL_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [100, 200, 400] as const;
const RETRY_MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const JITTER_FACTOR = 0.2;
const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_OPEN_MS = 30_000;

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CacheEntry {
  result: VerificationResult;
  cachedAt: number;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const defaultClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export interface WrapperOptions {
  clock?: Clock;
  random?: () => number;
}

export class CachedRetryingBreakerAdapter implements VerificationAdapter {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly clock: Clock;
  private readonly random: () => number;

  private breakerState: BreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenInFlight = false;

  constructor(
    private readonly inner: VerificationAdapter,
    options: WrapperOptions = {}
  ) {
    this.clock = options.clock ?? defaultClock;
    this.random = options.random ?? Math.random;
  }

  async verify(
    announcement: AnnouncementForVerification
  ): Promise<VerificationResult> {
    const key = this.cacheKey(announcement);

    const cached = this.readCache(key);
    if (cached) return cached;

    this.maybeTransitionToHalfOpen();

    if (this.breakerState === "OPEN") {
      throw new TransientVerificationError("breaker open");
    }
    if (this.breakerState === "HALF_OPEN" && this.halfOpenInFlight) {
      // Only one probe is allowed while half-open; concurrent callers wait for
      // the next state change.
      throw new TransientVerificationError("breaker open");
    }

    if (this.breakerState === "HALF_OPEN") this.halfOpenInFlight = true;

    try {
      const result = await this.callWithRetries(announcement);
      this.recordSuccess();
      this.writeCache(key, result);
      return result;
    } catch (err) {
      if (err instanceof TransientVerificationError) {
        this.recordFailure();
      }
      throw err;
    } finally {
      this.halfOpenInFlight = false;
    }
  }

  private async callWithRetries(
    announcement: AnnouncementForVerification
  ): Promise<VerificationResult> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.inner.verify(announcement);
      } catch (err) {
        lastErr = err;
        if (err instanceof PermanentVerificationError) throw err;
        if (!(err instanceof TransientVerificationError)) throw err;
        if (attempt === RETRY_MAX_ATTEMPTS - 1) throw err;
        await this.clock.sleep(this.jitter(RETRY_DELAYS_MS[attempt]));
      }
    }
    throw lastErr;
  }

  private jitter(base: number): number {
    const delta = base * JITTER_FACTOR * (2 * this.random() - 1);
    return Math.max(0, base + delta);
  }

  private cacheKey(a: AnnouncementForVerification): string {
    const hash = createHash("sha256")
      .update(`${a.titleEn}|${a.titleAr}|${a.bodyEn}|${a.bodyAr}`)
      .digest("hex")
      .slice(0, 16);
    return `${a.id}:${hash}`;
  }

  private readCache(key: string): VerificationResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.result.verdict === "REJECTED") return entry.result;
    if (this.clock.now() - entry.cachedAt < APPROVED_TTL_MS) {
      return entry.result;
    }
    this.cache.delete(key);
    return null;
  }

  private writeCache(key: string, result: VerificationResult): void {
    const existing = this.cache.get(key);
    // Precedence: a recorded REJECTED is sticky and cannot be flipped to APPROVED.
    // An APPROVED entry, by contrast, may be overwritten by REJECTED.
    if (
      existing &&
      existing.result.verdict === "REJECTED" &&
      result.verdict === "APPROVED"
    ) {
      return;
    }
    this.cache.set(key, { result, cachedAt: this.clock.now() });
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.breakerState = "CLOSED";
  }

  private recordFailure(): void {
    if (this.breakerState === "HALF_OPEN") {
      this.breakerState = "OPEN";
      this.openedAt = this.clock.now();
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
      this.breakerState = "OPEN";
      this.openedAt = this.clock.now();
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (this.breakerState !== "OPEN") return;
    if (this.clock.now() - this.openedAt >= BREAKER_OPEN_MS) {
      this.breakerState = "HALF_OPEN";
    }
  }
}
