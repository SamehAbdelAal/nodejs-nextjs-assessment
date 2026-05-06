import { describe, it, expect } from "vitest";

import {
  CachedRetryingBreakerAdapter,
  TransientVerificationError,
  type AnnouncementForVerification,
  type Clock,
  type VerificationAdapter,
  type VerificationResult,
} from "@/lib/adapters/verification";

function announcement(id: string): AnnouncementForVerification {
  return {
    id,
    titleEn: `t-${id}`,
    titleAr: `t-ar-${id}`,
    bodyEn: `b-${id}`,
    bodyAr: `b-ar-${id}`,
  };
}

interface FakeClock extends Clock {
  state: { value: number };
  advance(ms: number): void;
}

function fakeClock(): FakeClock {
  const state = { value: 0 };
  return {
    state,
    now: () => state.value,
    sleep: async (ms) => {
      state.value += ms;
    },
    advance: (ms: number) => {
      state.value += ms;
    },
  };
}

class StubAdapter implements VerificationAdapter {
  calls = 0;
  next: VerificationResult | Error | null = null;

  async verify(): Promise<VerificationResult> {
    this.calls += 1;
    const r = this.next;
    if (r === null) throw new Error("StubAdapter: no response set");
    if (r instanceof Error) throw r;
    return r;
  }
}

describe("CachedRetryingBreakerAdapter — circuit breaker", () => {
  it("trips OPEN after 5 consecutive failed verify calls and short-circuits subsequent calls", async () => {
    const inner = new StubAdapter();
    inner.next = new TransientVerificationError("upstream 503");
    const clock = fakeClock();
    const wrapper = new CachedRetryingBreakerAdapter(inner, {
      clock,
      random: () => 0.5,
    });

    for (let i = 0; i < 5; i++) {
      await expect(
        wrapper.verify(announcement(`a-${i}`))
      ).rejects.toBeInstanceOf(TransientVerificationError);
    }
    // Each failed verify makes 3 inner attempts (3 retries).
    expect(inner.calls).toBe(15);

    // Breaker is now OPEN — next verify must short-circuit without invoking inner.
    const callsAfterTrip = inner.calls;
    await expect(
      wrapper.verify(announcement("post-trip"))
    ).rejects.toThrow(/breaker open/);
    expect(inner.calls).toBe(callsAfterTrip);
  });

  it("transitions OPEN → HALF_OPEN after 30s and CLOSED on a successful probe", async () => {
    const inner = new StubAdapter();
    inner.next = new TransientVerificationError("upstream 503");
    const clock = fakeClock();
    const wrapper = new CachedRetryingBreakerAdapter(inner, {
      clock,
      random: () => 0.5,
    });

    for (let i = 0; i < 5; i++) {
      await expect(
        wrapper.verify(announcement(`a-${i}`))
      ).rejects.toBeInstanceOf(TransientVerificationError);
    }
    const callsAfterTrip = inner.calls;

    // Just under 30s past openedAt — still OPEN.
    clock.advance(29_000);
    await expect(
      wrapper.verify(announcement("still-open"))
    ).rejects.toThrow(/breaker open/);
    expect(inner.calls).toBe(callsAfterTrip);

    // Push past the 30s open window — next call should attempt the inner (HALF_OPEN probe).
    clock.advance(2_000);
    inner.next = {
      ok: true,
      verdict: "APPROVED",
      verifiedAt: new Date(0),
    };

    const probe = await wrapper.verify(announcement("probe"));
    expect(probe.verdict).toBe("APPROVED");
    expect(inner.calls).toBe(callsAfterTrip + 1);

    // Breaker should now be CLOSED — another call goes straight through.
    const after = await wrapper.verify(announcement("after-close"));
    expect(after.verdict).toBe("APPROVED");
    expect(inner.calls).toBe(callsAfterTrip + 2);
  });
});
