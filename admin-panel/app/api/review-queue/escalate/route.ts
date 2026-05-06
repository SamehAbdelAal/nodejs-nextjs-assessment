import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { escalateOverdue } from "@/services/review-workflow";

export async function POST(_req: NextRequest) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "escalate")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const result = await escalateOverdue(prisma);
  return NextResponse.json(result);
}
