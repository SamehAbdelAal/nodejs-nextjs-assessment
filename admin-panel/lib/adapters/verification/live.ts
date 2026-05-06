import type {
  AnnouncementForVerification,
  VerificationAdapter,
  VerificationResult,
} from "./types";

// LiveVerificationAdapter — scaffold only.
// The external verification API contract has not been delivered yet. Every
// call site that would touch the wire is annotated `// TODO SPEC PENDING`
// so a single grep finds them all when the spec lands.
export class LiveVerificationAdapter implements VerificationAdapter {
  async verify(
    announcement: AnnouncementForVerification
  ): Promise<VerificationResult> {
    // TODO SPEC PENDING — resolve endpoint URL from adapter config
    // TODO SPEC PENDING — build request body from announcement fields
    // TODO SPEC PENDING — attach auth headers (bearer? mTLS?)
    // TODO SPEC PENDING — issue the HTTP request with timeout / abort signal
    // TODO SPEC PENDING — classify HTTP status (4xx → PermanentVerificationError, 5xx / network → TransientVerificationError)
    // TODO SPEC PENDING — parse response body
    // TODO SPEC PENDING — map upstream verdict codes onto 'APPROVED' | 'REJECTED'
    void announcement;
    throw new Error("TODO SPEC PENDING");
  }
}
