import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  SelfReviewError,
  WorkflowAuthorizationError,
  claimNext,
} from "@/services/review-workflow";

export async function POST(_req: NextRequest) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "review")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const result = await claimNext(prisma, user);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SelfReviewError) {
      return NextResponse.json(
        { error: "SELF_REVIEW", message: err.message },
        { status: 403 }
      );
    }
    if (err instanceof WorkflowAuthorizationError) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    throw err;
  }
}
