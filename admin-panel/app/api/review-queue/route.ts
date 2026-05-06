import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createReviewQueueClient } from "@/lib/review-queue/src";

export async function GET(_req: NextRequest) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "review")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const queue = createReviewQueueClient(prisma);
  const items = await queue.listPending({ excludeAuthorId: user.id });

  return NextResponse.json({ items });
}
