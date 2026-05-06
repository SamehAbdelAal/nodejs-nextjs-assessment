import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { reviewApproveSchema } from "@/lib/validations";
import { MockVerificationAdapter } from "@/lib/adapters/verification";
import {
  SelfReviewError,
  WorkflowAuthorizationError,
  WorkflowNotFoundError,
  WorkflowStateError,
  approveItem,
} from "@/services/review-workflow";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "review")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = reviewApproveSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  try {
    const verdict = await approveItem(prisma, id, user, parsed.data.note, {
      verification: new MockVerificationAdapter(),
    });
    return NextResponse.json({ ok: true, verdict });
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof SelfReviewError) {
      return NextResponse.json(
        { error: "SELF_REVIEW", message: err.message },
        { status: 403 }
      );
    }
    if (err instanceof WorkflowAuthorizationError) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: err.message },
        { status: 403 }
      );
    }
    if (err instanceof WorkflowStateError) {
      return NextResponse.json(
        { error: "STATE_CONFLICT", message: err.message },
        { status: 409 }
      );
    }
    // Verification transport / breaker failure → 503; the service has already
    // written a best-effort VERIFICATION_TRANSPORT_FAILED audit.
    return NextResponse.json(
      {
        error: "VERIFICATION_UNAVAILABLE",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
