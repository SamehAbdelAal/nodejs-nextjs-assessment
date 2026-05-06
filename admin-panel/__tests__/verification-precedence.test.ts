import { describe, it, expect } from "vitest";

import {
  CachedRetryingBreakerAdapter,
  type AnnouncementForVerification,
  type VerificationAdapter,
  type VerificationResult,
} from "@/lib/adapters/verification";

function announcement(
  overrides: Partial<AnnouncementForVerification> = {}
): AnnouncementForVerification {
  return {
    id: "ann-1",
    titleEn: "Title",
    titleAr: "عنوان",
    bodyEn: "Body",
    bodyAr: "نص",
    ...overrides,
  };
}

class StubAdapter implements VerificationAdapter {
  calls = 0;
  responses: Array<VerificationResult | Error> = [];

  async verify(): Promise<VerificationResult> {
    this.calls += 1;
    const r = this.responses.shift();
    if (r === undefined) {
      throw new Error("StubAdapter: no response queued");
    }
    if (r instanceof Error) throw r;
    return r;
  }
}

describe("CachedRetryingBreakerAdapter — cached REJECTED is sticky", () => {
  it("a REJECTED verdict is returned on subsequent calls with the same content even if the inner would say APPROVED", async () => {
    const inner = new StubAdapter();
    inner.responses.push(
      { ok: false, verdict: "REJECTED", reason: "first-deny", verifiedAt: new Date(0) },
      { ok: true, verdict: "APPROVED", verifiedAt: new Date(0) }
    );

    const wrapper = new CachedRetryingBreakerAdapter(inner);

    const first = await wrapper.verify(announcement());
    expect(first.verdict).toBe("REJECTED");

    const second = await wrapper.verify(announcement());
    expect(second.verdict).toBe("REJECTED");
    expect(second.reason).toBe("first-deny");

    // Inner was never called the second time — cache hit served REJECTED.
    expect(inner.calls).toBe(1);
  });

  it("editing the body changes the cache key, so a new APPROVED verdict is honoured", async () => {
    const inner = new StubAdapter();
    inner.responses.push(
      { ok: false, verdict: "REJECTED", reason: "first-deny", verifiedAt: new Date(0) },
      { ok: true, verdict: "APPROVED", verifiedAt: new Date(0) }
    );

    const wrapper = new CachedRetryingBreakerAdapter(inner);

    const first = await wrapper.verify(announcement());
    expect(first.verdict).toBe("REJECTED");

    // Same announcement id, different body → different cache key.
    const second = await wrapper.verify(announcement({ bodyEn: "Edited body" }));
    expect(second.verdict).toBe("APPROVED");
    expect(inner.calls).toBe(2);
  });
});
