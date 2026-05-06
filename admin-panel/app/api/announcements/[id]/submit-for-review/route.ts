import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  WorkflowAuthorizationError,
  WorkflowNotFoundError,
  WorkflowStateError,
  submitForReview,
} from "@/services/review-workflow";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "submitForReview")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await submitForReview(prisma, id, user);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (err instanceof WorkflowStateError) {
      return NextResponse.json(
        { error: "STATE_CONFLICT", message: err.message },
        { status: 409 }
      );
    }
    if (err instanceof WorkflowAuthorizationError) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    throw err;
  }
}
