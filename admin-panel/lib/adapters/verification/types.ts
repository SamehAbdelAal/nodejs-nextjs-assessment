export interface AnnouncementForVerification {
  id: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
}

export interface VerificationResult {
  ok: boolean;
  reason?: string;
  verdict: "APPROVED" | "REJECTED";
  verifiedAt: Date;
}

export interface VerificationAdapter {
  verify(
    announcement: AnnouncementForVerification
  ): Promise<VerificationResult>;
}

export class TransientVerificationError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TransientVerificationError";
  }
}

export class PermanentVerificationError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PermanentVerificationError";
  }
}
