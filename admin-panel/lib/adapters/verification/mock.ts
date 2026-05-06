import type {
  AnnouncementForVerification,
  VerificationAdapter,
  VerificationResult,
} from "./types";

const DENY_TOKEN = "__deny__";

export class MockVerificationAdapter implements VerificationAdapter {
  async verify(
    announcement: AnnouncementForVerification
  ): Promise<VerificationResult> {
    const denied =
      announcement.bodyEn.includes(DENY_TOKEN) ||
      announcement.bodyAr.includes(DENY_TOKEN);

    if (denied) {
      return {
        ok: false,
        verdict: "REJECTED",
        reason: "mock-deny-token",
        verifiedAt: new Date(),
      };
    }

    return {
      ok: true,
      verdict: "APPROVED",
      verifiedAt: new Date(),
    };
  }
}
