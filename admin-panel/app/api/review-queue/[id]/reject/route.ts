import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { reviewRejectSchema } from "@/lib/validations";
import {
  SelfReviewError,
  WorkflowAuthorizationError,
  WorkflowNotFoundError,
  WorkflowStateError,
  rejectItem,
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
  const parsed = reviewRejectSchema.safeParse(raw);
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
    await rejectItem(prisma, id, user, parsed.data.reason);
    return NextResponse.json({ ok: true });
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
    throw err;
  }
}
